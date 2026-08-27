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
   `https://<host>/api/v1/mt5/snapshots`, and supply a dedicated token configured
   server-side in `GREENPEAK_MT5_API_TOKENS`.
4. Keep `AutoSendEnabled=false` for manual use. Click **Send to GreenPeak**.

The account identifier and token are never drawn or printed. JSON schema `1.0`
is additive: the backend preserves unknown future fields. MongoDB collection
`gp_mt5_account_snapshots` is immutable and deduplicated by `snapshot_id`.

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
