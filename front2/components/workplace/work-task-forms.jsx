"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { editableDate, parsePersianDate } from "@/lib/workplace-time.mjs"

export const workSelectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"

export function WorkDateInput({ label, value, onChange, disabled = false }) {
  return <label className="block min-w-0 space-y-2 text-sm"><span>{label}</span><Input dir="ltr" inputMode="numeric" placeholder="1405/08/04" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} maxLength={10} /></label>
}

export function WorkTaskEditor({ task = null, user, isAdmin, people, busy, onSave, onCancel }) {
  const [original] = useState(task)
  const [requestId] = useState(() => task ? null : globalThis.crypto.randomUUID())
  const [title, setTitle] = useState(task?.title || "")
  const [assignee, setAssignee] = useState(task?.assignee.id || (isAdmin ? "" : user.id))
  const [description, setDescription] = useState(task?.description || "")
  const [output, setOutput] = useState(task?.expected_output || "")
  const [due, setDue] = useState(editableDate(task?.due_date))
  const [priority, setPriority] = useState(task?.priority || "normal")
  const [approval, setApproval] = useState(task?.requires_approval ?? true)
  const [visibility, setVisibility] = useState(task?.visibility || "team")
  const [error, setError] = useState("")
  const stale = original && original.revision !== task.revision
  const submit = async event => {
    event.preventDefault()
    setError("")
    try {
      const fields = { title: title.trim(), description, expected_output: output, due_date: parsePersianDate(due), priority, visibility,
        ...(isAdmin ? { assignee_id: assignee, requires_approval: approval } : {}) }
      let payload = { ...fields, request_id: requestId }
      if (original) {
        payload = { revision: original.revision }
        for (const [key, value] of Object.entries(fields)) {
          const previous = key === "assignee_id" ? original.assignee.id : original[key]
          if (value !== previous) payload[key] = value
        }
      }
      await onSave(payload)
    } catch (failure) { setError(failure.message) }
  }
  return <form onSubmit={submit} className="space-y-4">
    <label className="block space-y-2 text-sm"><span>عنوان کار (الزامی)</span><Input value={title} onChange={event => setTitle(event.target.value)} maxLength={180} required disabled={busy} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block min-w-0 space-y-2 text-sm"><span>مسئول انجام (الزامی)</span>{isAdmin ? <select className={workSelectClass} value={assignee} required disabled={busy} onChange={event => setAssignee(event.target.value)}><option value="">انتخاب مسئول انجام</option>{task?.assignee && !people.some(person => person.id === task.assignee.id) && <option value={task.assignee.id}>{task.assignee.username} (غیرفعال)</option>}{people.map(person => <option key={person.id} value={person.id}>{person.username}</option>)}</select> : <Input value={task?.assignee.username || user.username} readOnly disabled />}</label>
      <WorkDateInput label="مهلت انجام (شمسی، اختیاری)" value={due} onChange={setDue} disabled={busy} />
    </div>
    <label className="block space-y-2 text-sm"><span>توضیحات کار (اختیاری)</span><Textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={10000} disabled={busy} /></label>
    <label className="block space-y-2 text-sm"><span>خروجی مورد انتظار (اختیاری)</span><Textarea value={output} onChange={event => setOutput(event.target.value)} rows={3} maxLength={10000} disabled={busy} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-2 text-sm"><span>اولویت</span><select className={workSelectClass} value={priority} onChange={event => setPriority(event.target.value)} disabled={busy}><option value="normal">عادی</option><option value="high">بالا</option></select></label>
      <label className="block space-y-2 text-sm"><span>سطح نمایش</span><select className={workSelectClass} value={visibility} onChange={event => setVisibility(event.target.value)} disabled={busy}><option value="restricted">محدود</option><option value="team">قابل مشاهده برای تیم</option></select></label>
    </div>
    {isAdmin ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approval} onChange={event => setApproval(event.target.checked)} disabled={busy} />نیاز به تأیید مدیر</label> : <p className="text-sm text-muted-foreground">{approval ? "نتیجه این کار به تأیید مدیر نیاز دارد." : "این کار بدون نیاز به تأیید مدیر تکمیل می‌شود."}</p>}
    {isAdmin && task?.state === "awaiting_approval" && !approval && <p className="text-sm text-muted-foreground">با خاموش‌کردن نیاز به تأیید، نتیجه ارسال‌شده بدون تأیید مدیر تکمیل می‌شود.</p>}
    <p className="text-xs text-muted-foreground">نمایش تیمی فقط برای کارکنان داخلی است و اجازه تغییر کار را به دیگران نمی‌دهد.</p>
    {stale && <p role="alert" className="text-sm text-destructive">اطلاعات کار تغییر کرده است. نوشته‌های شما حفظ شده؛ پیش از ادامه، آن‌ها را کپی و فرم را دوباره باز کنید.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || stale || !title.trim() || (isAdmin && !assignee)}>{busy ? "در حال ذخیره…" : original ? "ذخیره تغییرات کار" : "ایجاد کار"}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>انصراف</Button></div>
  </form>
}

export function WorkTaskActionForm({ task, mode, busy, onSave, onCancel }) {
  const [revision] = useState(task.revision)
  const [note, setNote] = useState("")
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const result = mode === "submit"
  const required = mode === "changes_requested" || mode === "reopen"
  const labels = { submit: "انجام دادم", changes_requested: "درخواست اصلاح", reopen: "بازگشایی کار", cancel: "لغو کار" }
  const stale = revision !== task.revision
  const submit = async event => {
    event.preventDefault()
    setError("")
    try {
      await onSave(result ? { revision, note, result_url: url.trim() || null } : { revision, reason: note.trim() })
    } catch (failure) { setError(failure.message) }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg border bg-muted/20 p-4">
    <h3 className="text-sm font-semibold">{labels[mode]}</h3>
    <label className="block space-y-2 text-sm"><span>{result ? "توضیح نتیجه (اختیاری)" : required ? "دلیل (الزامی)" : "دلیل لغو (اختیاری)"}</span><Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={result ? 5000 : 2000} minLength={required ? 3 : undefined} required={required} disabled={busy} /></label>
    {result && <><label className="block space-y-2 text-sm"><span>لینک نتیجه (اختیاری)</span><Input dir="ltr" type="url" placeholder="https://…" value={url} onChange={event => setUrl(event.target.value)} maxLength={2048} disabled={busy} /></label><p className="text-xs text-muted-foreground">{task.requires_approval ? "با ارسال نتیجه، کار برای تأیید مدیر فرستاده می‌شود." : "با ارسال نتیجه، کار بدون نیاز به تأیید تکمیل می‌شود."}</p></>}
    {stale && <p role="alert" className="text-sm text-destructive">اطلاعات کار تغییر کرده است؛ نوشته‌ها را کپی کنید و این فرم را دوباره باز کنید.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" variant={mode === "cancel" ? "destructive" : "default"} disabled={busy || stale || (required && note.trim().length < 3)}>{labels[mode]}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>انصراف</Button></div>
  </form>
}
