# One-shot LLM and Telegram test

The explicit CLI sends one short connectivity prompt through the configured
provider router, then sends its reply to the configured Telegram report topic.
It does not run the daily market-analysis pipeline or change its schedule.
Provider failover can make multiple HTTP attempts for the one logical prompt.
If all providers fail, Telegram receives a short failure notice instead.

From `backend2/`, verify configuration without making requests or writing state:

```powershell
$env:DEBUG = "false"
.\.venv\Scripts\python.exe -m src.services.llm_engine.telegram_smoke_test --scheduled-at "2026-10-28T21:00:00+03:30" --dry-run
```

Production's one-time test is scheduled for **2026-10-28 21:00 Asia/Tehran**
(17:30 UTC). The corresponding server command is:

```bash
systemd-run --unit=greenpeak-llm-telegram-smoke-20261028 \
  --on-calendar='2026-10-28 17:30:00 UTC' \
  --timer-property=AccuracySec=1s \
  --property=WorkingDirectory=/root/greenpeak-current/backend2 \
  --setenv=DEBUG=false \
  /root/greenpeak-current/backend2/.venv/bin/python \
  -m src.services.llm_engine.telegram_smoke_test \
  --scheduled-at '2026-10-28T21:00:00+03:30'
```

This is a transient timer, so it survives application redeployment but not a
server reboot. It does not repeat on subsequent days. The CLI refuses to run
early or more than five minutes late. `llm_telegram_smoke.db`, alongside the
configured router database, records an atomic claim before network calls;
repeating the same timestamp does not send again. Interrupted or uncertain
delivery is intentionally not retried automatically.

Inspect the timer and result without exposing credentials:

```bash
systemctl list-timers greenpeak-llm-telegram-smoke-20261028.timer --no-pager
journalctl -u greenpeak-llm-telegram-smoke-20261028.service --no-pager
```

A successful run prints `status: sent`, the actual provider/model, and the
Telegram message ID. A sent failure notice also has `llm_error`, so Telegram
delivery alone does not imply LLM success. Provider response bodies and keys
are never included in the probe's output.
