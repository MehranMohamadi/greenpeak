import assert from "node:assert/strict"
import test from "node:test"
import { riskCards, riskLessons } from "../lib/learning-content.mjs"
import { dailyCards, emptyProgress, learningStats, parseProgress, recordReview, weeklyCards } from "../lib/learning-progress.mjs"

const start = new Date("2026-11-01T08:00:00Z")
const later = days => new Date(start.getTime() + days * 86_400_000)

test("reading is distinct from mastery; immediate repeated answers cannot create mastery", () => {
  let progress = { ...emptyProgress(), lessons: { foundations: start.toISOString() } }
  assert.equal(learningStats(progress, riskCards, riskLessons).mastered, 0)
  progress = recordReview(progress, "foundations-1", true, "known", start)
  progress = recordReview(progress, "foundations-1", true, "known", new Date(start.getTime() + 60_000))
  assert.equal(learningStats(progress, riskCards, riskLessons).seen, 1)
  assert.equal(learningStats(progress, riskCards, riskLessons).mastered, 0)
  progress = recordReview(progress, "foundations-1", true, "known", later(2))
  assert.equal(learningStats(progress, riskCards, riskLessons).mastered, 1)
  progress = recordReview(progress, "foundations-1", false, "known", later(5))
  assert.equal(learningStats(progress, riskCards, riskLessons).mastered, 0)
  assert.deepEqual(learningStats(progress, riskCards, riskLessons).weak.map(card => card.id), ["foundations-1"])
})

test("missed days do not grow a daily session; overdue reviews precede an eligible new card", () => {
  let progress = { ...emptyProgress(), lessons: { foundations: start.toISOString() } }
  assert.deepEqual(dailyCards(riskCards, emptyProgress(), start), [])
  for (const card of riskCards.slice(0, 4)) progress = recordReview(progress, card.id, false, "unknown", start)
  const selected = dailyCards(riskCards, progress, later(20))
  assert.equal(selected.length, 3)
  assert.deepEqual(selected.map(card => card.id), ["foundations-1", "foundations-2", "foundations-5"])
  assert.equal(dailyCards(riskCards, progress, start).length, 1)
})

test("wrong answers and uncertainty receive earlier reviews without granting mastery", () => {
  const known = recordReview(emptyProgress(), "types-1", true, "known", start).cards["types-1"]
  const wrong = recordReview(emptyProgress(), "types-1", false, "known", start).cards["types-1"]
  const unsure = recordReview(emptyProgress(), "types-1", true, "unsure", start).cards["types-1"]
  assert(Date.parse(wrong.nextReviewAt) < Date.parse(known.nextReviewAt))
  assert.equal(wrong.streak, 0)
  assert.equal(unsure.streak, 0)
})

test("reload restores valid progress while damaged or unrelated stored records are ignored", () => {
  const progress = recordReview(emptyProgress(), "beta-3", true, "known", start)
  assert.deepEqual(parseProgress(JSON.stringify(progress), riskLessons, riskCards), progress)
  for (const raw of [null, "bad json", "[]", '{"version":2}', '{"version":1,"cards":{"beta-3":{"streak":"bad"}}}']) {
    assert.deepEqual(parseProgress(raw, riskLessons, riskCards), emptyProgress())
  }
  const injected = { ...progress, lessons: { unknown: start.toISOString() }, cards: { ...progress.cards, unknown: progress.cards["beta-3"] } }
  assert.deepEqual(Object.keys(parseProgress(JSON.stringify(injected), riskLessons, riskCards).cards), ["beta-3"])
  const invalid = { ...progress, cards: { "beta-3": { ...progress.cards["beta-3"], nextReviewAt: "invalid" } } }
  assert.deepEqual(parseProgress(JSON.stringify(invalid), riskLessons, riskCards), emptyProgress())
})

test("weekly quiz covers every risk lesson once and exercises carry complete answer explanations", () => {
  const quiz = weeklyCards(riskCards, riskLessons, start)
  assert.equal(quiz.length, 6)
  assert.equal(new Set(quiz.map(card => card.lessonId)).size, 6)
  assert.deepEqual(weeklyCards(riskCards, riskLessons, start), quiz)
  assert.notDeepEqual(weeklyCards(riskCards, riskLessons, later(7)), quiz)
  assert.equal(new Set(riskCards.map(card => card.id)).size, 30)
  for (const card of riskCards) {
    assert(card.options[card.answer])
    assert.equal(card.options.length, card.reasons.length)
    assert(card.reasons.every(Boolean) && card.explanation && card.source)
  }
})
