"use client"

import { useState } from "react"
import { endpoints } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { completionLabel, deliveryLabel, reviewStates, workEvents, workStates } from "@/lib/work-tasks.mjs"
import { formatDate, formatInstant } from "@/lib/workplace-time.mjs"
import { WorkTaskActionForm, WorkTaskEditor, workSelectClass } from "@/components/workplace/work-task-forms"

export const workDueLabel = date => date ? formatDate(`${date}T12:00:00Z`) : "بدون مهلت"
const fieldLabels = { title: "عنوان", description: "توضیحات", expected_output: "خروجی مورد انتظار", due_date: "مهلت", assignee_id: "مسئول انجام", priority: "اولویت", requires_approval: "نیاز به تأیید", visibility: "سطح نمایش" }
function fieldValue(key, value) {
  if (key === "due_date") return workDueLabel(value)
  if (key === "priority") return value === "high" ? "بالا" : "عادی"
  if (key === "visibility") return value === "team" ? "قابل مشاهده برای تیم" : "محدود"
  if (typeof value === "boolean") return value ? "بله" : "خیر"
  if (value && typeof value === "object") return value.username || "—"
  return value || "—"
}

export function WorkStateBadges({ task }) {
  const timing = deliveryLabel(task)
  return <div className="flex flex-wrap gap-2"><Badge variant={task.state === "awaiting_approval" ? "default" : "secondary"}>{workStates[task.state]}</Badge><Badge variant={task.priority === "high" ? "destructive" : "outline"}>اولویت {task.priority === "high" ? "بالا" : "عادی"}</Badge>{timing && <Badge variant={task.overdue || task.delivered_late ? "destructive" : "outline"}>{timing}</Badge>}{task.completion_mode && <Badge variant="outline">{completionLabel(task.completion_mode)}</Badge>}</div>
}

