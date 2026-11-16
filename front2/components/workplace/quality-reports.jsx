"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, ReportText, fieldClass, boxClass, dateLabel, kindLabel, stateLabel } from "@/components/workplace/quality-shared"

const metrics = { accuracy: "صحت داده و تاریخ", evidence: "پشتوانهٔ شواهد", clarity: "وضوح و اختصار", uncertainty: "بیان عدم قطعیت", usefulness: "فایدهٔ تحلیلی" }
const categories = { quiet: "روز آرام", inflation: "تورم", fed: "فدرال رزرو", earnings: "سود شرکت‌ها", selloff: "افت شدید", weekend: "تعطیلات", conflicting: "شواهد متعارض", other: "سایر" }

function FeedbackForm({ row, api, action, busy }) {
  const initial = row.feedback || {}
  const [draft, setDraft] = useState({ ...Object.fromEntries(Object.keys(metrics).map(key => [key, initial[key] || 3])), note: initial.note || "", correction: initial.correction || "", approved_example: initial.approved_example || false })
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  return <form className={boxClass} onSubmit={event => { event.preventDefault(); action(() => api(`/reports/${encodeURIComponent(row.id)}/feedback`, "PUT", { ...draft, expected_revision: initial.revision || 0 })) }}>
    <h3 className="font-medium">بازخورد مدیر</h3>
    <p className="text-xs leading-6 text-muted-foreground">امتیاز ۱ ضعیف تا ۵ قوی است. صحت استدلال را جدا از سود یا زیان بعدی بازار بسنجید.</p>
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(metrics).map(([key, label]) => <Field key={key} label={label}><select className={fieldClass} value={draft[key]} onChange={event => set(key, Number(event.target.value))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}</select></Field>)}</div>
    <Field label="ایراد یا نکتهٔ قابل بهبود"><textarea className={fieldClass} rows={3} maxLength={3000} value={draft.note} onChange={event => set("note", event.target.value)} /></Field>
    <Field label="اصلاح تأییدشده / نمونهٔ نگارش بهتر"><textarea className={fieldClass} rows={3} maxLength={5000} value={draft.correction} onChange={event => set("correction", event.target.value)} /></Field>
    <label className="flex items-start gap-2 text-xs leading-6"><input type="checkbox" checked={draft.approved_example} onChange={event => set("approved_example", event.target.checked)} />این اصلاح به‌عنوان نمونهٔ نگارش تأیید شود؛ فقط اگر گزارش در مجموعهٔ توسعه باشد وارد حافظه می‌شود.</label>
    <Button disabled={busy}>ذخیره بازخورد</Button>
  </form>
}

function CaseForm({ row, api, action, busy }) {
  const [split, setSplit] = useState(row.split)
  const [category, setCategory] = useState(row.category)
  return <form className={boxClass} onSubmit={event => { event.preventDefault(); action(() => api(`/reports/${encodeURIComponent(row.id)}/case`, "PUT", { split, category, expected_revision: row.revision })) }}>
    <h3 className="font-medium">مجموعهٔ ارزیابی</h3>
    <p className="text-xs leading-6 text-muted-foreground">نمونه‌های آزمون مستقل وارد پیشنهاد خودکار پرامپت و مثال‌های حافظه نمی‌شوند. هدف اولیه: ۳۰ تا ۵۰ گزارش از وضعیت‌های متفاوت.</p>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="کاربرد نمونه"><select className={fieldClass} value={split} disabled={!row.replayable} onChange={event => setSplit(event.target.value)}><option value="none">فقط بایگانی</option><option value="development">توسعه و اصلاح</option><option value="holdout">آزمون مستقل</option></select></Field><Field label="نوع روز"><select className={fieldClass} value={category} onChange={event => setCategory(event.target.value)}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
    <Button disabled={busy}>ذخیره کاربرد نمونه</Button>
  </form>
}

function HypothesisForm({ detail, api, action, busy }) {
  const [refs, setRefs] = useState([])
  return <form className={boxClass} onSubmit={event => {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form))
    action(async () => { const result = await api("/hypotheses", "POST", { ...values, due_at: new Date(values.due_at).toISOString(), report_id: detail.id, evidence_refs: refs }); form.reset(); setRefs([]); return result })
  }}>
    <h3 className="font-medium">ثبت فرضیه از این گزارش</h3>
    <Field label="عنوان"><input name="title" required minLength={5} maxLength={240} className={fieldClass} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="افق"><select name="horizon" className={fieldClass}><option value="short">کوتاه‌مدت</option><option value="medium">میان‌مدت</option></select></Field><Field label="سررسید ارزیابی نتیجه"><input type="datetime-local" name="due_at" required className={fieldClass} /></Field></div>
    <Field label="ادعا و سناریوی قابل پیگیری"><textarea name="thesis" required minLength={10} maxLength={1500} rows={3} className={fieldClass} /></Field>
    <Field label="چه شواهدی این دید را باطل می‌کند؟"><textarea name="invalidation" required minLength={5} maxLength={1000} className={fieldClass} /></Field>
    <Field label="شاهد اصلی در ورودی گزارش؛ انتخاب حداقل یک مرجع"><select multiple required className={`${fieldClass} min-h-24`} value={refs} onChange={event => setRefs(Array.from(event.target.selectedOptions, option => option.value))}>{detail.evidence_refs.map(ref => <option key={ref} value={ref}>{ref}</option>)}</select></Field>
    <Button disabled={busy || !refs.length}>ثبت فرضیه</Button>
  </form>
}

