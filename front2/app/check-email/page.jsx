import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900 px-4 py-6">
      <Card className="w-full max-w-md border-slate-700/50 bg-slate-900/80 text-center shadow-2xl">
        <CardHeader className="items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
            <MailCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl text-white">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-slate-300">
            Open Gmail or your email inbox and click the GreenPeak verification link to activate your account. You can sign in after verifying your email.
          </p>
          <p className="text-sm text-slate-400">Can&apos;t find the email? Check your Spam or Junk folder.</p>
          <Button asChild className="w-full bg-cyan-600 text-white hover:bg-cyan-700">
            <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer">Open Gmail</a>
          </Button>
          <div className="flex justify-between text-sm text-cyan-400">
            <Link href="/resend-verification" className="hover:text-cyan-300">Resend verification email</Link>
            <Link href="/login" className="hover:text-cyan-300">Back to sign in</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
