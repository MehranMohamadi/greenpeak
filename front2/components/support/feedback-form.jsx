"use client"

import { useState } from "react"
import { LoaderCircle, Send } from "lucide-react"
import { endpoints } from "@/api/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const INITIAL_FORM = { name: "", email: "", category: "suggestion", message: "" }

const CATEGORIES = [
  ["comment", "نظر"],
  ["suggestion", "پیشنهاد"],
  ["question", "سؤال درباره استفاده از سایت"],
  ["bug", "گزارش مشکل"],
]

export default function FeedbackForm() {
  const [form, setForm] = useState(INITIAL_FORM)
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState({ type: "", text: "" })

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submitFeedback = async (event) => {
    event.preventDefault()
    setIsSending(true)
    setFeedback({ type: "", text: "" })
    try {
      const response = await fetch(endpoints.support.feedback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = typeof payload?.detail === "string" ? payload.detail : "ارسال پیام انجام نشد. کمی بعد دوباره تلاش کنید."
        throw new Error(message)
      }
      setForm(INITIAL_FORM)
      setFeedback({ type: "success", text: payload?.message || "پیام شما به تیم پشتیبانی ارسال شد." })
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "ارتباط با سرویس پشتیبانی برقرار نشد. از ایمیل پشتیبانی استفاده کنید." })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="h-full border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">نظرات و پیشنهادها</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          پیشنهاد، سؤال یا مشکلی درباره استفاده از GreenPeak دارید؟ پیام را بفرستید تا به ایمیل پشتیبانی برسد.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitFeedback} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              <span>نام</span>
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={80}
                value={form.name}
                onChange={updateField}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>ایمیل برای پاسخ</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                required
                maxLength={254}
                value={form.email}
                onChange={updateField}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-left text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>موضوع</span>
            <select
              name="category"
              value={form.category}
              onChange={updateField}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>پیام</span>
            <textarea
              name="message"
              required
              minLength={5}
              maxLength={5000}
              rows={4}
              value={form.message}
              onChange={updateField}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">
            پیام شما به ایمیل GreenPeak ارسال می‌شود؛ پاسخ را از طریق ایمیلی که وارد کرده‌اید دریافت می‌کنید.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSending} className="gap-2">
              {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "در حال ارسال…" : "ارسال پیام"}
            </Button>
            {feedback.text && <p role={feedback.type === "error" ? "alert" : "status"} className={`text-sm ${feedback.type === "error" ? "text-destructive" : "text-primary"}`}>{feedback.text}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
