"""Calendar-aligned comparisons. All formulas and narrative facts live here."""
from calendar import monthrange
from datetime import date
import math
from statistics import correlation, StatisticsError

from ...models.market_comparison import (
    ComparisonPoint, ComparisonRequest, ComparisonResponse, ComparisonSeries,
    RelationshipAxis, RelationshipPlot, RelationshipPoint,
)
from .definitions import DEFINITIONS

MIN_CORRELATION_RETURNS = 20


def period_start(end, period):
    if period == "MAX":
        return None
    months = int(period[:-1]) * (12 if period.endswith("Y") else 1)
    index = end.year * 12 + end.month - 1 - months
    year, month = divmod(index, 12)
    return date(year, month + 1, min(end.day, monthrange(year, month + 1)[1]))


def relationship_axis(item, currency):
    unit = item.unit
    if item.kind == "asset" and item.currency == "USD" and currency == "IRR":
        unit = unit.replace("دلار", "ریال")
    return RelationshipAxis(symbol_id=item.id, label=item.label, unit=unit,
        currency=currency if item.kind == "asset" else None)


def build_comparison(request: ComparisonRequest, sources: dict, *, today: date, fx=None):
    unknown = set(request.symbols) - set(DEFINITIONS)
    if unknown:
        raise ValueError("Unsupported comparison symbol")
    start = period_start(today, request.period)
    response = ComparisonResponse(period=request.period, view=request.view, currency=request.currency,
        requested_start=start.isoformat() if start else None, requested_end=today.isoformat(),
        status="unavailable", series=[], summary_fa="برای این انتخاب و بازه، داده مشترک کافی موجود نیست.")
    maps = {}
    for key in request.symbols:
        definition = DEFINITIONS[key]
        source = sources.get(key)
        points = source["data"] if source else []
        latest = points[-1]["date"] if points else None
        stale = bool(source and (source.get("cache_stale") or (today - date.fromisoformat(latest)).days > 7))
        item = ComparisonSeries(id=key, label=definition["label"], kind=definition["kind"],
            currency=definition["currency"], return_basis=definition["return_basis"], unit=definition["unit"],
            source=source["source"] if source else "", source_url=source["source_url"] if source else "",
            source_series_id=definition["series"], note=definition["note"],
            status="stale" if stale else "available" if source else "unavailable",
            reason=None if source else "منبع معتبر در دسترس نیست؛ داده جایگزین ساخته نشده است.",
            retrieved_at=source.get("retrieved_at") if source else None,
            history_start=points[0]["date"] if points else None, observation_date=latest)
        response.series.append(item)
        if source:
            maps[key] = {point["date"]: point["value"] for point in points if (start is None or point["date"] >= start.isoformat()) and point["date"] <= today.isoformat()}
            if not maps[key]:
                item.status = "unavailable"
                item.reason = "تاریخچه منبع بازه انتخابی را پوشش نمی‌دهد."
            if stale:
                response.warnings.append(f"{item.label}: داده یا حافظه ذخیره‌شده قدیمی است؛ آخرین مشاهده {latest}.")
            if source.get("packaged_snapshot"):
                response.warnings.append(f"{item.label}: تازه‌سازی زنده موفق نشد؛ تاریخچه واقعیِ ذخیره‌شده از TSETMC نمایش داده می‌شود. تاریخ دریافت: {source['retrieved_at'][:10]}.")
            if start and item.history_start > start.isoformat():
                response.warnings.append(f"{item.label}: تاریخچه از {item.history_start} شروع می‌شود و ابتدای بازه انتخابی را پوشش نمی‌دهد.")
            if source.get("invalid_rows"):
                response.warnings.append(f"{item.label}: {source['invalid_rows']} مشاهده نامعتبر یا مفقود منبع کنار گذاشته شده است.")
    assets = [item for item in response.series if item.kind == "asset"]
    bases = {item.return_basis for item in assets}
    if request.view == "performance" and any(item.kind != "asset" for item in response.series):
        response.status = "incompatible"
        response.summary_fa = "نمودار اصلی فقط برای دارایی‌هاست. شاخص دلار و نرخ بهره را در بخش روابط دو بازار انتخاب کنید."
        return response
    if len(bases) > 1:
        response.status = "incompatible"
        response.summary_fa = "مبنای سود نقدی یکسان نیست: شاخص کل و هم‌وزن ایران با سود نقدی‌اند، اما شاخص‌های قیمت و طلا بدون سود نقدی. برای مقایسه ایران با طلا، «شاخص قیمت بورس ایران» را انتخاب کنید."
        return response
    need_fx = any(item.currency != request.currency for item in assets)
    fx_map = None
    if need_fx:
        if not fx or fx.get("unit") != "IRR_per_USD":
            response.status = "incompatible"
            response.summary_fa = "مقایسه به تاریخچه تأییدشده دلار آزاد نیاز دارد تا هر دو بازار روی مبنای پولی مشترک قرار گیرند. این تاریخچه هنوز در دسترس نیست."
            response.warnings.append("قیمت دلاری طلا با شاخص ریالی بدون تبدیل ارز مقایسه نمی‌شود.")
            return response
        fx_map = {point["date"]: point["value"] for point in fx["data"] if point["value"] > 0}
        response.fx_source = fx["source"]
        response.fx_observation_date = fx["data"][-1]["date"]
        if fx.get("cache_stale") or (today - date.fromisoformat(response.fx_observation_date)).days > 7:
            response.warnings.append(f"تاریخچه ارز قدیمی است؛ آخرین مشاهده {response.fx_observation_date}.")
    # A missing selected series is never silently replaced by another instrument.
    present = [key for key in request.symbols if maps.get(key)]
    if request.view == "relationship" and len(present) != 2:
        return response
    if not present:
        return response
    common = set(maps[present[0]])
    for key in present[1:]:
        common.intersection_update(maps[key])
    if fx_map is not None:
        common.intersection_update(fx_map)
    days = sorted(common)
    if len(days) < 2:
        response.correlation_reason = "کمتر از دو تاریخ مشترک در بازه انتخابی وجود دارد."
        return response
    response.start_date, response.end_date = days[0], days[-1]
    response.common_observations = len(days)
    response.status = "available" if len(present) == len(request.symbols) else "partial"
    raw = {}
    for item in response.series:
        if item.id not in present:
            continue
        values = [maps[item.id][day] for day in days]
        if item.kind == "asset" and item.currency != request.currency:
            values = [value / fx_map[day] if item.currency == "IRR" else value * fx_map[day] for day, value in zip(days, values)]
        raw[item.id] = values
        if item.kind != "rate" and values[0] <= 0:
            response.status = "unavailable"
            response.summary_fa = "مقدار آغازین غیرمثبت است؛ مبناگذاری ۱۰۰ و محاسبه تغییر درصدی برای این بازه معتبر نیست."
            for series in response.series:
                series.data = []
            return response
        if item.kind == "rate":
            display = values
            item.change_bp = (values[-1] - values[0]) * 100
        else:
            display = [value / values[0] * 100 for value in values]
            item.change_pct = (values[-1] / values[0] - 1) * 100
        item.data = [ComparisonPoint(date=day, value=value) for day, value in zip(days, display)]
        item.observations = len(days)
    ranked = [item for item in response.series if item.kind == "asset" and item.change_pct is not None]
    # No ranking of a partial selection or when an index includes a nonpositive close.
    if response.status == "available" and all(all(value > 0 for value in raw[item.id]) for item in ranked):
        response.ranking = [item.id for item in sorted(ranked, key=lambda item: item.change_pct, reverse=True)]
    facts = []
    for item in response.series:
        if item.change_pct is not None:
            facts.append(f"{item.label}: {item.change_pct:+.2f}٪ تغییر")
        elif item.change_bp is not None:
            facts.append(f"{item.label}: {item.change_bp:+.1f} واحد پایه تغییر")
    response.summary_fa = f"از {days[0]} تا {days[-1]}، بر اساس {len(days)} مشاهده در تاریخ‌های مشترک: " + "؛ ".join(facts) + "."
    if response.status == "partial":
        response.summary_fa += " داده بعضی نمادهای انتخابی موجود نیست؛ رتبه‌بندی انجام نشده است."
    if response.ranking and len(response.ranking) >= 2:
        leader = next(item for item in ranked if item.id == response.ranking[0])
        response.summary_fa += f" بیشترین تغییر در این مجموعه مربوط به {leader.label} است."
    if request.view == "relationship":
        a, b = response.series
        # Each XY observation uses the same date and the already converted raw
        # levels. The time-series chart's base-100 display values are not reused.
        response.relationship = RelationshipPlot(
            x_axis=relationship_axis(b, request.currency),
            y_axis=relationship_axis(a, request.currency),
            points=[RelationshipPoint(date=day, x=x, y=y)
                    for day, x, y in zip(days, raw[b.id], raw[a.id])],
        )
        if a.change_pct is not None and b.change_pct is not None:
            gap = a.change_pct - b.change_pct
            response.summary_fa += f" فاصله تغییر درصدی {a.label} نسبت به {b.label} برابر {gap:+.2f} واحد درصد است."
        changes = []
        nonpositive = False
        for item in (a, b):
            values = raw[item.id]
            if item.kind == "rate":
                changes.append([(right - left) * 100 for left, right in zip(values, values[1:])])
            elif any(value <= 0 for value in values):
                nonpositive = True
                changes.append([])
            else:
                changes.append([right / left - 1 for left, right in zip(values, values[1:])])
        response.correlation_samples = len(days) - 1 if not nonpositive else 0
        if nonpositive:
            response.correlation_reason = "وجود قیمت صفر یا منفی، همبستگی بازده درصدی را نامعتبر می‌کند."
        elif response.correlation_samples < MIN_CORRELATION_RETURNS:
            response.correlation_reason = f"حداقل {MIN_CORRELATION_RETURNS} تغییر در تاریخ‌های مشترک لازم است."
        else:
            try:
                value = correlation(*changes)
                if math.isfinite(value):
                    response.correlation = max(-1.0, min(1.0, value))
                else:
                    raise StatisticsError
            except StatisticsError:
                response.correlation_reason = "یکی از سری‌های تغییرات در این بازه ثابت است."
        if response.correlation is not None:
            response.summary_fa += f" همبستگی تغییرات در {response.correlation_samples} فاصله مشترک برابر {response.correlation:.2f} است؛ این عدد رابطه علّی یا پیش‌بینی را اثبات نمی‌کند."
            if response.correlation > 0:
                response.summary_fa += " علامت مثبت، هم‌جهتی تغییرات را نشان می‌دهد؛ هرچه قدرمطلق ضریب به صفر نزدیک‌تر باشد، رابطه خطی ضعیف‌تر است."
            elif response.correlation < 0:
                response.summary_fa += " علامت منفی، خلاف‌جهتی تغییرات را نشان می‌دهد؛ هرچه قدرمطلق ضریب به صفر نزدیک‌تر باشد، رابطه خطی ضعیف‌تر است."
        else:
            response.summary_fa += " همبستگی قابل گزارش نیست: " + (response.correlation_reason or "داده ناکافی")
    response.warnings.append("روزهای بدون مشاهده حذف شده‌اند؛ پرکردن فاصله‌ها انجام نشده است. بسته‌شدن بازارها در یک تاریخ الزاماً هم‌زمان نیست؛ تغییرات بین دو تاریخ مشترک ممکن است چند روز را پوشش دهند.")
    return ComparisonResponse.model_validate(response.model_dump())
