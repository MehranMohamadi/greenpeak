"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { endpoints } from "@/api/api"
import { useAuth } from "@/components/auth/auth-context"
import { Field, ReportText, fieldClass, boxClass, dateLabel, kindLabel, stateLabel } from "@/components/workplace/quality-shared"

function PairReview({ pair, run, api, action, busy, onChange }) {
  return <article className={boxClass}><h4 className="text-sm font-medium">نمونهٔ {pair.split === "holdout" ? "آزمون مستقل" : "توسعه"} · {pair.case_id.slice(0, 12)}</h4><div className="grid items-start gap-4 lg:grid-cols-2">{Object.entries(pair.outputs).map(([variant, output]) => <div key={variant} className="space-y-3 rounded-lg bg-muted/20 p-3"><h5 className="text-sm font-medium">{variant === "baseline" ? "دستور پایه" : "دستور پیشنهادی"} · {stateLabel(output.status)}</h5><p className="text-xs text-muted-foreground">{output.model} · {output.elapsed_seconds} ثانیه</p>{output.error_code && <p className="text-xs text-amber-600">{output.error_code}</p>}<ReportText report={output.report} /></div>)}</div>{pair.review && <p className="text-xs leading-7">بازبینی ثبت‌شده: {pair.review.decision === "candidate" ? "پیشنهاد بهتر است" : pair.review.decision === "baseline" ? "نسخهٔ پایه بهتر است" : "برابر"} · {pair.review.note}</p>}{pair.outputs.candidate && <form className="space-y-3" onSubmit={event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); action(async () => onChange(await api(`/evaluations/${run.id}/cases/${encodeURIComponent(pair.case_id)}/review`, "PUT", { ...values, expected_revision: run.revision }))) }}><Field label="قضاوت انسانی با توجه به شواهد و متن"><select name="decision" className={fieldClass}><option value="candidate">پیشنهاد بهتر است</option><option value="baseline">نسخهٔ پایه بهتر است</option><option value="tie">برابرند</option></select></Field><Field label="دلیل مقایسه"><textarea name="note" required minLength={10} maxLength={2000} className={fieldClass} /></Field><Button disabled={busy || run.status !== "completed"}>ثبت قضاوت</Button></form>}</article>
}

