const GREGORIAN_PERSIAN_LOCALE = "fa-IR-u-ca-gregory"
const TEHRAN_TIME_ZONE = "Asia/Tehran"

export function formatGregorianTehranDateTime(value) {
  if (value === null || value === undefined || value === "") return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(GREGORIAN_PERSIAN_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TEHRAN_TIME_ZONE,
  }).format(date)
}

export function formatGregorianDate(value, timeZone = TEHRAN_TIME_ZONE) {
  if (value === null || value === undefined || value === "") return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(GREGORIAN_PERSIAN_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date)
}

export { GREGORIAN_PERSIAN_LOCALE, TEHRAN_TIME_ZONE }
