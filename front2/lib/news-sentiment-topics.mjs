export const NEWS_SENTIMENT_TOPICS = Object.freeze([
  Object.freeze({ value: "financial_markets", label: "Financial Markets" }),
  Object.freeze({ value: "earnings", label: "Earnings" }),
  Object.freeze({ value: "economy_monetary", label: "Economy — Monetary Policy" }),
  Object.freeze({ value: "economy_macro", label: "Economy — Macro" }),
  Object.freeze({ value: "finance", label: "Finance" }),
  Object.freeze({ value: "economy_fiscal", label: "Economy — Fiscal Policy" }),
])

export const DEFAULT_NEWS_TOPICS = Object.freeze(NEWS_SENTIMENT_TOPICS.map(({ value }) => value))

export const NEWS_TOPIC_LABELS = Object.freeze(Object.fromEntries(
  NEWS_SENTIMENT_TOPICS.map(({ value, label }) => [value, label])
))
