import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import test from "node:test"
import React from "react"
import ts from "typescript"
import * as workplaceTime from "../lib/workplace-time.mjs"

const require = createRequire(import.meta.url)
const source = await readFile(new URL("../components/workplace/workplace-attendance.jsx", import.meta.url), "utf8")
const compiled = ts.transpileModule(`${source}\nexport { TimeForm, SessionCard }`, {
  fileName: "workplace-attendance.jsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function harness() {
  const state = []
  let cursor = 0
  const hooks = {
    ...React,
    useEffect: () => {},
    useId: () => "test-session-details",
    useState: initial => {
      const slot = cursor++
      if (!(slot in state)) state[slot] = typeof initial === "function" ? initial() : initial
      return [state[slot], value => { state[slot] = typeof value === "function" ? value(state[slot]) : value }]
    },
  }
  const exports = {}
  const endpoints = { workplace: { correctTimes: id => `/admin/sessions/${id}/times`, correction: id => `/me/sessions/${id}/corrections` } }
  const mocks = {
    react: hooks,
    "@/lib/workplace-time.mjs": workplaceTime,
    "@/api/api": { endpoints },
    "@/components/auth/auth-context": {},
  }
  new Function("require", "exports", compiled)(name => mocks[name] || (name.startsWith("@/components/ui/") ? new Proxy({}, { get: (_, key) => `test-${key}` }) : require(name)), exports)
  return { ...exports, render: (component, props) => { cursor = 0; return component(props) } }
}

function find(node, predicate) {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node
  for (const child of React.Children.toArray(node.props.children)) {
    const result = find(child, predicate)
    if (result) return result
  }
  return null
}

const session = {
  id: "session-test", revision: 2, activities: "saved activity", requests: [], audit: [],
  check_in: "2026-10-25T05:30:00Z", check_out: "2026-10-25T07:30:00Z",
}

test("staff requests and admin corrections close the actual session dialog after a successful save", async () => {
  for (const admin of [false, true]) {
    const card = harness()
    const form = harness()
    const calls = []
    let finish
    const props = { session, editable: !admin, admin, busy: false, perform: (...args) => {
      calls.push(args)
      return new Promise(resolve => { finish = resolve })
    } }
    let tree = card.render(card.SessionCard, props)
    find(tree, node => node.props["aria-label"]?.startsWith("اصلاح ساعت بازه")).props.onClick()
    tree = card.render(card.SessionCard, props)
    assert.equal(find(tree, node => node.type === "test-Dialog").props.open, true)
    const formProps = find(tree, node => node.type.name === "TimeForm").props
    let formTree = form.render(form.TimeForm, formProps)
    find(formTree, node => node.type === "test-Textarea").props.onChange({ target: { value: "اصلاح ساعت ورود" } })
    formTree = form.render(form.TimeForm, formProps)
    const pending = formTree.props.onSubmit({ preventDefault() {} })
    assert.equal(find(card.render(card.SessionCard, props), node => node.type === "test-Dialog").props.open, true)
    finish(true)
    await pending
    assert.equal(find(card.render(card.SessionCard, props), node => node.type === "test-Dialog").props.open, false)
    assert.equal(calls[0][1], admin ? "PUT" : "POST")
    assert.equal(calls[0][2].revision, session.revision)
  }
})

test("an unsuccessful save keeps the correction form open; rejected promises show the error in the form", async () => {
  for (const [onSave, rejects] of [[async () => false, false], [async () => { throw new Error("conflicting session") }, true]]) {
    const form = harness()
    let closed = false
    const props = { session, admin: false, busy: false, onSave, onCancel: () => { closed = true } }
    await form.render(form.TimeForm, props).props.onSubmit({ preventDefault() {} })
    assert.equal(closed, false)
    if (rejects) {
      assert.equal(find(form.render(form.TimeForm, props), node => node.props.role === "alert").props.children, "conflicting session")
    }
  }
})
