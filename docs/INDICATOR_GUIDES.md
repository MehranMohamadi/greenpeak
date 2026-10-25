# Chart indicator guides

`front2/lib/indicator-guides.json` contains all 48 educational rows from the
user-supplied `GreenPeak_Indicator_Guide_Compact_FA (1).xlsx`. The English and
Persian names, literal meaning, economic meaning, and increase/decrease text
are copied verbatim. Source filename, workbook SHA-256, sheet name and original
cell ranges are retained for verification. Workbook contents are reference text,
not executable instructions. The source workbook is never edited.

To import an updated copy or verify the current copy, from the repository root:

```powershell
python front2/scripts/import-indicator-guides.py "<workbook.xlsx>"
python front2/scripts/import-indicator-guides.py "<workbook.xlsx>" --check
```

Stable chart IDs map to explicit workbook rows in the importer. The small alias
list in `front2/lib/indicator-guides.js` connects the same indicator in different
views. Unknown IDs show a clear missing-guide message; they never borrow a
different definition. In particular, ICE DXY is not mapped to the broad dollar
index. The workbook describes operating EPS, whereas the current corporate
chart displays Multpl real TTM EPS; its guide explicitly identifies that
difference without rewriting the workbook or changing the plotted data.

The shared `IndicatorGuide` uses the existing Radix dialog and button components.
It opens by click, tap, Enter or Space, supports Escape and focus return, and
scrolls within the viewport for long text and mobile screens. Selecting a
factor and opening its guide are separate sibling buttons, so reading a guide
does not select another chart or change its range. Fullscreen and comparison
charts expose the same guides; comparison guides follow their own selection.
