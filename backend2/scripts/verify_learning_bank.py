"""Offline editorial checks and a reproducible Persian review copy; never sends posts."""

import argparse
from collections import Counter
from html import escape
import json
import math
from pathlib import Path
import re
import statistics
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / "backend2/src/data/learning/risk_daily_v1.json"
PREVIEW = ROOT / "docs/learning/RISK_DAILY_BANK_FA.md"
TEXT_FIELDS = ("question_fa", "answer_fa", "explanation_fa", "takeaway_fa")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def moments(values, probabilities):
    require(len(values) == len(probabilities) > 0, "Invalid distribution lengths")
    require(all(0 <= p <= 1 for p in probabilities), "Invalid probability")
    require(math.isclose(sum(probabilities), 1), "Probabilities must sum to one")
    mean = sum(p * r for p, r in zip(probabilities, values))
    variance = sum(p * (r - mean) ** 2 for p, r in zip(probabilities, values))
    return {"mean": mean, "variance": variance, "sd": math.sqrt(variance)}


def recalculate(calc):
    """Recompute synthetic examples without executing content-supplied expressions."""
    x = calc["inputs"]
    method = calc["method"]
    if method == "expected_return":
        return {"return": moments(x["returns"], x["probabilities"])["mean"]}
    if method == "holding_return":
        require(x["start"] > 0, "Nonpositive initial price")
        return {"return": (x["end"] - x["start"] + x["distribution"]) / x["start"]}
    if method == "compound_return":
        return {"return": math.prod(1 + r for r in x["returns"]) - 1}
    if method == "currency_return":
        return {"return": (1 + x["asset_return"]) * (1 + x["currency_return"]) - 1}
    if method == "sqrt_variance":
        return {"sd": math.sqrt(x["variance"])}
    if method == "distribution_moments":
        return moments(x["returns"], x["probabilities"])
    if method == "compare_distributions":
        result = {}
        for key in ("a", "b"):
            result[key + "_sd"] = moments(x[key], x["probabilities"])["sd"]
            result[key + "_loss_probability"] = sum(
                p for p, r in zip(x["probabilities"], x[key]) if r < 0
            )
        return result
    if method == "normal_coverage":
        return {"probability": math.erf(x["standard_deviations"] / math.sqrt(2))}
    if method == "portfolio_return":
        require(math.isclose(sum(x["weights"]), 1), "Weights must sum to one")
        require(len(x["weights"]) == len(x["returns"]), "Mismatched weights")
        return {"return": sum(w * r for w, r in zip(x["weights"], x["returns"]))}
    if method == "two_asset_sd":
        a, b = x["weights"]
        sa, sb = x["sds"]
        require(math.isclose(a + b, 1), "Weights must sum to one")
        require(-1 <= x["correlation"] <= 1, "Invalid correlation")
        variance = (a * sa) ** 2 + (b * sb) ** 2 + 2 * a * b * sa * sb * x["correlation"]
        return {"variance": variance, "sd": math.sqrt(variance)}
    if method == "weight_drift":
        risky_end = x["risky_start"] * (1 + x["risky_return"])
        return {"risky_weight": risky_end / (risky_end + x["cash"])}
    if method == "beta":
        require(x["market_variance"] > 0, "Market variance must be positive")
        return {"beta": x["covariance"] / x["market_variance"]}
    if method == "capm":
        premium = x["market_return"] - x["risk_free"]
        return {"premium": premium, "return": x["risk_free"] + x["beta"] * premium}
    if method == "leveraged_return":
        require(x["equity"] > 0, "Equity must be positive")
        end_assets = (x["equity"] + x["debt"]) * (1 + x["asset_return"])
        end_equity = end_assets - x["debt"]
        return {"end_assets": end_assets, "end_equity": end_equity,
                "equity_return": end_equity / x["equity"] - 1}
    raise ValueError(f"Unknown calculation method: {method}")


def review_markdown(bank):
    lines = ["# بانک سؤال‌وجواب روزانهٔ مدیریت ریسک", "",
             f"نسخه: `{bank['content_version']}` · بررسی منابع: {bank['researched_on']}", "",
             "۳۰ پرسش تألیفی، در شش بخشِ پنج‌تایی. پاسخ، درس کوتاه و نکتهٔ پایانی برای قرارگرفتن در اسپویلر آماده شده‌اند.", "",
             "این فایل نسخهٔ خواندنی بانک JSON است؛ برنامهٔ ارسال یا اتصال به تلگرام نیست. همهٔ مثال‌های عددی فرضی‌اند.", "",
             "موارد «تکمیلی» به موضوع درس مرتبط‌اند، اما جزئیاتشان الزاماً در متن فعلی سایت نیست. دکمهٔ مطالعه فعلاً صفحهٔ کل دوره را باز می‌کند.", ""]
    lessons = {lesson["id"]: lesson["title_fa"] for lesson in bank["lessons"]}
    last_lesson = None
    for item in bank["items"]:
        if item["lesson_id"] != last_lesson:
            lines += [f"## {lessons[item['lesson_id']]}", ""]
            last_lesson = item["lesson_id"]
        scope = "محتوای اصلی دوره" if item["scope"] == "course_core" else "تکمیلی"
        level = "مقدماتی" if item["difficulty"] == "basic" else "میانی"
        lines += [f"### {item['sequence']}. {item['title_fa']}", "",
                  f"`{item['id']}` · {scope} · سطح {level}", "",
                  f"**سؤال:** {item['question_fa']}", "",
                  "<details>", "<summary>مشاهدهٔ پاسخ و درس کوتاه</summary>", "",
                  f"**پاسخ:** {item['answer_fa']}", "",
                  f"**درس کوتاه:** {item['explanation_fa']}", "",
                  f"**یادت بماند:** {item['takeaway_fa']}", "", "</details>", ""]
        for ref in item["source_refs"]:
            source = bank["sources"][ref["source_id"]]
            lines += [f"منبع: [{source['publisher']} — {source['title']}]({source['url']})؛ {ref['supports_fa']}.", ""]
    lines += ["## فهرست منابع بررسی‌شده", ""]
    for source_id, source in bank["sources"].items():
        lines += [f"- `{source_id}` — [{source['publisher']}: {source['title']}]({source['url']}). بخش: {'; '.join(source['sections'])}. بررسی: {source['checked_on']}."]
    return "\n".join(lines) + "\n"


