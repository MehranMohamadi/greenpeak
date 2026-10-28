export const workplaceTabs = [
  { id: "tasks", label: "کارها" },
  { id: "attendance", label: "حضور و غیاب" },
  { id: "users", label: "کاربران و دسترسی‌ها", adminOnly: true },
  { id: "llm", label: "مدل‌های هوش مصنوعی", adminOnly: true },
  { id: "tools", label: "تنظیمات و ابزارها", adminOnly: true },
]

export function workplaceTab(search, isAdmin) {
  const params = new URLSearchParams(search)
  const values = params.getAll("tab")
  const tab = values.length === 1 && workplaceTabs.find(item => item.id === values[0])
  return tab && (!tab.adminOnly || isAdmin) ? tab.id : "tasks"
}

export function isAdminWorkplaceTab(tab) {
  return workplaceTabs.some(item => item.id === tab && item.adminOnly)
}
