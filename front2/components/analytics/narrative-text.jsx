export function NarrativeList({ title, items }) {
  if (!items?.length) return null
  return <section className="space-y-1">
    <h4 className="text-sm font-medium">{title}</h4>
    <ul className="list-disc space-y-1 ps-5 text-sm leading-7">{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : <>{item.title_fa || item.fact || item.title || item.driver || item.risk || item.conflict || item.text}{(item.detail_fa || item.detail || item.description || item.explanation) && <p>{item.detail_fa || item.detail || item.description || item.explanation}</p>}</>}</li>)}</ul>
  </section>
}
