"""Versioned indicator definitions and feature configuration."""

from copy import deepcopy

SCHEMA_VERSION = "1.0"
FEATURE_VERSION = "0.1.0"
DEFINITION_VERSION = "1.0"

COMMON_CONFIG = {
    "calendar_offsets_days": [7, 30, 90, 180, 365],
    "zscore_window_days": 365,
    "percentile_window_days": 1826,
    "slope_window_days": 90,
    "volatility_window_days": 90,
    "trend_threshold_bp": 15.0,
    "stale_after_calendar_days": 7,
    "minimum_observation_counts": {
        "mean_30d": 10,
        "mean_90d": 30,
        "mean_365d": 120,
        "zscore_365d": 120,
        "percentile_5y": 500,
        "slope_90d": 30,
        "volatility_90d": 30,
    },
}

DEFINITIONS = {
    "us_10y_treasury_yield": {
        "name_en": "10-Year Treasury Yield",
        "name_fa": "نرخ اوراق خزانه ۱۰‌ساله آمریکا",
        "source": {"provider": "FRED", "series_id": "DGS10"},
        "data": {"frequency": "daily", "unit": "percent", "delta_unit": "basis_point", "timezone": "UTC"},
        "raw_indicator": "ten_year_treasury",
        "semantics": {
            "category": "rates_intermarket",
            "what_is_fa": "نرخ بازده بازار اوراق خزانه آمریکا با سررسید ثابت ده‌ساله است و معمولاً یکی از نرخ‌های مرجع بلندمدت بازار محسوب می‌شود.",
            "why_it_matters_fa": "در نرخ تنزیل، هزینه سرمایه، شرایط مالی و مقایسه جذابیت اوراق با دارایی‌های ریسکی نقش دارد.",
            "relationship_to_sp500_fa": "رابطه آن با سهام ثابت و خطی نیست؛ افزایش نرخ می‌تواند از مسیر نرخ تنزیل فشار ایجاد کند، اما ممکن است هم‌زمان بازتاب رشد یا تورم باشد.",
            "limitations_fa": ["جهت حرکت نرخ بدون توجه به علت حرکت، تورم، رشد، سیاست پولی و ارزش‌گذاری سهام برای نتیجه‌گیری کافی نیست."],
        },
    },
    "federal_funds_rate": {
        "name_en": "Federal Funds Rate",
        "name_fa": "نرخ وجوه فدرال",
        "source": {"provider": "FRED", "series_id": "DFF"},
        "data": {"frequency": "daily", "unit": "percent", "delta_unit": "basis_point", "timezone": "UTC"},
        "raw_indicator": "federal_funds_rate",
        "semantics": {
            "category": "monetary_policy",
            "what_is_fa": "نرخ مؤثر معاملات ذخایر بانکی در بازار فدرال فاندز است و به موضع کوتاه‌مدت سیاست پولی نزدیک است.",
            "why_it_matters_fa": "بر نرخ‌های کوتاه‌مدت، هزینه تأمین مالی، نقدینگی و شرایط مالی اثر می‌گذارد.",
            "relationship_to_sp500_fa": "نرخ بالاتر معمولاً شرایط مالی را سخت‌تر می‌کند، ولی اثر بازار به انتظارات، تورم، رشد و آنچه از قبل قیمت‌گذاری شده وابسته است.",
            "limitations_fa": ["ثابت‌ماندن نرخ به معنی ثابت‌ماندن سیاست مورد انتظار یا شرایط مالی نیست؛ انتظارات آینده و ترازنامه فدرال رزرو جداگانه‌اند."],
        },
    },
}


def get_definition(indicator_id: str) -> dict:
    definition = deepcopy(DEFINITIONS[indicator_id])
    definition.update(schema_version=SCHEMA_VERSION, definition_version=DEFINITION_VERSION, active=True)
    definition["feature_config"] = deepcopy(COMMON_CONFIG)
    return definition
