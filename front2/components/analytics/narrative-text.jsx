export function NarrativeList({ title, items }) {
  if (!items?.length) return null
  return <section className="space-y-1">
    <h4 className="text-sm font-medium">{title}</h4>
    <ul className="list-disc space-y-1 ps-5 text-sm leading-7">{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : <>{item.title_fa || item.fact || item.title || item.driver || item.risk || item.conflict || item.text}{(item.detail_fa || item.detail || item.description || item.explanation) && <p>{item.detail_fa || item.detail || item.description || item.explanation}</p>}</>}</li>)}</ul>
  </section>
}

export function NarrativeDates({ analysis, observationDate }) {
  const dataDate = analysis.data_as_of || analysis.as_of_date
  const different = observationDate && observationDate !== "N/A" && dataDate && String(observationDate).slice(0, 10) !== dataDate
  return <div className="space-y-1 text-xs leading-6 text-muted-foreground">
    {analysis.coverage?.status !== "full" && <p className="text-amber-700 dark:text-amber-400">این تحلیل بر پایهٔ پوشش ناقص داده‌ها تهیه شده است.</p>}
    {!!analysis.warnings?.length && <p className="text-amber-700 dark:text-amber-400">داده‌های این تحلیل دارای محدودیت کیفیت یا دسترسی هستند.</p>}
    <p>دادهٔ تحلیل تا <bdi>{dataDate || "نامشخص"}</bdi> · تولید تحلیل <bdi>{analysis.analysis_generated_at?.slice(0, 10) || "نامشخص"}</bdi></p>
    {different && <p className="text-amber-700 dark:text-amber-400">تاریخ دادهٔ تحلیل با آخرین دادهٔ نمودار (<bdi>{String(observationDate).slice(0, 10)}</bdi>) متفاوت است.</p>}
  </div>
}
