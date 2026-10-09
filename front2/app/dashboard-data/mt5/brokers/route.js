import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function DELETE(request) {
  const authorization = request.headers.get("authorization")
  if (!authorization) return NextResponse.json({ detail: "Authentication required" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.broker_company !== "string" || !body.broker_company.trim() || body.broker_company.length > 512) {
    return NextResponse.json({ detail: "نام بروکر معتبر نیست" }, { status: 400 })
  }
  const apiBase = (process.env.GREENPEAK_INTERNAL_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "")
  try {
    const response = await fetch(`${apiBase}/mt5/brokers`, {
      method: "DELETE",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ broker_company: body.broker_company }),
      cache: "no-store",
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      return NextResponse.json({ detail: "حذف داده‌های بروکر انجام نشد؛ دوباره تلاش کنید." }, { status: response.status })
    }
    if (result?.broker_company !== body.broker_company || !Array.isArray(result?.deleted_accounts)) {
      return NextResponse.json({ detail: "پاسخ حذف بروکر معتبر نیست؛ دوباره تلاش کنید." }, { status: 502 })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ detail: "سرویس حذف بروکر در دسترس نیست؛ دوباره تلاش کنید." }, { status: 503 })
  }
}