def validate(bank):
    require(bank["schema_version"] == "1.0", "Unsupported schema")
    items, sources = bank["items"], bank["sources"]
    require(len(items) == 30, "First edition must contain 30 items")
    require(len({i["id"] for i in items}) == len(items), "Duplicate IDs")
    require([i["sequence"] for i in items] == list(range(1, 31)), "Invalid sequence")
    lesson_ids = {lesson["id"] for lesson in bank["lessons"]}
    course = (ROOT / "front2/lib/learning-content.mjs").read_text(encoding="utf-8")
    course_lessons = course.split("export const riskLessons = [", 1)[1].split("// Each distractor", 1)[0]
    require(lesson_ids == set(re.findall(r'id: "([a-z]+)"', course_lessons)), "Course lesson mismatch")
    require(dict(Counter(i["lesson_id"] for i in items)) == dict.fromkeys(lesson_ids, 5), "Lesson coverage mismatch")
    require(bank["course_content_version"] in course, "Course version mismatch")
    require((ROOT / "front2/app" / bank["course_path"].lstrip("/") / "page.jsx").is_file(), "Course route missing")
    used_sources, source_words = set(), Counter()
    lengths, numerical = [], 0
    for source_id, source in sources.items():
        url = urlparse(source["url"])
        require(url.scheme == "https" and url.netloc, f"Invalid source URL: {source_id}")
        require(source["sections"] and source["checked_on"] == bank["researched_on"], f"Incomplete source: {source_id}")
    for item in items:
        require(item["scope"] in ("course_core", "course_extension"), "Invalid scope")
        require(item["difficulty"] in ("basic", "intermediate"), "Invalid difficulty")
        for field in TEXT_FIELDS:
            value = item[field]
            require(value.strip() and "\ufffd" not in value and "???" not in value, f"Damaged text: {item['id']}")
            require(not re.search(r"<[^>]*>", value), f"Content must remain plain text: {item['id']}")
        require(item["question_fa"].endswith("؟"), f"Question punctuation: {item['id']}")
        require(item["source_refs"], f"No source: {item['id']}")
        text = " ".join(item[field] for field in TEXT_FIELDS)
        for ref in item["source_refs"]:
            require(ref["source_id"] in sources and ref["supports_fa"], f"Invalid citation: {item['id']}")
            used_sources.add(ref["source_id"])
            source_words[ref["source_id"]] += len((text + " " + item["title_fa"] + " " + ref["supports_fa"]).split())
        # A conservative payload size estimate, including escaped text, source URLs and spoiler markup.
        payload = escape(item["question_fa"]) + "\n<tg-spoiler>" + "\n".join(
            escape(item[field]) for field in TEXT_FIELDS[1:]
        ) + "</tg-spoiler>" + "\n" + "\n".join(sources[r["source_id"]]["url"] for r in item["source_refs"])
        length = len(payload.encode("utf-16-le")) // 2
        lengths.append(length)
        require(length < 3500, f"Post too long: {item['id']}")
        if item["calculation"] is not None:
            numerical += 1
            calc = item["calculation"]
            actual = recalculate(calc)
            require(actual.keys() == calc["expected"].keys(), f"Calculation fields mismatch: {item['id']}")
            for name, expected in calc["expected"].items():
                require(math.isclose(actual[name], expected, rel_tol=1e-10, abs_tol=1e-12), f"Wrong example: {item['id']} {name}")
            for display in calc["display_checks"]:
                require(display in text, f"Display no longer matches reviewed example: {item['id']}")
    require(used_sources == sources.keys(), "Unused sources in catalog")
    # Keep total authored paraphrase attributed to any one reviewed page short.
    require(max(source_words.values()) <= 200, f"Source summary budget exceeded: {source_words.most_common(1)}")
    # Cross-check probability variance against the stdlib, distinguishing it from sample variance.
    require(math.isclose(statistics.pvariance([0, 0.2]), 0.01), "Population check failed")
    require(math.isclose(statistics.variance([0, 0.2]), 0.02), "Sample check failed")
    return {"items": len(items), "numerical_examples": numerical,
            "sources": len(sources), "publishers": len({s["publisher"] for s in sources.values()}),
            "max_payload_utf16_units": max(lengths), "max_source_summary_words": max(source_words.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-preview", action="store_true", help="Regenerate the local Markdown review copy")
    args = parser.parse_args()
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    report = validate(bank)
    preview = review_markdown(bank)
    if args.write_preview:
        PREVIEW.parent.mkdir(parents=True, exist_ok=True)
        PREVIEW.write_text(preview, encoding="utf-8", newline="\n")
    require(PREVIEW.is_file() and PREVIEW.read_text(encoding="utf-8") == preview, "Preview is stale; run --write-preview")
    print(json.dumps({"status": "passed", **report}, indent=2))


if __name__ == "__main__":
    main()
