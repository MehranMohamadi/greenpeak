# Price and underlying-unit scenario

The dashboard scenario is an in-memory linear preview. It starts from the risk
overview's server-calculated USD equity, total exposure and canonical symbol net
exposure. It never places an order or persists a proposed position.

Both controls start at zero. Positive added units mean an additional long;
negative units mean an additional short. Fractions can be entered manually.
The volume slider covers -100 to +100 units; the price slider covers -20% to +20%.

## Units and quote provenance

- Gold: one unit is one ounce, valued at the available USD gold quote.
- S&P 500: one unit is an underlying index equivalent valued at the index quote
  in USD, independent of a broker's lot multiplier.
- Underlying units = lots × contract size. Equivalent lots = units / contract
  size. Contract sizes belong to each broker; broker lots are not aggregated.
- For other supported linear symbols in USD accounts, dollar value per unit is
  derived from price × tick value / tick size / contract size. Non-USD deposit
  currencies or unsupported calculation modes do not silently use raw prices
  as dollars.

Contract and tick semantics follow the [MetaTrader symbol properties reference](https://www.mql5.com/en/docs/constants/environment_state/marketinfoconstants).

The preview uses the freshest valid matching broker quote or the site's existing
gold/S&P quote endpoint. Source and observation time are displayed. Missing,
future, crossed or non-positive quotes are not invented. Missing quotes can still
permit a price-only stress on known USD exposure, but cannot value added units.

## Calculation order

Let E be current USD equity, G the server's sum of absolute net exposures by
canonical symbol, N the selected symbol's signed net exposure, q added units,
P USD value per underlying unit, and r the fractional price change:

```text
added notional = q × P
net after volume = N + q × P
other symbols' exposure = G - |N|
exposure after volume = G - |N| + |N + q × P|
P/L = (N + q × P) × r
equity after scenario = E + P/L
exposure after scenario = G - |N| + |(N + q × P) × (1 + r)|
leverage after volume = exposure after volume / E
leverage after scenario = exposure after scenario / equity after scenario
```

In all-broker mode, q is added once to the combined portfolio. Existing opposite
positions remain netted according to the server's leverage convention. The two
dollar readouts are q × P and r × P respectively. Buying against an existing
short may therefore reduce leverage before crossing through zero.

Incomplete server totals, unknown symbol exposure, overflow and invalid input
remain unavailable. Non-positive equity has no defined leverage. Other symbols,
FX conversion rates and quantities are held constant. Margin constraints, spread,
fees, slippage and gaps are outside this linear preview.

## Validation

`front2/tests/scenario-volume.test.mjs` covers the financial calculations and
quote selection. `front2/tests/scenario-dialog.test.mjs` executes the actual JSX
handlers to verify zero defaults, signed/fractional input, dollar outputs, result
cards and RTL slider/number/dollar ordering. Existing risk checks remain in
`front2/scripts/verify-risk-management.mjs`.
