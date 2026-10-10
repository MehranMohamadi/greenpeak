"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArrowUp, Bot, ChevronLeft, History, Link2, Loader2, MessageCircle, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { endpoints } from "@/api/api"

const SITE_PROMPTS = ["وضعیت بازار را توضیح بده", "نرخ بهره در سه ماه گذشته چه تغییری کرده؟", "رویدادهای اقتصادی پیش رو چیست؟"]
const ACCOUNT_PROMPTS = ["وضعیت حسابم را توضیح بده", "کدام پوزیشن بیشترین ضرر را دارد؟", "پوزیشن‌هایم را با وضعیت بازار بررسی کن"]

export default function FloatingChat() {
  const { isAuthenticated, user, accessToken } = useAuth()
  if (!isAuthenticated || !accessToken) return null
  return <ChatWidget key={user.id} accessToken={accessToken} />
}

function ChatWidget({ accessToken }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [configured, setConfigured] = useState(null)
  const [retention, setRetention] = useState(30)
  const [accounts, setAccounts] = useState([])
  const [accountError, setAccountError] = useState("")
  const [conversations, setConversations] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversation, setConversation] = useState(null)
  const [scope, setScope] = useState("site")
  const [consent, setConsent] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  const [failed, setFailed] = useState(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const busyRef = useRef(false)
  const controller = useRef(null)

  useEffect(() => () => controller.current?.abort(), [])

  async function request(url, { method = "GET", body, signal } = {}) {
    const response = await fetch(url, {
      method, signal, credentials: "include", cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (response.status === 204) return null
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(
      typeof payload?.detail?.message === "string" ? payload.detail.message : response.status === 401 ? "برای ادامه دوباره وارد حساب شوید." : "دریافت اطلاعات انجام نشد؛ دوباره تلاش کنید.",
    )
    return payload
  }

  async function refreshHistory(signal) {
    const data = await request(endpoints.chat.conversations, { signal })
    setConversations(data.conversations)
  }

  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    setLoading(true)
    async function load() {
      const results = await Promise.allSettled([
        request(endpoints.chat.status, { signal: abort.signal }),
        request(endpoints.chat.conversations, { signal: abort.signal }),
        request(endpoints.chat.accounts, { signal: abort.signal }),
      ])
      if (abort.signal.aborted) return
      const [status, history, accountList] = results
      if (status.status === "fulfilled") {
        setConfigured(status.value.configured)
        setRetention(status.value.retention_days)
      } else {
        setError(status.reason.message || "اتصال به دستیار برقرار نشد.")
      }
      if (history.status === "fulfilled") setConversations(history.value.conversations)
      else setError(history.reason.message)
      if (accountList.status === "fulfilled") {
        setAccounts(accountList.value.accounts)
        setAccountError("")
      } else setAccountError(accountList.reason.message)
      setLoading(false)
    }
    load()
    return () => abort.abort()
    // Refresh only when the panel is opened or the authenticated token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accessToken])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, sending, open])

  function newConversation(nextScope = scope) {
    if (busyRef.current) return
    setScope(nextScope)
    setConversation(null)
    setMessages([])
    setDraft("")
    setError("")
    setFailed(null)
    setHistoryOpen(false)
    setConsent(false)
    inputRef.current?.focus()
  }

  async function selectConversation(id) {
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    setError("")
    try {
      const data = await request(endpoints.chat.conversation(id))
      setConversation(data)
      setScope(data.scope === "site" ? "site" : data.connection_id)
      setConsent(data.scope === "account")
      setMessages(data.messages)
      setDraft("")
      setFailed(null)
      setHistoryOpen(false)
    } catch (err) { setError(err.message) }
    finally { busyRef.current = false; setLoading(false) }
  }

  async function deleteConversation(id) {
    if (busyRef.current) return
    busyRef.current = true
    setLoading(true)
    try {
      await request(endpoints.chat.conversation(id), { method: "DELETE" })
      if (conversation?.id === id) {
        setConversation(null)
        setMessages([])
        setFailed(null)
        setDraft("")
      }
      await refreshHistory()
    } catch (err) { setError(err.message) }
    finally { busyRef.current = false; setLoading(false) }
  }

  async function send(text = draft, retry = null) {
    const content = text.trim()
    if (!content || content.length > 2000 || busyRef.current || loading || configured !== true || (scope !== "site" && !consent)) return
    busyRef.current = true
    setSending(true)
    setError("")
    setHistoryOpen(false)
    const abort = new AbortController()
    controller.current = abort
    const requestId = retry?.requestId || crypto.randomUUID()
    const pending = { id: requestId + ":user", role: "user", content, created_at: new Date().toISOString() }
    if (!retry) setMessages(previous => [...previous.filter(item => item.id !== failed?.requestId + ":user"), pending])
    setFailed(null)
    setDraft("")
    let active = conversation
    try {
      if (!active) {
        active = await request(endpoints.chat.conversations, {
          method: "POST", signal: abort.signal,
          body: { scope: scope === "site" ? "site" : "account", connection_id: scope === "site" ? null : scope, account_data_consent: consent },
        })
        setConversation(active)
      }
      const answer = await request(endpoints.chat.messages(active.id), {
        method: "POST", signal: abort.signal,
        body: { content, request_id: requestId, page_path: /^\/[a-zA-Z0-9/_-]*$/.test(pathname) ? pathname.slice(0, 180) : "/dashboard" },
      })
      setMessages(previous => [...previous, answer])
      // History refresh is independent: a successful answer must not become a failed send.
      try { await refreshHistory(abort.signal) } catch { /* refresh on next panel open */ }
      inputRef.current?.focus()
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "ارتباط با دستیار قطع شد؛ دوباره تلاش کنید.")
        setFailed({ content, requestId })
        setDraft(content)
      }
    } finally {
      busyRef.current = false
      setSending(false)
    }
  }

  const selectedAccount = accounts.find(account => account.id === scope)
  const prompts = scope === "site" ? SITE_PROMPTS : ACCOUNT_PROMPTS
  const blocked = loading || sending || configured !== true || (scope !== "site" && !consent)

  return <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
    <Dialog.Trigger asChild>
      <button type="button" aria-label={open ? "بستن دستیار GreenPeak" : "گفت‌وگو با دستیار GreenPeak"}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/20 transition duration-200 hover:scale-105 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 motion-reduce:transform-none lg:right-24">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-7 w-7" />}
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Content dir="rtl" aria-describedby={undefined} onInteractOutside={event => event.preventDefault()}
        onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }}
        className="fixed bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4.5rem)] right-3 z-[70] flex h-[min(640px,calc(100dvh-120px))] w-[calc(100vw-1.5rem)] max-w-[420px] flex-col overflow-hidden rounded-3xl border border-primary/15 bg-card text-card-foreground shadow-2xl shadow-foreground/10 outline-none sm:right-6 lg:right-24">
        <header className="flex shrink-0 items-center gap-3 border-b border-primary/10 bg-gradient-to-l from-primary/10 to-card px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/20"><Bot className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1"><Dialog.Title className="text-sm font-semibold">دستیار GreenPeak</Dialog.Title></div>
          <button type="button" aria-label="گفت‌وگوی جدید" title="گفت‌وگوی جدید" disabled={sending || loading} onClick={() => newConversation()} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="تاریخچهٔ گفت‌وگوها" title="تاریخچه" disabled={sending || loading} onClick={() => setHistoryOpen(value => !value)} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-40"><History className="h-4 w-4" /></button>
          <Dialog.Close className="rounded-lg p-1.5 hover:bg-muted" aria-label="بستن چت"><X className="h-4 w-4" /></Dialog.Close>
        </header>

        <div className="shrink-0 space-y-2 border-b px-4 py-2.5">
          <label className="flex items-center gap-2 text-xs"><span className="shrink-0 text-muted-foreground">موضوع:</span>
            <select aria-label="انتخاب داده‌های سایت یا حساب متاتریدر" value={scope} disabled={sending || loading} onChange={event => newConversation(event.target.value)} className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40">
              <option value="site">داده‌های سایت</option>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.label} · {account.broker} · {account.account_label} · {account.server}</option>)}
              {scope !== "site" && !selectedAccount && <option value={scope}>حساب قبلی — اتصال در دسترس نیست</option>}
            </select></label>
          {scope !== "site" && !conversation && <label className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-primary" />برای پاسخ‌گویی، اطلاعات لازم این حساب توسط ارائه‌دهندهٔ مدل پردازش شود.</label>}
          {selectedAccount && <p className="text-[10px] text-muted-foreground">آخرین دریافت اتصال: {formatTime(selectedAccount.last_seen_at)}</p>}
          {accountError && scope === "site" && <p className="text-[10px] text-muted-foreground">{accountError} پرسش از سایت در دسترس است.</p>}
          {!loading && !accountError && !accounts.length && <a href="/profile" className="group flex items-start gap-2.5 rounded-2xl border border-primary/15 bg-primary/5 p-3 transition hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-medium">حسابتان را به گفت‌وگو اضافه کنید</span><span className="mt-1 block text-[11px] leading-5 text-muted-foreground">متاتریدر را در پروفایل متصل کنید و دربارهٔ حساب و پوزیشن‌هایتان بپرسید.</span><span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary">اتصال متاتریدر<ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none" /></span></span>
          </a>}
        </div>

        {configured === false && <div role="status" className="shrink-0 border-b bg-amber-500/10 px-4 py-3 text-xs leading-6">دستیار هنوز فعال نشده است. تنظیمات مدل باید توسط مدیر سایت تکمیل شود.</div>}

        {historyOpen ? <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-3 text-[11px] text-muted-foreground">گفت‌وگوها تا {retention} روز پس از آخرین فعالیت نگهداری می‌شوند.</p>
          {!conversations.length && <p className="py-8 text-center text-sm text-muted-foreground">هنوز گفت‌وگویی ندارید.</p>}
          {conversations.map(item => <div key={item.id} className="mb-2 flex items-center gap-2 rounded-xl border p-2">
            <button type="button" disabled={loading} onClick={() => selectConversation(item.id)} className="min-w-0 flex-1 text-right"><p className="truncate text-xs font-medium">{item.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.scope === "site" ? "داده‌های سایت" : "متاتریدر"} · {formatTime(item.updated_at)}</p></button>
            <button type="button" aria-label={`حذف گفت‌وگو: ${item.title}`} disabled={loading} onClick={() => deleteConversation(item.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>)}
        </div> : <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite" aria-relevant="additions" aria-label="پیام‌های گفت‌وگو">
          {!messages.length && <div className="flex min-h-full flex-col justify-center py-2">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></span>
            <h2 className="text-base font-semibold">چه چیزی را بررسی کنیم؟</h2>
            <p className="mb-5 mt-2 text-xs leading-6 text-muted-foreground">{scope === "site" ? "دربارهٔ شاخص‌ها، تحلیل بازار و رویدادهای سایت بپرسید." : "دربارهٔ آخرین وضعیت حساب و پوزیشن‌های بازتان بپرسید."}</p>
            <div className="space-y-2">{prompts.map(prompt => <button type="button" key={prompt} disabled={blocked} onClick={() => send(prompt)} className="group flex w-full items-center justify-between gap-3 rounded-2xl border bg-background/50 px-3.5 py-3 text-right text-xs transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"><span>{prompt}</span><ChevronLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:-translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" /></button>)}</div>
          </div>}
          {messages.map(message => <ChatMessage key={message.id} message={message} />)}
          {sending && <div role="status" className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />در حال بررسی داده‌ها و آماده‌کردن پاسخ…</div>}
        </div>}

        {error && <div role="alert" className="shrink-0 border-t bg-destructive/5 px-4 py-2 text-xs leading-5 text-destructive">{error}{failed && <button type="button" disabled={sending} onClick={() => send(failed.content, failed)} className="mt-1 flex items-center gap-1 font-medium underline"><RefreshCw className="h-3 w-3" />تلاش دوباره</button>}</div>}

        <form onSubmit={event => { event.preventDefault(); send(draft, failed?.content === draft.trim() ? failed : null) }} className="shrink-0 border-t bg-background/70 p-3">
          <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
            <textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={2} disabled={sending} aria-label="پیام شما به دستیار" placeholder="سؤالتان را بنویسید…"
              onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft, failed?.content === draft.trim() ? failed : null) } }}
              className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground" />
            <button type="submit" aria-label="ارسال پیام" disabled={blocked || !draft.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">زمان داده و منابع هر پاسخ را بررسی کنید.</p>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function formatTime(value) {
  if (!value) return "نامشخص"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" }).format(date)
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 4 }).format(value) : "ناموجود"
}

