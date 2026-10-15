"""Versioned, read-only status cards. No LLM and no browser financial formulas."""

from concurrent.futures import ThreadPoolExecutor, wait
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from math import isfinite
from statistics import quantiles
from threading import Lock
from time import time
from zoneinfo import ZoneInfo

import httpx
from pydantic import BaseModel, Field

from .economic_calendar import fetch_upcoming_us_events
from .llm_engine.schemas import MarketStatusSummary
from .market_analysis_context import YAHOO_CHART_URL
from .official_sentiment import SOURCE_CONFIG, official_sentiment_service

METHOD_VERSION = "1.0.0"
REFRESH_SECONDS = 60
REFERENCE_SESSIONS = 252
MIN_REFERENCE_SESSIONS = 126
MAX_QUOTE_AGE = timedelta(minutes=20)
MAX_ANALYSIS_AGE = timedelta(hours=36)
NY = ZoneInfo("America/New_York")
_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="market-status")
_input_lock = Lock()


class StatusCardDetail(BaseModel):
    explanation_fa: str
    method_fa: str
    sources: list[dict] = Field(default_factory=list)
    measurements: dict = Field(default_factory=dict)


class MarketStatusData(BaseModel):
    method_version: str = METHOD_VERSION
    calculated_at: datetime
    refresh_seconds: int = REFRESH_SECONDS
    summary: MarketStatusSummary
    details: dict[str, StatusCardDetail]


class MarketStatusResponse(BaseModel):
    ok: bool = True
    data: MarketStatusData


def _number(value):
    if isinstance(value, bool):
        return None
    try:
        value = float(value)
        return value if isfinite(value) else None
    except (TypeError, ValueError):
        return None


def _datetime(value):
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result if result.tzinfo is not None else result.replace(tzinfo=UTC)
    except (TypeError, ValueError):
        return None


def _series(points, now):
    """Sorted unique dated observations; future and malformed points are excluded."""
    result = {}
    for item in points or []:
        if not isinstance(item, dict):
            continue
        try:
            day = datetime.fromisoformat(str(item["date"])[:10]).date()
        except (KeyError, ValueError):
            continue
        value = _number(item.get("value"))
        if value is not None and day <= now.astimezone(NY).date():
            result[day.isoformat()] = value
    return [{"date": day, "value": value} for day, value in sorted(result.items())]


def _fresh(points, days, now):
    return bool(points) and (now.astimezone(NY).date() - datetime.fromisoformat(points[-1]["date"]).date()).days <= days


def _source(payload, fallback, observation=None):
    payload = payload if isinstance(payload, dict) else {}
    metadata = payload.get("metadata") or {}
    metadata = metadata if isinstance(metadata, dict) else {}
    return {"name": metadata.get("source", fallback), "url": metadata.get("source_url"),
            "observed_at": observation or metadata.get("observation_date") or metadata.get("latest_date"),
            "frequency": metadata.get("frequency"), "quality": metadata.get("quality_status", "unavailable")}


def _detail(explanation, method, sources=(), **measurements):
    return StatusCardDetail(explanation_fa=explanation, method_fa=method, sources=list(sources), measurements=measurements)


def _tercile(value, history):
    """Inclusive linear empirical terciles; no assumed normal distribution."""
    if len(history) < MIN_REFERENCE_SESSIONS:
        return "unknown", None
    lower, upper = quantiles(history[-REFERENCE_SESSIONS:], n=3, method="inclusive")
    if lower >= upper:
        return "unknown", None
    return ("low" if value <= lower else "medium" if value <= upper else "high"), {"lower": lower, "upper": upper}


