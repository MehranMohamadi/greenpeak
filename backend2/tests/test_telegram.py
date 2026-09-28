import os

os.environ["DEBUG"] = "false"

from src.utils.telegram import _message_chunks, send_telegram_market_report


class FakeResponse:
    text = ""

    def raise_for_status(self):
        return None

    def json(self):
        return {"ok": True}


def test_long_telegram_sections_are_split_below_the_api_limit():
    sections = ["<b>analysis</b>\n" + " ".join(["market"] * 1200), "<b>summary</b>\nshort"]
    chunks = _message_chunks(sections, limit=500)

    assert len(chunks) > 2
    assert all(len(chunk) <= 500 for chunk in chunks)
    assert chunks[-1].endswith("short")


def test_send_telegram_market_report_sends_current_tab_then_summary(monkeypatch):
    captured = {}

    def fake_post(url, data, timeout):
        captured.update(url=url, data=data, timeout=timeout)
        return FakeResponse()

    settings = __import__("src.core.config", fromlist=["get_settings"]).get_settings()
    monkeypatch.setattr(settings, "telegram_bot_token", "test-token")
    monkeypatch.setattr(settings, "telegram_chat_id", "test-chat")
    monkeypatch.setattr(settings, "telegram_message_thread_id", 42)
    monkeypatch.setattr("src.utils.telegram.httpx.post", fake_post)

    assert send_telegram_market_report(
        {
            "current_market_move_fa": "حرکت <فعلی> بازار",
            "current_analysis_fa": "تحلیل اکنون",
            "summary_points_fa": ["نکته اول", "نکته دوم"],
            "market_story_fa": "متن قدیمی",
        }
    ) is True
    assert captured["url"] == "https://api.telegram.org/bottest-token/sendMessage"
    assert captured["data"]["parse_mode"] == "HTML"
    assert captured["data"]["message_thread_id"] == "42"
    assert captured["data"]["text"] == (
        "<b>اکنون</b>\n"
        "حرکت &lt;فعلی&gt; بازار\n\n"
        "تحلیل اکنون\n\n"
        "<b>جمع‌بندی</b>\n"
        "1. نکته اول\n"
        "2. نکته دوم"
    )
