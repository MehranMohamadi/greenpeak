// Persian calendar at the UI boundary; attendance instants and totals come from Python.
export const tehranZone = "Asia/Tehran"
export const persianMonths = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"]
const persianParts = new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: tehranZone, year: "numeric", month: "numeric", day: "numeric" })
const digits = value => String(value).replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
const parts = (formatter, value) => Object.fromEntries(formatter.formatToParts(new Date(value)).filter(item => item.type !== "literal").map(item => [item.type, Number(item.value)]))
const pad = value => String(value).padStart(2, "0")

export function persianDateParts(value = new Date()) { return parts(persianParts, value) }
export function formatDate(value) { return new Intl.DateTimeFormat("fa-IR", { timeZone: tehranZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) }
export function formatInstant(value) {
  return value ? new Intl.DateTimeFormat("fa-IR", { timeZone: tehranZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) : "باز / خروج ثبت نشده"
}
export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${Math.floor(minutes / 60).toLocaleString("fa-IR")} ساعت و ${(minutes % 60).toLocaleString("fa-IR")} دقیقه`
}

export function editableDate(value) {
  if (!value) return ""
  const date = persianDateParts(`${value}T12:00:00Z`)
  return `${date.year}/${pad(date.month)}/${pad(date.day)}`
}

export function parsePersianDate(value) {
  if (!value.trim()) return null
  const match = digits(value).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!match) throw new Error("تاریخ شمسی معتبر وارد کنید؛ مانند ۱۴۰۵/۰۸/۰۴.")
  return gregorianDate(...match.slice(1).map(Number))
}

export function gregorianDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger) || year < 1200 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) throw new Error("تاریخ شمسی معتبر وارد کنید.")
  let low = Math.floor(Date.UTC(year + 621, 0, 1, 12) / 86400000)
  let high = Math.floor(Date.UTC(year + 622, 11, 31, 12) / 86400000)
  const target = year * 10000 + month * 100 + day
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const value = persianDateParts(middle * 86400000 + 43200000)
    const key = value.year * 10000 + value.month * 100 + value.day
    if (key === target) return new Date(middle * 86400000 + 43200000).toISOString().slice(0, 10)
    if (key < target) low = middle + 1
    else high = middle - 1
  }
  throw new Error("این روز در تقویم شمسی وجود ندارد.")
}

export function monthRange(year, month) {
  const start = gregorianDate(year, month, 1)
  const next = gregorianDate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1)
  return { start_date: start, end_date: new Date(Date.parse(`${next}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) }
}

const clockFormatter = new Intl.DateTimeFormat("en-GB-u-ca-gregory", { timeZone: tehranZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
export function editableInstant(value) {
  if (!value) return { date: "", time: "" }
  const date = persianDateParts(value)
  const clock = parts(clockFormatter, value)
  return { date: `${date.year}/${pad(date.month)}/${pad(date.day)}`, time: `${pad(clock.hour)}:${pad(clock.minute)}` }
}

export function parseTehranInstant(dateText, timeText) {
  const match = digits(dateText).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  const clock = digits(timeText).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match || !clock || Number(clock[1]) > 23 || Number(clock[2]) > 59) throw new Error("تاریخ شمسی و ساعت را کامل وارد کنید؛ مانند ۱۴۰۵/۰۸/۰۳ و ۰۹:۳۰.")
  const gregorian = gregorianDate(...match.slice(1).map(Number))
  const wall = Date.parse(`${gregorian}T${pad(Number(clock[1]))}:${clock[2]}:00Z`)
  let utc = wall
  for (let count = 0; count < 4; count++) {
    const local = parts(clockFormatter, utc)
    const localWall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)
    utc += wall - localWall
  }
  const result = new Date(utc).toISOString()
  const roundtrip = editableInstant(result)
  if (roundtrip.date !== `${Number(match[1])}/${pad(Number(match[2]))}/${pad(Number(match[3]))}` || roundtrip.time !== `${pad(Number(clock[1]))}:${clock[2]}`) throw new Error("این ساعت در منطقه زمانی تهران معتبر نیست.")
  return result
}
