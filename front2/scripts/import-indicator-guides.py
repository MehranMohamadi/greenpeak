"""Read the supplied workbook without changing it; retain exact text and row provenance."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROW_IDS = {
    3: "ten-year-treasury", 4: "fed-funds-rate", 5: "sofr-rate",
    6: "real-interest-rate", 7: "fed-balance-sheet", 8: "money-supply-m2", 9: "reverse-repo",
    12: "real_gdp", 13: "retail_sales_growth_mom", 14: "consumer_confidence",
    15: "cpi_inflation_yoy", 16: "core_cpi_inflation_yoy", 17: "core_pce_inflation_yoy",
    18: "ppi_final_demand_inflation_yoy", 19: "unemployment_rate", 20: "nonfarm_payrolls",
    23: "high_yield_credit_spread", 24: "bbb_credit_spread", 25: "financial_stress_index",
    26: "treasury_2y10y_spread", 29: "sp500_eps", 30: "revenue_growth",
    31: "profit_margins", 32: "return_on_assets", 35: "valuation_pe_ratio",
    36: "forward_pe_ratio", 37: "price_to_book_ratio", 38: "price_to_sales_ratio",
    39: "peg_ratio", 40: "valuation_dividend_yield", 43: "company-concentration",
    44: "company-contribution", 45: "cap-vs-equal-weight", 46: "sector-weights",
    47: "sector-relative-returns", 48: "sector-relative-path", 49: "growth-value",
    50: "large-small", 51: "cyclical-defensive", 54: "vix", 55: "vix_term_structure",
    56: "spx_put_call_ratio", 57: "aaii_bull_bear_spread", 58: "cftc_sp500_positioning",
    61: "broad_dollar", 62: "gold", 63: "wti", 64: "copper",
}
FIELDS = ("titleEn", "titleFa", "literal", "meaning", "increase", "decrease")
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def extract(path):
    with ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = workbook.find("s:sheets", NS)[0]
        relations = {item.attrib["Id"]: item.attrib["Target"] for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        target = relations[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target
        entries = {}
        section = ""
        for row in ET.fromstring(archive.read(target)).findall(".//s:sheetData/s:row", NS):
            index = int(row.attrib["r"])
            cells = {}
            for cell in row:
                value, inline = cell.find("s:v", NS), cell.find("s:is", NS)
                text = value.text if value is not None else "".join(inline.itertext()) if inline is not None else ""
                if cell.get("t") == "s" and text:
                    text = strings[int(text)]
                if text:
                    cells[cell.attrib["r"].rstrip("0123456789")] = text
            if len(cells) == 1 and "A" in cells:
                section = cells["A"]
            if index not in ROW_IDS:
                continue
            if set(cells) != set("ABCDEF") or any(cell.find("s:f", NS) is not None for cell in row):
                raise ValueError(f"Expected six literal guide cells in row {index}")
            entries[ROW_IDS[index]] = {"section": section, "sourceRange": f"A{index}:F{index}",
                **dict(zip(FIELDS, (cells[column] for column in "ABCDEF")))}
        if set(entries) != set(ROW_IDS.values()):
            raise ValueError("Workbook does not contain all mapped guide rows")
        return {"source": {"fileName": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "sheetName": sheet.attrib["name"]}, "entries": entries}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / "lib" / "indicator-guides.json"
    result = extract(args.workbook)
    if args.check:
        assert json.loads(destination.read_text(encoding="utf-8")) == result, "Guide content differs from the supplied workbook"
        print(f"Verified {len(result['entries'])} guides against source cells")
    else:
        destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Imported {len(result['entries'])} guides")