function ChatMessage({ message }) {
  const isUser = message.role === "user"
  return <article className={`mb-4 min-w-0 ${isUser ? "mr-6" : "ml-1"}`} aria-label={isUser ? "پیام شما" : "پاسخ دستیار"}>
    <div className={`rounded-2xl px-3 py-2.5 text-sm leading-7 ${isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted/60"}`}>
      {isUser ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <div className="break-words [overflow-wrap:anywhere] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pr-4 [&_ol]:list-decimal [&_ol]:pr-4 [&_th]:border [&_th]:p-1 [&_td]:border [&_td]:p-1 [&_pre]:overflow-x-auto [&_pre]:text-xs">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children }) => <span>{children}</span>, img: () => null, table: ({ children }) => <div className="overflow-x-auto"><table className="w-full text-xs">{children}</table></div> }}>{message.content}</ReactMarkdown>
      </div>}
      {!isUser && <Attachments attachments={message.attachments} />}
    </div>
    {!!message.sources?.length && <details className="mt-2 rounded-lg border px-2.5 py-1 text-[10px] text-muted-foreground">
      <summary className="cursor-pointer py-1">منابع و زمان داده ({message.sources.length})</summary>
      <div className="space-y-2 py-2">{message.sources.map(source => <div key={source.id}><a href={source.href} className="font-medium text-primary underline underline-offset-2">{source.id} · {source.title}</a><p className="mt-0.5">تاریخ داده: {source.observed_at ? formatTime(source.observed_at) : "در منبع مشخص نشده"}</p>{source.status !== "available" && <p className="mt-0.5 text-amber-700 dark:text-amber-400">{({ stale: "داده قدیمی است", unavailable: "داده در دسترس نیست", dated_analysis: "تحلیل ذخیره‌شده؛ تاریخ داده را بررسی کنید", historical_dataset: "دادهٔ تاریخی؛ قیمت زنده نیست", invalid_timestamp: "زمان داده معتبر نیست", insufficient_history: "تاریخچه ناکافی است" })[source.status] || source.status}</p>}</div>)}</div>
    </details>}
  </article>
}

