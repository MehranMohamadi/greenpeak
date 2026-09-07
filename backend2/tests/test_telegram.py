import os

os.environ["DEBUG"] = "false"

from src.utils.telegram import send_telegram_market_report


class FakeResponse:
    text = ""

    def raise_for_status(self):
        return None

    def json(self):
        return {"ok": True}


def test_send_telegram_market_report_formats_market_fields(monkeypatch):
    captured = {}

    def fake_post(url, data, timeout):
        captured.update(url=url, data=data, timeout=timeout)
        return FakeResponse()

    settings = __import__("src.core.config", fromlist=["get_settings"]).get_settings()
    monkeypatch.setattr(settings, "telegram_bot_token", "test-token")
    monkeypatch.setattr(settings, "telegram_chat_id", "test-chat")
    monkeypatch.setattr("src.utils.telegram.httpx.post", fake_post)

    assert send_telegram_market_report(
        {
            "data_as_of": "2026-09-07",
            "llm_shadow_score": 7.5,
            "market_story_fa": "روایت <محرمانه>",
            "positive_drivers": [{"label_fa": "رشد", "value_fa": "بهبود"}],
        }
    ) is True
    assert captured["url"] == "https://api.telegram.org/bottest-token/sendMessage"
    assert captured["data"]["parse_mode"] == "HTML"
    assert "&lt;محرمانه&gt;" in captured["data"]["text"]
    assert "رشد: بهبود" in captured["data"]["text"]