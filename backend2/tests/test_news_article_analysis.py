import os

os.environ["DEBUG"] = "false"

from src.services.news import article_analysis


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
    assert result["analysis_version"] == "1.0.0"
    assert result["article_character_count"] > 200
    assert "article_text" not in result


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