function HypothesisReview({ row, api, action, busy }) {
  return <article className={boxClass}>
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{row.title}</h3><span className="text-xs text-primary">{stateLabel(row.status)} · {row.horizon === "short" ? "کوتاه‌مدت" : "میان‌مدت"}</span></div>
    <p className="text-sm leading-7">{row.thesis}</p><p className="text-sm leading-7 text-muted-foreground">شرط ابطال: {row.invalidation}</p>
    <p className={`text-xs ${new Date(row.due_at) <= new Date() && !["realized", "invalidated", "inconclusive"].includes(row.status) ? "text-amber-600" : "text-muted-foreground"}`}>سررسید: {dateLabel(row.due_at)}</p>
    {row.reviews.map((review, index) => <div key={index} className="rounded-lg bg-muted/40 p-3 text-xs leading-6"><p>{stateLabel(review.status)} · {dateLabel(review.reviewed_at)}</p><p>{review.note}</p><a href={review.evidence_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">شاهد بازبینی · {dateLabel(review.evidence_at)}</a></div>)}
    <form className="space-y-3 border-t border-border pt-3" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form))
      action(async () => { const result = await api(`/hypotheses/${row.id}/review`, "PUT", { ...values, evidence_at: new Date(values.evidence_at).toISOString(), expected_revision: row.revision }); form.reset(); return result })
    }}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="نتیجهٔ بازبینی"><select name="status" className={fieldClass}>{["active", "strengthened", "weakened", "realized", "invalidated", "inconclusive"].map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}</select></Field><Field label="تاریخ شاهد تازه"><input type="datetime-local" name="evidence_at" required className={fieldClass} /></Field></div>
      <Field label="لینک شاهد تازه"><input type="url" name="evidence_url" required className={fieldClass} placeholder="https://" /></Field>
      <Field label="چه چیزی تغییر کرد و چرا؟"><textarea name="note" minLength={10} maxLength={2000} required className={fieldClass} /></Field>
      <Button disabled={busy}>ثبت بازبینی</Button>
    </form>
  </article>
}

export default function QualityReports({ hypothesesOnly = false, data, api, action, busy }) {
  const [selected, setSelected] = useState("")
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState("")
  const row = data.reports.find(item => item.id === selected)
  useEffect(() => {
    if (!selected) { setDetail(null); return }
    let active = true; setDetail(null); setError("")
    api(`/reports/${encodeURIComponent(selected)}`).then(value => { if (active) setDetail(value) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [selected, api])
  if (hypothesesOnly) return <div className="space-y-4"><p className="text-sm leading-7 text-muted-foreground">فرضیه‌ها از بخش گزارش‌ها و با ارجاع به شواهد اصلی ثبت می‌شوند. پیش از سررسید، تقویت یا تضعیف را ثبت کنید؛ تحقق نهایی و نتیجهٔ نامشخص پس از سررسید ثبت می‌شوند.</p>{data.hypotheses.length ? data.hypotheses.map(item => <HypothesisReview key={`${item.id}-${item.revision}`} row={item} api={api} action={action} busy={busy} />) : <p className="text-sm">هنوز فرضیه‌ای ثبت نشده است.</p>}</div>
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={() => action(() => api("/import-reports", "POST"), "حداکثر ۵۰ گزارش اخیر بررسی و وارد شد؛ ورودی‌های قدیمی بازسازی نمی‌شوند.")}>ورود گزارش‌های قبلی</Button><span className="text-xs text-muted-foreground">ثبت خودکار ورودی کامل، از گزارش‌های جدید شروع می‌شود.</span></div>
    <Field label="گزارش برای بازبینی"><select className={fieldClass} value={selected} onChange={event => setSelected(event.target.value)}><option value="">انتخاب گزارش</option>{data.reports.map(item => <option key={item.id} value={item.id}>{kindLabel(item.report_kind)} · {dateLabel(item.generated_at)} · {item.model || "مدل ثبت نشده"}{item.feedback ? " · بازخورد دارد" : ""}</option>)}</select></Field>
    {error && <p role="alert" className="text-sm text-amber-600">{error}</p>}
    {row && detail && <>
      <article className={boxClass}><div className="flex flex-wrap gap-2 text-xs">{detail.checks.map(check => <span key={check.key} className={`rounded px-2 py-1 ${check.status === "pass" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>{check.label}: {stateLabel(check.status)}</span>)}</div><ReportText report={detail.report} /><details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs text-primary">شواهد اصلی ذخیره‌شده</summary><pre dir="ltr" className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(detail.evidence, null, 2)}</pre></details>
        <Button disabled={busy || !row.replayable} variant="outline" onClick={() => action(() => api(`/reports/${encodeURIComponent(row.id)}/critique`, "POST"), "بازبینی منتقد در صف قرار گرفت؛ مصرف مدل در بخش مدل‌ها ثبت می‌شود.")}>اجرای منتقد با اولویت فعلی مدل‌ها</Button>
        {data.critiques.filter(item => item.report_id === row.id).map(item => <div key={item.id} className="rounded-lg bg-muted/30 p-3 text-xs leading-7"><p>منتقد: {stateLabel(item.status)} {item.model && `· ${item.model}`}</p>{item.error_code && <p>خطا: {item.error_code}</p>}{item.result && <><p>{stateLabel(item.result.verdict)}</p><ul className="list-inside list-disc">{[...item.result.issues, ...item.result.suggestions].map((text, index) => <li key={index}>{text}</li>)}</ul></>}</div>)}
      </article>
      <div className="grid items-start gap-4 lg:grid-cols-2"><FeedbackForm key={`${row.id}-${row.feedback?.revision || 0}`} row={row} api={api} action={action} busy={busy} /><CaseForm key={`${row.id}-${row.revision}`} row={row} api={api} action={action} busy={busy} /></div>
      {row.replayable && <HypothesisForm key={row.id} detail={detail} api={api} action={action} busy={busy} />}
    </>}
  </div>
}
