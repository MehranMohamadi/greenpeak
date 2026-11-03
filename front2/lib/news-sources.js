export const NEWS_SOURCES = [
  { id: "bloomberg_rss", label: "Bloomberg" },
  { id: "cnbc_rss", label: "CNBC" },
  { id: "wsj_rss", label: "WSJ" },
  { id: "nytimes_rss", label: "New York Times" },
  { id: "economist_rss", label: "The Economist" },
]

export const DEFAULT_NEWS_SOURCE = "bloomberg_rss"

export const NEWS_ACCESS_LABELS = {
  page_text_available: "متن صفحه خوانده شد",
  paywall: "نیاز به اشتراک",
  authentication_required: "نیاز به ورود",
  blocked: "دسترسی مسدود",
  rate_limited: "محدودیت تعداد درخواست",
  http_error: "خطای ناشر",
  network_error: "خطای ارتباط",
  text_unavailable: "متن قابل استخراج نبود",
  non_html: "صفحهٔ غیرمتنی",
  redirect_unavailable: "لینک مقصد در دسترس نبود",
}
