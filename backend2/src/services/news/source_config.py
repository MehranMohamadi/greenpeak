"""The five publishers selected from GreenPeak_News_Sources_Reviewed."""

NEWS_SOURCES = (
    ("bloomberg_rss", "Bloomberg", "greenpeak_bloomberg_rss_url"),
    ("cnbc_rss", "CNBC", "greenpeak_cnbc_rss_url"),
    ("wsj_rss", "WSJ", "greenpeak_wsj_rss_url"),
    ("nytimes_rss", "New York Times", "greenpeak_nytimes_rss_url"),
    ("economist_rss", "The Economist", "greenpeak_economist_rss_url"),
)
ACTIVE_SOURCE_IDS = tuple(source[0] for source in NEWS_SOURCES)
DEFAULT_SOURCE_ID = "bloomberg_rss"

# Workbook rows 6–9: the three primary feeds plus Finance as a complement.
CNBC_SECTIONS = (
    ("economy", "Economy", "اقتصاد", "primary", "greenpeak_cnbc_rss_url"),
    ("earnings", "Earnings", "گزارش سود", "primary", "greenpeak_cnbc_earnings_rss_url"),
    ("us_top_news", "US Top News", "خبرهای اصلی آمریکا", "primary", "greenpeak_cnbc_us_top_news_rss_url"),
    ("finance", "Finance", "مالی و بانک‌ها", "supplement", "greenpeak_cnbc_finance_rss_url"),
)


def cnbc_section_catalog():
    return [{"id": identifier, "label": label, "label_fa": label_fa, "role": role}
            for identifier, label, label_fa, role, _ in CNBC_SECTIONS]


def rss_sources(settings):
    return {source: getattr(settings, setting) for source, _, setting in NEWS_SOURCES}
