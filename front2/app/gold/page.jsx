import Layout from "@/components/kokonutui/layout"

export const metadata = {
  title: "طلا Gold | GreenPeak",
  description: "صفحه بازار طلا در GreenPeak؛ به زودی...",
}

export default function GoldPage() {
  return (
    <Layout>
      <section className="space-y-4 px-3 py-3 md:px-4" dir="rtl">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">طلا <span dir="ltr">Gold</span></h1>
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-border bg-card">
          <p className="text-lg text-muted-foreground">به زودی...</p>
        </div>
      </section>
    </Layout>
  )
}