export default function WorkTaskDetail({ task, user, isAdmin, people, busy, mutate }) {
  const [mode, setMode] = useState(null)
  const [comment, setComment] = useState("")
  const permissions = task.permissions
  const act = (name, payload) => mutate(endpoints.workplace.taskAction(task.id, name), "POST", payload)
  const saveAction = async payload => {
    const data = await act(mode === "changes_requested" ? "review" : mode,
      mode === "changes_requested" ? { ...payload, decision: "changes_requested" } : payload)
    if (data) setMode(null)
  }
  const sendComment = async event => {
    event.preventDefault()
    if (await act("comments", { text: comment.trim() })) setComment("")
  }
  return <div className="space-y-6">
    <WorkStateBadges task={task} />
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">مسئول انجام</dt><dd dir="auto" className="mt-1 font-medium">{task.assignee.username}</dd></div>
      <div><dt className="text-muted-foreground">ایجادکننده</dt><dd dir="auto" className="mt-1 font-medium">{task.created_by.username}</dd></div>
      <div><dt className="text-muted-foreground">زمان ایجاد</dt><dd className="mt-1">{formatInstant(task.created_at)}</dd></div>
      <div><dt className="text-muted-foreground">مهلت انجام</dt><dd className="mt-1">{workDueLabel(task.due_date)}</dd></div>
      {task.submitted_at && <div><dt className="text-muted-foreground">آخرین اعلام انجام</dt><dd className="mt-1">{formatInstant(task.submitted_at)}</dd></div>}
      {task.approved_at && <div><dt className="text-muted-foreground">تأیید مدیر</dt><dd className="mt-1">{task.approved_by.username} · {formatInstant(task.approved_at)}</dd></div>}
    </dl>
    <div className="space-y-3 text-sm"><p className="text-muted-foreground">{task.requires_approval ? "نتیجه کار به تأیید مدیر نیاز دارد." : "کار بدون نیاز به تأیید مدیر تکمیل می‌شود."}</p><label className="block max-w-sm space-y-2"><span>سطح نمایش</span><select className={workSelectClass} value={task.visibility} disabled={busy || !permissions.change_visibility} onChange={event => mutate(endpoints.workplace.task(task.id), "PUT", { revision: task.revision, visibility: event.target.value })}><option value="restricted">محدود</option><option value="team">قابل مشاهده برای تیم</option></select></label></div>
    {mode === "edit" ? <section className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">ویرایش کار</h3><WorkTaskEditor task={task} user={user} isAdmin={isAdmin} people={people} busy={busy} onCancel={() => setMode(null)} onSave={async payload => { if (await mutate(endpoints.workplace.task(task.id), "PUT", payload)) setMode(null) }} /></section> : <>
      {task.description && <section className="space-y-2"><h3 className="text-sm font-semibold">توضیحات کار</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{task.description}</p></section>}
      {task.expected_output && <section className="space-y-2"><h3 className="text-sm font-semibold">خروجی مورد انتظار</h3><p className="whitespace-pre-wrap break-words text-sm leading-7">{task.expected_output}</p></section>}
    </>}
    <div className="flex flex-wrap gap-2">
      {permissions.edit_fields && mode !== "edit" && <Button variant="outline" disabled={busy} onClick={() => setMode("edit")}>ویرایش کار</Button>}
      {permissions.start && <Button variant="outline" disabled={busy} onClick={() => act("start", { revision: task.revision })}>شروع کار</Button>}
      {permissions.submit && <Button disabled={busy} onClick={() => setMode("submit")}>انجام دادم</Button>}
      {permissions.review && <><Button disabled={busy} onClick={() => act("review", { revision: task.revision, decision: "approved" })}>تأیید</Button><Button variant="outline" disabled={busy} onClick={() => setMode("changes_requested")}>درخواست اصلاح</Button></>}
      {permissions.cancel && <Button variant="outline" disabled={busy} onClick={() => setMode("cancel")}>لغو کار</Button>}
      {permissions.reopen && <Button variant="outline" disabled={busy} onClick={() => setMode("reopen")}>بازگشایی کار</Button>}
    </div>
    {!permissions.comment && <p className="text-sm text-muted-foreground">این کار برای شما فقط قابل مشاهده است.</p>}
    {mode && mode !== "edit" && <WorkTaskActionForm key={`${task.id}:${mode}`} task={task} mode={mode} busy={busy} onCancel={() => setMode(null)} onSave={saveAction} />}
    {task.submissions.length > 0 && <section className="space-y-3"><h3 className="font-semibold">نتیجه‌های ارسال‌شده</h3><ol className="space-y-3">{[...task.submissions].reverse().map(item => <li key={item.id} className="space-y-2 rounded-lg border p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span>{item.submitted_by.username} · {formatInstant(item.submitted_at)}</span><Badge variant="secondary">{reviewStates[item.review_status]}</Badge></div>{item.note && <p className="whitespace-pre-wrap break-words leading-7">{item.note}</p>}{item.result_url && <a className="block break-all text-primary underline underline-offset-4" dir="ltr" href={item.result_url} target="_blank" rel="noopener noreferrer">{item.result_url}</a>}{item.due_date_at_submission && <p className="text-xs text-muted-foreground">مهلت هنگام ارسال: {workDueLabel(item.due_date_at_submission)} · {item.delivered_late ? "تحویل با تأخیر" : "تحویل در مهلت"}</p>}{item.reviewed_by && <p className="text-xs text-muted-foreground">بررسی توسط {item.reviewed_by.username} · {formatInstant(item.reviewed_at)}</p>}{item.review_reason && <p className="whitespace-pre-wrap break-words">{item.review_reason}</p>}</li>)}</ol></section>}
    <section className="space-y-3"><h3 className="font-semibold">گفت‌وگوی کار</h3>{task.comments.length ? <ol className="space-y-3">{task.comments.map(item => <li key={item.id} className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm"><p className="text-xs text-muted-foreground"><b className="text-foreground" dir="auto">{item.author.username}</b> · {formatInstant(item.created_at)}</p><p className="whitespace-pre-wrap break-words leading-7">{item.text}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">هنوز توضیحی ثبت نشده است.</p>}{permissions.comment && <form onSubmit={sendComment} className="space-y-2"><label className="block space-y-2 text-sm"><span>توضیح جدید</span><Textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={5000} required disabled={busy} /></label><Button type="submit" disabled={busy || !comment.trim()}>ثبت توضیح</Button></form>}</section>
    <details className="space-y-3 text-sm"><summary className="cursor-pointer font-semibold">سابقه کار</summary><ol className="space-y-3">{[...task.history].reverse().map(item => <li key={item.id} className="space-y-2 border-s-2 ps-3"><p>{workEvents[item.kind] || "تغییر کار"} · <b dir="auto">{item.actor.username}</b></p><p className="text-xs text-muted-foreground">{formatInstant(item.created_at)}</p>{item.details.reason && <p className="whitespace-pre-wrap break-words">{item.details.reason}</p>}{item.kind === "visibility_changed" && <p className="text-xs text-muted-foreground">{fieldValue("visibility", item.details.before)} ← {fieldValue("visibility", item.details.after)}</p>}{item.kind === "updated" && <dl className="space-y-2 text-xs">{Object.keys(item.details.after).map(key => <div key={key}><dt className="font-medium">{fieldLabels[key]}</dt><dd className="whitespace-pre-wrap break-words text-muted-foreground">قبل: {fieldValue(key, item.details.before[key])}<br />بعد: {fieldValue(key, item.details.after[key])}</dd></div>)}</dl>}{item.kind === "reopened" && <p className="text-xs text-muted-foreground">{completionLabel(item.details.previous_completion_mode)} · {formatInstant(item.details.previous_completed_at)}</p>}</li>)}</ol></details>
  </div>
}
