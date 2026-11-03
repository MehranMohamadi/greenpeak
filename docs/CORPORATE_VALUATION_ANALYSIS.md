# Group 4: Corporate Fundamentals & Valuation

The group at `/analytics/corporate-earnings` uses one domain narrative with ID
`corporate_fundamentals_valuation`, covering the same ten indicators as its charts:
real TTM EPS, sales growth, profit margins, return on assets, trailing P/E,
forward P/E, price-to-book, price-to-sales, PEG proxy, and dividend yield.

`config/greenpeak/domains.yaml` sets the expected coverage to ten. The persisted
indicator → domain → market pipeline produces one joint synthesis of earnings,
profitability and valuation. Missing indicator snapshots or failed indicator
analyses reduce coverage and remain explicit missing inputs. The two disabled
legacy corporate P/E and dividend-yield definitions remain disabled and do not
duplicate the corresponding valuation charts.

The EPS definition is version 3.0 because its source and meaning now match the
chart: the validated monthly Multpl real TTM EPS CSV in July 2026 dollars. The
read-only repository adapter uses the chart's existing loader, excludes dates
after the requested as-of date, and never writes observations into raw MongoDB
collections. Python's existing monthly feature builder calculates its features.
The other reassigned definitions increment their minor version so a changed
configuration does not reuse an incompatible snapshot identity.

The frontend and daily market report read the unified snapshot through
`GET /api/v1/domains/corporate_fundamentals_valuation/analysis/latest`, retaining
the existing premium/admin access rules. Historical snapshots for
`corporate_fundamentals` and `valuation` are left intact; they are not combined
or presented as the new analysis. After deployment, the next scheduled analysis
or an administrator's existing analysis refresh generates the unified snapshot.
Until it exists, the page displays the existing no-saved-analysis state.

The default domain prompt is version 0.6.0. Any administrator-customized domain
prompt remains in effect and can be updated through the existing prompt editor.
