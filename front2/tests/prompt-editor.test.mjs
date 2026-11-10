import assert from "node:assert/strict"
import test from "node:test"
import { mergePromptCatalog } from "../lib/prompt-editor.mjs"

const document = (id, revision, content) => ({ id, revision, content, effective_content: content, effective_hash: `hash-${revision}`, default_content: "default" })

test("refresh adopts new server text for unedited prompts without creating a stale draft", () => {
  const result = mergePromptCatalog({ documents: [document("market", 1, "old")], drafts: { market: "old" } }, [document("market", 2, "new")])
  assert.equal(result.documents[0].revision, 2)
  assert.equal(result.drafts.market, "new")
})

test("refresh preserves unsaved text and its original revision when another admin edits", () => {
  const update_schedule = { default_summary_fa: "daily at 16:00", configured_summary_fa: "disabled", details_fa: "daily cycle" }
  const result = mergePromptCatalog({ documents: [document("market", 1, "old")], drafts: { market: "unsaved" } }, [{ ...document("market", 2, "remote"), update_schedule }])
  assert.equal(result.documents[0].revision, 1)
  assert.equal(result.documents[0].content, "old")
  assert.equal(result.documents[0].effective_content, "remote")
  assert.equal(result.drafts.market, "unsaved")
  assert.deepEqual(result.documents[0].update_schedule, update_schedule)
})

test("saving one prompt retains other drafts and their concurrency baselines", () => {
  const result = mergePromptCatalog({ documents: [document("market", 1, "old"), document("indicator", 0, "base")],
    drafts: { market: "saved", indicator: "still editing" } }, [document("market", 2, "saved"), document("indicator", 1, "remote")], "market")
  assert.equal(result.documents[0].revision, 2)
  assert.equal(result.drafts.market, "saved")
  assert.equal(result.documents[1].revision, 0)
  assert.equal(result.drafts.indicator, "still editing")
})
