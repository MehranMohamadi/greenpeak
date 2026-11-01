const DAY = 86_400_000
export const emptyProgress = () => ({ version: 1, lessons: {}, cards: {} })
const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value))

export function parseProgress(raw, lessons, cards) {
  const result = emptyProgress()
  try {
    const data = JSON.parse(raw)
    if (data?.version !== 1) return result
    for (const lesson of lessons) {
      if (validDate(data.lessons?.[lesson.id])) result.lessons[lesson.id] = data.lessons[lesson.id]
    }
    for (const card of cards) {
      const entry = data.cards?.[card.id]
      if (!entry || !validDate(entry.reviewedAt) || !validDate(entry.nextReviewAt) || typeof entry.lastCorrect !== "boolean") continue
      if (![entry.attempts, entry.streak].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000)) continue
      result.cards[card.id] = { reviewedAt: entry.reviewedAt, nextReviewAt: entry.nextReviewAt, lastCorrect: entry.lastCorrect, attempts: entry.attempts, streak: entry.streak }
    }
  } catch {}
  return result
}

export function recordReview(progress, cardId, correct, confidence, now = new Date()) {
  const previous = progress.cards[cardId]
  const confident = correct && confidence === "known"
  // Repeating a card in the same day cannot manufacture mastery.
  const spaced = previous && now.getTime() - Date.parse(previous.reviewedAt) >= DAY
  const streak = confident ? (previous ? previous.streak + (spaced ? 1 : 0) : 1) : 0
  const interval = confident ? (streak >= 3 ? 7 : streak >= 2 ? 3 : 1) * DAY : confidence === "unsure" && correct ? DAY : 10 * 60_000
  return { ...progress, cards: { ...progress.cards, [cardId]: {
    reviewedAt: now.toISOString(), nextReviewAt: new Date(now.getTime() + interval).toISOString(),
    lastCorrect: Boolean(correct), streak, attempts: Math.min((previous?.attempts || 0) + 1, 1_000_000),
  } } }
}

export function dailyCards(cards, progress, now = new Date()) {
  const due = cards.filter(card => progress.cards[card.id] && Date.parse(progress.cards[card.id].nextReviewAt) <= now.getTime())
    .sort((a, b) => Date.parse(progress.cards[a.id].nextReviewAt) - Date.parse(progress.cards[b.id].nextReviewAt))
  const fresh = cards.find(card => !progress.cards[card.id] && progress.lessons[card.lessonId])
  return [...due.slice(0, 2), ...(fresh ? [fresh] : [])]
}

export function weeklyCards(cards, lessons, now = new Date()) {
  const week = Math.floor(now.getTime() / (7 * DAY))
  return lessons.map(lesson => {
    const pool = cards.filter(card => card.lessonId === lesson.id)
    return pool[week % pool.length]
  }).filter(Boolean)
}

export function learningStats(progress, cards, lessons) {
  return {
    studied: lessons.filter(lesson => progress.lessons[lesson.id]).length,
    seen: cards.filter(card => progress.cards[card.id]).length,
    mastered: cards.filter(card => progress.cards[card.id]?.streak >= 2).length,
    weak: cards.filter(card => progress.cards[card.id] && (!progress.cards[card.id].lastCorrect || progress.cards[card.id].streak === 0)),
  }
}
