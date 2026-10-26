export const workStates = {
  not_started: "انجام‌نشده",
  in_progress: "در حال انجام",
  awaiting_approval: "منتظر تأیید",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
}

export function workTaskIdFromSearch(search) {
  const values = new URLSearchParams(search).getAll("task")
  return values.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values[0]) ? values[0] : null
}

export const workEvents = {
  created: "ایجاد کار",
  updated: "تغییر مشخصات کار",
  visibility_changed: "تغییر سطح نمایش",
  started: "شروع کار",
  submitted: "اعلام انجام کار",
  approved: "تأیید نتیجه",
  changes_requested: "درخواست اصلاح",
  completed_without_approval: "تکمیل بدون نیاز به تأیید",
  cancelled: "لغو کار",
  reopened: "بازگشایی کار",
  commented: "توضیح جدید",
}

export const reviewStates = {
  pending: "منتظر بررسی مدیر",
  approved: "تأیید شده توسط مدیر",
  changes_requested: "اصلاح خواسته شده",
  not_required: "بدون نیاز به تأیید",
  cancelled: "لغوشده",
}

export function deliveryLabel(work) {
  if (work.overdue) return "مهلت انجام گذشته است"
  if (["awaiting_approval", "completed"].includes(work.state) && work.delivered_late === true) return "تحویل با تأخیر"
  if (["awaiting_approval", "completed"].includes(work.state) && work.delivered_late === false) return "تحویل در مهلت"
  return ""
}

export function completionLabel(mode) {
  return mode === "approved" ? "تکمیل با تأیید مدیر" : mode === "no_approval" ? "تکمیل بدون نیاز به تأیید" : ""
}
