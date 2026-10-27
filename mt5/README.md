# GreenPeak MT5 Risk Monitor

`GreenPeakRiskMonitor.mq5` is a read-only MetaTrader 5 Expert Advisor. It reads
account state, calculates current risk metrics, draws a compact panel, and sends
one versioned JSON snapshot to GreenPeak. It contains no trading functions.

## Install

1. Copy `GreenPeakRiskMonitor.mq5` into the terminal's `MQL5/Experts/GreenPeak`
   directory and compile it with MetaEditor.
2. In MT5, add the exact HTTPS origin from `GreenPeakApiUrl` to **Tools > Options
   > Expert Advisors > Allow WebRequest for listed URL**.
3. Attach the EA to a chart, set `GreenPeakApiUrl` to
   `https://<host>/api/v1/mt5/snapshots`. While signed in to GreenPeak, use
   **کلید اتصال / API Key** to generate a connection key and paste it into the
   EA's **کلید اتصال / API Key** input (internally `GreenPeakApiToken`, retained
   for compatibility with existing presets).
4. Keep `AutoSendEnabled=false` for manual use. Click **Send to GreenPeak**.

The EA includes the active chart symbol, every open-position and pending-order
symbol, plus benchmark specifications for S&P 500, gold, EUR/USD, and Bitcoin
in each snapshot. It recognizes common aliases such as `US500`, `SP500`,
`SPX500`, `XAUUSD`, `GOLD`, `EURUSD`, `BTCUSD`, and `XBTUSD`. If auto-detection
does not select the intended contracts, set their exact broker names in
`Sp500BrokerSymbol`, `GoldBrokerSymbol`, `ForexBrokerSymbol`, and
`CryptoBrokerSymbol`. Where the exposed MT5 contract details support it, each
sample also contains comparable annualized long/short swap rates; otherwise an
explicit unavailable status is sent instead of an estimate.

The key can be shown again using **نمایش کلید** beside its connection in the
profile. GreenPeak keeps the SHA-256 hash for authentication and a Fernet-encrypted
copy for owner-only retrieval. Normal connection lists never contain the key.
The first accepted snapshot binds it to the signed-in user and exact
broker/server/account identity. Revoke a connection before pairing a replacement
account. Legacy hash-only connections become revealable after the next valid MT5
upload, which stores the same original key without rotating it.

Encryption derives a separate key with HKDF-SHA256 from the existing server-side
`AUTH_SECRET_KEY`. This must be a stable random secret of at least 32 characters;
the development placeholder is rejected even in development. Keep it outside Git
and back it up securely. After changing it, existing connections still ingest using
their hashes; their next valid upload refreshes the encrypted copy. Until then,
showing an old key returns a retry-after-upload message. Reveal responses use
`Cache-Control: no-store`, require the connection owner's current session, and
reject revoked or foreign connections. Keys are kept only in component memory in
the browser, cleared on hiding, navigation, or session change.

The account identifier and token are never drawn or printed. JSON schema `1.0`
is additive: the backend preserves unknown future fields. MongoDB collection
`gp_mt5_account_snapshots` is immutable and deduplicated by `snapshot_id`.

Version 1.04 also sends `account.trade_mode` from MT5's `ACCOUNT_TRADE_MODE`.
Broker comparisons keep real, demo and contest account costs separate. Older
snapshots use an explicit server-name marker where available; otherwise their
type remains unknown. Compile/install the updated expert and send a fresh
snapshot for authoritative account-type classification. See
[BROKER_COMPARISON.md](../docs/BROKER_COMPARISON.md).

## Safety and calculation conventions

- The EA never calls `OrderSend`, `CTrade`, position/order modification, or any
  equivalent trading API.
- Hypothetical P/L uses `OrderCalcProfit`; break-even and final-leverage prices
  are solved numerically and return explicit no-solution statuses.
- Exposure conversion uses a directly available MT5 currency pair. Missing USD
  conversion yields `USD_CONVERSION_UNAVAILABLE`, never a mislabeled number.
- Swap modes whose broker economics cannot be safely reconstructed from exposed
  symbol properties are returned as unavailable instead of guessed.
- Break-even includes accrued swap. Position commission is emitted as `null`
  because MT5 exposes commission on deals rather than as a reliable live-position
  property; unknown future closing commission is excluded and documented in the
  status.