function Attachments({ attachments }) {
  if (!attachments) return null
  const labels = { balance: "بالانس", equity: "اکوئیتی", used_margin: "مارجین مصرف‌شده", free_margin: "مارجین آزاد", margin_level_pct: "سطح مارجین (%)", floating_profit_loss: "سود و زیان شناور" }
  const positionData = attachments.positions
  return <>
    {attachments.account && <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">{Object.entries(labels).map(([key, label]) => <div key={key} className="rounded-lg bg-background/70 p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 text-xs font-medium" dir="ltr">{number(attachments.account[key])} {key === "margin_level_pct" ? "%" : attachments.account.currency || ""}</p></div>)}</div>}
    {positionData && <div className="mt-3 border-t pt-3">
      {!positionData.positions_available ? <p className="text-xs text-muted-foreground">اطلاعات پوزیشن‌ها موجود نیست.</p> : !positionData.matched_count ? <p className="text-xs text-muted-foreground">پوزیشنی در این محدوده وجود ندارد.</p> : <><p className="mb-2 text-[10px] text-muted-foreground">{positionData.shown_count} از {positionData.matched_count} پوزیشن · سود و زیان به {positionData.currency || "ارز نامشخص"}</p><div className="max-h-60 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-muted-foreground"><th className="p-1 text-right">نماد</th><th className="p-1">جهت</th><th className="p-1">لات</th><th className="p-1">سود/زیان</th></tr></thead><tbody>{positionData.positions.map((position, index) => <tr key={index} className="border-t"><td className="p-1" dir="ltr">{position.symbol || "نامشخص"}</td><td className="p-1 text-center">{position.direction === "BUY" ? "خرید" : position.direction === "SELL" ? "فروش" : "نامشخص"}</td><td className="p-1 text-center">{number(position.volume)}</td><td className="p-1 text-center" dir="ltr">{number(position.current_profit_loss)}</td></tr>)}</tbody></table></div></>}
    </div>}
  </>
}
