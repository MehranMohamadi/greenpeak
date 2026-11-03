export function mergePromptCatalog(current, incoming, savedId = null) {
  const previous = new Map(current.documents.map(item => [item.id, item]))
  const dirtyIds = new Set(current.documents.filter(item =>
    current.drafts[item.id] !== undefined && current.drafts[item.id] !== item.content,
  ).map(item => item.id))
  const documents = incoming.map(item => {
    if (!dirtyIds.has(item.id) || item.id === savedId) return item
    // Preserve the editor's baseline revision for optimistic concurrency,
    // while refreshing the read-only preview of what is currently active.
    return { ...previous.get(item.id), default_content: item.default_content,
      effective_content: item.effective_content, effective_hash: item.effective_hash }
  })
  const drafts = Object.fromEntries(documents.map(item => [item.id,
    dirtyIds.has(item.id) && item.id !== savedId ? current.drafts[item.id] : item.content,
  ]))
  return { documents, drafts }
}
