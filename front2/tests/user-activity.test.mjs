import assert from "node:assert/strict"
import test from "node:test"
import { startSessionHeartbeat } from "../lib/user-activity.mjs"

function browser(visibilityState = "visible") {
  const document = Object.assign(new EventTarget(), { visibilityState })
  const window = Object.assign(new EventTarget(), {
    setInterval(callback, delay) { this.timers = (this.timers || 0) + 1; this.tick = callback; assert.equal(delay, 60000); return 1 },
    clearInterval(id) { assert.equal(id, 1); this.cleared = true },
  })
  return { document, window }
}

test("one timer checks sessions; only visible pages record passive activity", async () => {
  const surfaces = browser()
  const calls = []
  const stop = startSessionHeartbeat({ ...surfaces, refresh: async ({ recordActivity }) => { calls.push(recordActivity) } })
  await Promise.resolve()
  assert.deepEqual(calls, [true]) // Restored sessions count without a new login.
  await surfaces.window.tick()
  assert.deepEqual(calls, [true, true]) // No mouse or keyboard interaction required.
  surfaces.document.visibilityState = "hidden"
  surfaces.document.dispatchEvent(new Event("visibilitychange"))
  await surfaces.window.tick()
  surfaces.window.dispatchEvent(new Event("focus"))
  assert.deepEqual(calls, [true, true, false]) // Hidden tabs still validate the session.
  surfaces.document.visibilityState = "visible"
  surfaces.document.dispatchEvent(new Event("visibilitychange"))
  await Promise.resolve()
  assert.deepEqual(calls, [true, true, false, true])
  stop()
  await surfaces.window.tick()
  surfaces.document.dispatchEvent(new Event("visibilitychange"))
  surfaces.window.dispatchEvent(new Event("focus"))
  assert.deepEqual(calls, [true, true, false, true])
  assert.equal(surfaces.window.cleared, true)
  assert.equal(surfaces.window.timers, 1)
})

test("hidden startup waits for the session timer and failed requests retry", async () => {
  const surfaces = browser("hidden")
  const calls = []
  const stop = startSessionHeartbeat({ ...surfaces, refresh: async ({ recordActivity }) => { calls.push(recordActivity); throw new Error("offline") } })
  assert.deepEqual(calls, [])
  await surfaces.window.tick()
  assert.deepEqual(calls, [false])
  surfaces.document.visibilityState = "visible"
  await surfaces.window.tick()
  await surfaces.window.tick()
  assert.deepEqual(calls, [false, true, true])
  stop()
})

test("overlapping events send once and cleanup aborts the pending request", async () => {
  const surfaces = browser()
  let calls = 0
  let signal
  let resolve
  const stop = startSessionHeartbeat({ ...surfaces, refresh: value => {
    calls++; signal = value.signal
    return new Promise(done => { resolve = done })
  } })
  await surfaces.window.tick()
  surfaces.window.dispatchEvent(new Event("focus"))
  assert.equal(calls, 1)
  stop()
  assert.equal(signal.aborted, true)
  resolve()
})