def daily_intensity(payload, now):
    method = "دامنه واقعی امروز، شامل شکاف با بسته‌شدن قبلی، به درصد قیمت قبلی؛ مقایسه با سهک‌های ۲۵۲ جلسه کامل گذشته (حداقل ۱۲۶ جلسه). جهت رشد یا افت دخالت ندارد."
    unknown = lambda reason: ("unknown", _detail(reason, method, [{"name": "Yahoo Finance · ^GSPC", "url": "https://finance.yahoo.com/quote/%5EGSPC/", "quality": "unavailable"}]))
    try:
        result = payload["chart"]["result"][0]
        quote = result["indicators"]["quote"][0]
        meta = result.get("meta", {})
        if meta.get("symbol") != "^GSPC" or payload["chart"].get("error"):
            return unknown("شناسه یا پاسخ منبع قیمت S&P 500 تأیید نشده است.")
        bars = {}
        invalid_dates = set()
        for index, timestamp in enumerate(result.get("timestamp", [])):
            observed = datetime.fromtimestamp(timestamp, UTC)
            if observed > now:
                continue
            day = observed.astimezone(NY).date().isoformat()
            values = [_number((quote.get(field) or [])[index]) if index < len(quote.get(field) or []) else None for field in ("open", "high", "low", "close")]
            if any(value is None or value <= 0 for value in values):
                invalid_dates.add(day)
                continue
            opening, high, low, close = values
            if not low <= min(opening, close) <= max(opening, close) <= high:
                invalid_dates.add(day)
                continue
            bars[day] = {"high": high, "low": low, "close": close}
        ordered = sorted(set(bars) | invalid_dates)
        today = now.astimezone(NY).date().isoformat()
        history, previous = [], None
        current_tr = None
        for day in ordered:
            if day in invalid_dates or day not in bars:
                previous = None
                continue
            bar = bars[day]
            tr = max(bar["high"] - bar["low"], abs(bar["high"] - previous), abs(bar["low"] - previous)) / previous * 100 if previous else None
            if day == today:
                current_tr = tr
            elif day < today and tr is not None:
                history.append(tr)
            previous = bar["close"]
        if today not in bars:
            return unknown("برای جلسه امروز داده قیمت موجود نیست؛ حرکت جلسه قبل به‌عنوان امروز نمایش داده نمی‌شود.")
        observed = datetime.fromtimestamp(meta["regularMarketTime"], UTC)
        if observed > now or observed.astimezone(NY).date().isoformat() != today:
            return unknown("زمان آخرین قیمت با جلسه امروز سازگار نیست.")
        regular = (meta.get("currentTradingPeriod") or {}).get("regular") or {}
        start = datetime.fromtimestamp(regular["start"], UTC) if "start" in regular else now.astimezone(NY).replace(hour=9, minute=30, second=0, microsecond=0)
        end = datetime.fromtimestamp(regular["end"], UTC) if "end" in regular else now.astimezone(NY).replace(hour=16, minute=0, second=0, microsecond=0)
        if start.astimezone(NY).date().isoformat() != today or now < start:
            return unknown("جلسه عادی امروز هنوز آغاز نشده یا زمان جلسه تأیید نشده است.")
        if now < end and now - observed > MAX_QUOTE_AGE:
            return unknown("قیمت در جلسه جاری بیش از ۲۰ دقیقه قدیمی است.")
        if now >= end and observed < end - MAX_QUOTE_AGE:
            return unknown("آخرین قیمت، پایان جلسه امروز را پوشش نمی‌دهد.")
        if current_tr is None:
            return unknown("بسته‌شدن معتبر جلسه قبل موجود نیست؛ شدت محاسبه نشد.")
        state, thresholds = _tercile(current_tr, history)
        if state == "unknown":
            return unknown("تاریخچه کافی و دارای پراکندگی برای تعیین آستانه‌های شدت موجود نیست.")
        source = {"name": "Yahoo Finance · ^GSPC", "url": "https://finance.yahoo.com/quote/%5EGSPC/", "observed_at": observed.isoformat(), "frequency": "daily OHLC, updated intraday", "quality": "available"}
        text = "مقایسه دامنه واقعی امروز با توزیع تاریخی خود شاخص؛ " + ("موقت تا پایان جلسه و قابل تغییر با قیمت تازه." if now < end else "بر اساس آخرین داده جلسه امروز.")
        return state, _detail(text, method, [source], true_range_pct=current_tr, thresholds_pct=thresholds, reference_count=min(len(history), REFERENCE_SESSIONS), provisional=now < end)
    except (KeyError, IndexError, TypeError, ValueError, OverflowError, OSError, AttributeError):
        return unknown("داده معتبر و زمان‌دار قیمت S&P 500 در دسترس نیست.")


