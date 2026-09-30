import os

os.environ["DEBUG"] = "false"

from src.services.news import article_analysis


def impact_graph():
    return {
        "title": "اثر کاهش فشار تورمی بر سهام آمریکا",
        "evidence": [
            {
                "id": "evidence-1",
                "claim": "گزارش از کاهش فشار تورمی خبر می‌دهد.",
                "source": "example.com",
                "status": "reported",
            }
        ],
        "nodes": [
            {"id": "news-1", "label": "کاهش فشار تورمی", "role": "news", "evidenceIds": ["evidence-1"], "meta": {}},
            {"id": "driver-1", "label": "انتظارات نرخ بهره", "role": "driver", "direction": "down", "confidence": "medium", "evidenceIds": ["evidence-1"], "meta": {}},
            {"id": "market-1", "label": "ارزش‌گذاری سهام بزرگ", "role": "market", "direction": "up", "confidence": "medium", "evidenceIds": ["evidence-1"], "meta": {}},
        ],
        "edges": [
            {"id": "edge-1", "from": "news-1", "to": "driver-1", "direction": "down", "confidence": "medium", "reason": "فشار تورمی کمتر می‌تواند انتظار نرخ‌های پایین‌تر را تقویت کند.", "evidenceIds": ["evidence-1"], "meta": {}},
            {"id": "edge-2", "from": "driver-1", "to": "market-1", "direction": "up", "confidence": "medium", "reason": "نرخ تنزیل پایین‌تر می‌تواند از ارزش‌گذاری حمایت کند.", "evidenceIds": ["evidence-1"], "condition": "در صورت تأیید روند در داده‌های بعدی", "meta": {}},
        ],
        "uncertainties": ["یک گزارش برای اثبات روند پایدار کافی نیست."],
        "scenarios": [{"condition": "در صورت تأیید روند در داده‌های بعدی", "edgeIds": ["edge-2"]}],
    }


class FakeResponse:
    headers = {"content-type": "text/html; charset=utf-8"}
    text = """<html><body><nav>Navigation noise</nav><article>
    <h1>Stocks rise after inflation report</h1>
    <p>United States stocks rose after the latest inflation report showed price pressures easing.</p>
    <p>The report changed expectations for interest rates and supported large-cap technology shares.</p>
    <p>Analysts still warned that one report does not establish a durable trend for the wider market.</p>
    </article><footer>Footer noise</footer></body></html>"""

    def raise_for_status(self):
        return None


class FakeProvider:
    provider_id = "fake"
    model_id = "fake-model"

    def __init__(self):
        self.evidence = None

    def generate_json(self, prompt, evidence):
        assert "title_fa" in prompt
        self.evidence = evidence
        return {
            "title_fa": "سهام پس از گزارش تورم رشد کردند",
            "interpretation_fa": "کاهش فشارهای تورمی می‌تواند از ارزش‌گذاری سهام بزرگ حمایت کند، اما یک گزارش برای نتیجه‌گیری قطعی کافی نیست.",
            "impact_graph": impact_graph(),
        }


def test_news_analysis_reads_source_page_then_calls_llm(monkeypatch):
    monkeypatch.setattr(article_analysis.httpx, "get", lambda *args, **kwargs: FakeResponse())
    provider = FakeProvider()
    result = article_analysis.analyze_news_document(
        {
            "item_id": "article-1",
            "title": "Stocks rise after inflation report",
            "url": "https://example.com/article-1",
            "summary": "Short source summary.",
            "source": "alpha_vantage",
        },
        provider,
    )

    assert provider.evidence["evidence_type"] == "source_page"
    assert "Navigation noise" not in provider.evidence["article_text"]
    assert "inflation report" in provider.evidence["article_text"]
    assert result["title_fa"] == "سهام پس از گزارش تورم رشد کردند"
    assert result["analysis_version"] == "2.0.0"
    assert result["article_character_count"] > 200
    assert "article_text" not in result
    assert result["impact_graph"]["edges"][0]["from"] == "news-1"


def test_news_analysis_uses_source_summary_when_page_is_blocked(monkeypatch):
    def blocked(*args, **kwargs):
        raise ValueError("blocked")

    monkeypatch.setattr(article_analysis, "fetch_article_text", blocked)
    provider = FakeProvider()
    result = article_analysis.analyze_news_document(
        {
            "item_id": "article-2",
            "title": "Stocks rise after inflation report",
            "url": "https://example.com/article-2",
            "summary": "A sufficiently detailed source summary explains that stocks advanced as inflation pressure eased and policy expectations shifted.",
            "source": "alpha_vantage",
        },
        provider,
    )

    assert result["evidence_type"] == "source_summary"


def test_news_analysis_rejects_graph_with_unknown_node_reference(monkeypatch):
    monkeypatch.setattr(article_analysis.httpx, "get", lambda *args, **kwargs: FakeResponse())

    class InvalidGraphProvider(FakeProvider):
        def generate_json(self, prompt, evidence):
            result = super().generate_json(prompt, evidence)
            result["impact_graph"]["edges"][0]["to"] = "missing-node"
            return result

    try:
        article_analysis.analyze_news_document(
            {
                "item_id": "article-invalid",
                "title": "Stocks rise after inflation report",
                "url": "https://example.com/article-invalid",
                "summary": "Short source summary.",
                "source": "alpha_vantage",
            },
            InvalidGraphProvider(),
        )
    except ValueError as exc:
        assert "unknown node" in str(exc)
    else:
        raise AssertionError("Invalid graph references must be rejected")
