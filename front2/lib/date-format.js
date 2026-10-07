const GREGORIAN_PERSIAN_LOCALE = "fa-IR-u-ca-gregory"
const TEHRAN_TIME_ZONE = "Asia/Tehran"

export function formatGregorianTehranDateTime(value) {
  if (value === null || value === undefined || value === "") return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(GREGORIAN_PERSIAN_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TEHRAN_TIME_ZONE,
  }).format(date)
}

export function formatGregorianDate(value, timeZone = TEHRAN_TIME_ZONE) {
  if (value === null || value === undefined || value === "") return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat(GREGORIAN_PERSIAN_LOCALE, {
    dateStyle: "medium",
    timeZone,
  }).format(date)
}

export { GREGORIAN_PERSIAN_LOCALE, TEHRAN_TIME_ZONE }