def sentiment_status(aaii, cftc, now):
    method = "هم‌جهتی گروه غالب در نظرسنجی هفتگی AAII و تغییر هفتگی خالص موقعیت مدیران دارایی S&P 500 در CFTC؛ اختلاف یا نبود جهت مشترک، خنثی است. تغییر قیمت شاخص در این قاعده استفاده نمی‌شود."
    aaii = aaii if isinstance(aaii, dict) else {}
    cftc = cftc if isinstance(cftc, dict) else {}
    survey_series = aaii.get("series") or {}
    survey_series = survey_series if isinstance(survey_series, dict) else {}
    surveys = {name: _series(survey_series.get(name, []), now) for name in ("bullish", "neutral", "bearish")}
    positions = _series(cftc.get("data", []), now)
    sources = [_source(aaii, "AAII", surveys["bullish"][-1]["date"] if surveys["bullish"] else None),
               _source(cftc, "CFTC", positions[-1]["date"] if positions else None)]
    if not all(_fresh(points, SOURCE_CONFIG["aaii_bull_bear_spread"]["stale_days"], now) for points in surveys.values()) or not _fresh(positions, SOURCE_CONFIG["cftc_sp500_positioning"]["stale_days"], now) or len(positions) < 2:
        return "unknown", _detail("برای جمع‌بندی جهت انتظارات، هر دو شاهد هفتگی معتبر و به‌روز لازم است.", method, sources), False
    latest = [points[-1] for points in surveys.values()]
    values = [item["value"] for item in latest]
    gap = (datetime.fromisoformat(positions[-1]["date"]) - datetime.fromisoformat(positions[-2]["date"])).days
    if len({item["date"] for item in latest}) != 1 or any(value < 0 or value > 100 for value in values) or abs(sum(values) - 100) > 1 or not 4 <= gap <= 14:
        return "unknown", _detail("تاریخ یا قرارداد داده‌های نظرسنجی و موقعیت‌ها قابل مقایسه نیست.", method, sources), False
    bull, neutral, bear = values
    survey = 1 if bull > max(neutral, bear) else -1 if bear > max(neutral, bull) else 0
    delta = positions[-1]["value"] - positions[-2]["value"]
    positioning = 1 if delta > 0 else -1 if delta < 0 else 0
    state = "risk_on" if survey == positioning == 1 else "risk_off" if survey == positioning == -1 else "neutral"
    conflict = survey != 0 and positioning != 0 and survey != positioning
    explanation = "انتظارات پاسخ‌دهندگان و تغییر موقعیت مدیران دارایی هم‌جهت‌اند." if state != "neutral" else "شواهد جهت مشترکی ندارند؛ خنثی به معنای نبود ریسک نیست."
    return state, _detail(explanation + " این نما هفتگی است و پیش‌بینی بازده نیست.", method, sources, aaii_dominant=survey, asset_manager_net_change=delta, conflicting=conflict), conflict