export default function QualityExperiments({ promptsOnly = false, data, api, action, busy }) {
  const { accessToken } = useAuth()
  const [selectedCases, setSelectedCases] = useState([])
  const [candidate, setCandidate] = useState("")
  const [model, setModel] = useState("")
  const [runId, setRunId] = useState("")
  const [run, setRun] = useState(null)
  const [runError, setRunError] = useState("")
  const [promptRevision, setPromptRevision] = useState(null)
  useEffect(() => {
    if (!runId) { setRun(null); return }
    let active = true
    setRunError("")
    api(`/evaluations/${runId}`).then(value => { if (active) setRun(value) }).catch(error => { if (active) setRunError(error.message) })
    return () => { active = false }
  }, [runId, api, data.evaluations])
  useEffect(() => {
    if (!promptsOnly) return
    let active = true
    fetch(endpoints.llmPrompts, { cache: "no-store", headers: { Authorization: `Bearer ${accessToken}` } }).then(response => response.ok ? response.json() : Promise.reject()).then(value => { if (active) setPromptRevision(value.prompts.find(item => item.id === "market")?.revision ?? null) }).catch(() => { if (active) setPromptRevision(null) })
    return () => { active = false }
  }, [accessToken, promptsOnly, data.candidates])
  if (promptsOnly) return <div className="space-y-4">
    <section className={boxClass}><h3 className="font-medium">پیشنهاد بهبود از بازخوردها</h3><p className="text-sm leading-7 text-muted-foreground">از حداکثر پنج گزارشِ دارای بازخورد در مجموعهٔ توسعه، یک اصلاح پیشنهادی ساخته می‌شود. این کار آموزش وزن‌های مدل نیست. پیشنهاد تا پیش از آزمون و تأیید مدیر فعال نمی‌شود.</p><Button disabled={busy || !data.reports.some(row => row.split === "development" && row.feedback)} onClick={() => action(() => api("/suggestions", "POST"), "ساخت پیشنهاد در صف قرار گرفت؛ پس از پایان تازه‌سازی کنید.")}>ساخت پیشنهاد با مدل اصلی</Button>{data.suggestions.map(item => <p key={item.id} className="text-xs">{dateLabel(item.created_at)} · {stateLabel(item.status)} {item.error_code && `· ${item.error_code}`}</p>)}</section>
    <form className={boxClass} onSubmit={event => { event.preventDefault(); const form = event.currentTarget; action(async () => { const result = await api("/candidates", "POST", Object.fromEntries(new FormData(form))); form.reset(); return result }, "اصلاح پیشنهادی ثبت شد؛ در بخش آزمون و مقایسه آن را بررسی کنید.") }}><h3 className="font-medium">ثبت اصلاح پیشنهادی مدیر</h3><Field label="عنوان تغییر"><input name="title" required minLength={3} maxLength={160} className={fieldClass} /></Field><Field label="دستور تکمیلی؛ بدون قیمت، پیش‌بینی یا واقعیت وابسته به یک روز"><textarea name="amendment" required minLength={20} maxLength={4000} rows={6} className={fieldClass} /></Field><Button disabled={busy}>ذخیره پیشنهاد</Button></form>
    <p className="text-xs leading-7 text-muted-foreground">فعال‌سازی نیازمند حداقل سه مقایسهٔ معتبر و بازبینی‌شده، شامل یک آزمون مستقل و حداقل یک بهبود است. موردی که نسخهٔ پایه در آن بهتر بوده باید بررسی شود. تغییر هم‌زمان پرامپت فعال، آزمایش دوباره را لازم می‌کند.</p>
    {data.candidates.map(item => <article key={item.id} className={boxClass}><div className="flex justify-between gap-2"><h3 className="font-medium">{item.title}</h3><span className="text-xs">{stateLabel(item.status)}</span></div><p className="whitespace-pre-line text-sm leading-7">{item.amendment}</p>{item.status === "draft" && <Button disabled={busy || promptRevision === null} variant="outline" onClick={() => action(() => api(`/candidates/${item.id}/promote`, "POST", { expected_prompt_revision: promptRevision }), "اصلاح تأییدشده به نسخهٔ فعال پرامپت اضافه شد.")}>فعال‌سازی پس از آزمون</Button>}</article>)}
  </div>
  return <div className="space-y-4">
    <form className={boxClass} onSubmit={event => { event.preventDefault(); action(async () => { const result = await api("/evaluations", "POST", { case_ids: selectedCases, candidate_id: candidate || null, model_id: model || null }); setRunId(result.id); return result }, "آزمون در صف قرار گرفت؛ گزارش عمومی و تلگرام تغییر نمی‌کنند.") }}>
      <h3 className="font-medium">آزمون روی شواهد ثابت</h3><p className="text-sm leading-7 text-muted-foreground">حداکثر پنج نمونه در هر اجرا. با انتخاب پیشنهاد، هر نمونه با دستور پایه و پیشنهادی اجرا می‌شود و مصرف بیشتری دارد. داده و گزارش قبلی هر دو ثابت می‌مانند؛ دادهٔ امروز به آزمون تاریخی افزوده نمی‌شود.</p>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="مدل برای این آزمون"><select value={model} onChange={event => setModel(event.target.value)} className={fieldClass}><option value="">اولویت فعلی مدل‌های فعال</option>{data.models.filter(item => item.enabled).map(item => <option key={item.id} value={item.id}>{item.provider} · {item.model}</option>)}</select></Field><Field label="اصلاح پیشنهادی"><select value={candidate} onChange={event => setCandidate(event.target.value)} className={fieldClass}><option value="">فقط دستور پایه؛ برای مقایسهٔ مدل‌ها</option>{data.candidates.filter(item => item.status === "draft").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field></div>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm">نمونه‌های دارای ورودی اصلی</legend>{data.reports.filter(item => item.replayable && item.split !== "none").map(item => <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedCases.includes(item.id)} disabled={!selectedCases.includes(item.id) && selectedCases.length >= 5} onChange={event => setSelectedCases(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{kindLabel(item.report_kind)} · {dateLabel(item.generated_at)} · {item.split === "holdout" ? "آزمون مستقل" : "توسعه"}</label>)}</fieldset>
      <Button disabled={busy || selectedCases.length === 0}>اجرای آزمون با مصرف مدل</Button>
    </form>
    <Field label="نتیجهٔ اجرای ذخیره‌شده"><select className={fieldClass} value={runId} onChange={event => setRunId(event.target.value)}><option value="">انتخاب اجرا</option>{data.evaluations.map(item => <option key={item.id} value={item.id}>{dateLabel(item.created_at)} · {stateLabel(item.status)} · {item.case_ids.length} نمونه</option>)}</select></Field>
    {runError && <p role="alert" className="text-sm text-amber-600">{runError}</p>}
    {run && <><p className="text-xs">وضعیت: {stateLabel(run.status)} {run.error_code && `· ${run.error_code}`}</p>{run.results.map(pair => <PairReview key={`${pair.case_id}-${run.revision}`} pair={pair} run={run} api={api} action={action} busy={busy} onChange={setRun} />)}</>}
  </div>
}