def build_market_status(snapshot, inputs, now=None):
    now = now or datetime.now(UTC)
    snapshot = snapshot if isinstance(snapshot, dict) else {}
    inputs = inputs if isinstance(inputs, dict) else {}
    intensity, intensity_detail = daily_intensity(inputs.get("prices"), now)
    sentiment, sentiment_detail, sentiment_conflict = sentiment_status(inputs.get("aaii"), inputs.get("cftc"), now)
    volatility = inputs.get("vix") if isinstance(inputs.get("vix"), dict) else {}
    vol_series = volatility.get("series") or {}
    vol_series = vol_series if isinstance(vol_series, dict) else {}
    today = now.astimezone(NY).date().isoformat()
    completed = lambda points: [point for point in _series(points, now) if point["value"] > 0 and (point["date"] < today or now.astimezone(NY).hour >= 16)]
    vix_points = completed(vol_series.get("vix", []))
    vix_fresh = _fresh(vix_points, SOURCE_CONFIG["vix_term_structure"]["stale_days"], now)
    vix_level, vix_thresholds = _tercile(vix_points[-1]["value"], [item["value"] for item in vix_points[:-1]]) if vix_fresh else ("unknown", None)
    generated = _datetime(snapshot.get("analysis_generated_at"))
    analysis_fresh = bool(generated and timedelta(0) <= now - generated <= MAX_ANALYSIS_AGE)
    short = {point["date"]: point["value"] for point in completed(vol_series.get("vix9d", []))}
    longer = {point["date"]: point["value"] for point in completed(vol_series.get("vix3m", []))}
    common = sorted(set(short) & set(longer))
    term_date = common[-1] if common else None
    term_ready = bool(term_date and (now.astimezone(NY).date() - datetime.fromisoformat(term_date).date()).days <= SOURCE_CONFIG["vix_term_structure"]["stale_days"])
    inverted = term_ready and short[term_date] > longer[term_date]
    events = inputs.get("events")
    if not isinstance(events, list) or any(not isinstance(event, dict) or not _datetime(event.get("release_at")) for event in events):
        events = None
    imminent = []
    for event in events or []:
        release = _datetime(event.get("release_at"))
        if release and timedelta(0) <= release - now <= timedelta(hours=24) and event.get("importance") == "high":
            imminent.append(event)
    risk = "high" if vix_level == "high" or inverted else "unknown" if vix_level == "unknown" or events is None or not term_ready else "medium" if vix_level == "medium" or imminent else "low"
    risk_sources = [_source(volatility, "Cboe VIX", vix_points[-1]["date"] if vix_points else None)]
    risk_sources.append({"name": "Cboe VIX9D / VIX3M", "url": _source(volatility, "Cboe").get("url"),
                         "observed_at": term_date, "frequency": "daily", "quality": "available" if term_ready else "unavailable"})
    if events is not None:
        risk_sources.append({"name": "تقویم اقتصادی موجود سایت", "observed_at": now.isoformat(), "frequency": "event calendar", "quality": "available"})
    risk_reasons = [text for active, text in ((vix_level == "high", "VIX در یک‌سوم بالای سابقه خودش است"), (inverted, "نوسان مورد انتظار ۹روزه از سه‌ماهه بیشتر است"), (bool(imminent), "رویداد اقتصادی مهم در ۲۴ ساعت آینده پیش‌رو است")) if active]
    risk_detail = _detail(("؛ ".join(risk_reasons) or "نوسان مورد انتظار و ساختار زمانی با سطح نسبی ریسک فعلی سازگارند") + ". تعداد اخبار ملاک نیست و این کارت ریسک جاری را می‌سنجد." if risk != "unknown" else "بخشی از شواهد نوسان، ساختار زمانی یا تقویم کافی و تازه نیست؛ ریسک کم فرض نشده است.",
        "سطح نسبی VIX در سهک‌های ۲۵۲ مشاهده قبلی؛ رویداد مهم ۲۴ ساعت آینده کف متوسط ایجاد می‌کند؛ VIX در سهک بالا یا VIX9D بالاتر از VIX3M در تاریخ مشترک، کف زیاد. نبود ورودی لازم: نامشخص.", risk_sources,
        vix_tercile=vix_level, vix_value=vix_points[-1]["value"] if vix_points else None, vix_thresholds=vix_thresholds, term_structure_date=term_date, inverted=bool(inverted), imminent_events=[{"title_fa": item.get("title_fa"), "release_at": item.get("release_at")} for item in imminent])
    condition = "unknown" if sentiment == "unknown" or risk == "unknown" else "favorable" if sentiment == "risk_on" and risk == "low" else "challenging" if sentiment == "risk_off" and risk == "high" else "mixed"
    sentiment_fa = {"risk_on": "مثبت", "neutral": "خنثی", "risk_off": "منفی", "unknown": "نامشخص"}[sentiment]
    risk_fa = {"low": "کم", "medium": "متوسط", "high": "زیاد", "unknown": "نامشخص"}[risk]
    condition_detail = _detail(f"جهت شواهد انتظارات {sentiment_fa} و ریسک جاری {risk_fa} است؛ این جمع‌بندیِ وضعیت فعلی است، نه پیش‌بینی بازده یا جایگزین افق‌های تحلیل متنی.",
        "مساعد: انتظارات مثبت و ریسک کم؛ پرچالش: انتظارات منفی و ریسک زیاد؛ سایر ترکیب‌های معتبر: ترکیبی؛ نبود شاهد لازم: نامشخص.", [*sentiment_detail.sources, *risk_sources])
    source_stale = any(_source(inputs.get(key), key)["quality"] == "stale" for key in ("vix", "aaii", "cftc"))
    coverage = snapshot.get("coverage")
    coverage = coverage if isinstance(coverage, dict) else {}
    price_ready = any(source.get("quality") == "available" for source in intensity_detail.sources)
    # A closed/not-yet-open session is an expected absence, not a quote outage.
    if not price_ready and inputs.get("prices"):
        try:
            result = inputs["prices"]["chart"]["result"][0]
            meta = result["meta"]
            observed = datetime.fromtimestamp(meta["regularMarketTime"], UTC)
            next_start = datetime.fromtimestamp(meta["currentTradingPeriod"]["regular"]["start"], UTC)
            prior_close = _number(result["indicators"]["quote"][0]["close"][-1])
            price_ready = (meta.get("symbol") == "^GSPC" and prior_close is not None and prior_close > 0
                and observed.astimezone(NY).date() < now.astimezone(NY).date()
                and (now < next_start or now.astimezone(NY).weekday() >= 5)
                and timedelta(0) <= now - observed <= timedelta(days=5))
        except (KeyError, IndexError, TypeError, ValueError, OSError):
            pass
    confidence = "low" if not analysis_fresh or not price_ready or sentiment == "unknown" or risk == "unknown" or vix_level == "unknown" or events is None or not term_ready or (_number(coverage.get("available_count")) or 0) <= 0 or not snapshot.get("data_as_of") else "high" if coverage.get("status") == "full" and coverage.get("ratio") == 1 and not source_stale and not sentiment_conflict and not coverage.get("missing_inputs") else "medium"
    if snapshot.get("data_as_of"):
        source_date = _datetime(str(snapshot["data_as_of"])[:10])
        if source_date is None or not timedelta(0) <= now - source_date <= timedelta(days=5):
            confidence = "low"
    confidence_detail = _detail("این برچسب کفایت، تازگی و سازگاری داده‌های پشتیبان را بیان می‌کند؛ احتمال درست بودن پیش‌بینی نیست.",
        "کم: ورودی ضروری غایب/قدیمی یا تحلیل بدون پوشش معتبر؛ زیاد: ورودی‌های تازه، پوشش کامل و بدون تعارض؛ متوسط: ورودی ضروری موجود اما پوشش ناقص، تعارض یا منبع کش‌شده نامطمئن.",
        [{"name": "کیفیت و پوشش snapshot تحلیل", "observed_at": generated.isoformat() if generated else None, "quality": "available" if analysis_fresh else "stale"}],
        analysis_fresh=analysis_fresh, source_data_as_of=snapshot.get("data_as_of"), complete_coverage=coverage.get("status") == "full", sentiment_conflict=sentiment_conflict)
    return MarketStatusData(calculated_at=now, summary=MarketStatusSummary(market_condition=condition, risk_level=risk, sentiment=sentiment, change_intensity=intensity, confidence_level=confidence),
        details={"market_condition": condition_detail, "risk_level": risk_detail, "sentiment": sentiment_detail, "change_intensity": intensity_detail, "confidence_level": confidence_detail})


def _fetch_prices():
    response = httpx.get(YAHOO_CHART_URL, params={"range": "2y", "interval": "1d", "includePrePost": "false"}, timeout=8,
        headers={"User-Agent": "GreenPeak/1.0 market-status", "Accept": "application/json"})
    response.raise_for_status()
    return response.json()


@lru_cache(maxsize=1)
def _cached_inputs(bucket):
    tasks = {"prices": _pool.submit(_fetch_prices),
             "vix": _pool.submit(official_sentiment_service.get, "vix_term_structure"),
             "aaii": _pool.submit(official_sentiment_service.get, "aaii_bull_bear_spread"),
             "cftc": _pool.submit(official_sentiment_service.get, "cftc_sp500_positioning"),
             "events": _pool.submit(fetch_upcoming_us_events, days=2, limit=100, timeout=8)}
    wait(tasks.values(), timeout=9)
    result = {}
    for key, future in tasks.items():
        try:
            result[key] = future.result() if future.done() else None
        except Exception:
            # Upstream exceptions can include URLs/configuration. Never expose them.
            result[key] = None
    return result


def current_market_status(snapshot):
    with _input_lock:
        inputs = _cached_inputs(int(time() // REFRESH_SECONDS))
    return build_market_status(snapshot, inputs)
