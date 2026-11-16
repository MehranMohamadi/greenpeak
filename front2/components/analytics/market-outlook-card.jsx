"use client"

import PremiumAnalysisGate from "@/components/analytics/premium-analysis-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatGregorianTehranDateTime } from "@/lib/date-format"

export default function MarketOutlookCard({ title, horizon, view, legacyText, assessedAt, weeklyFocus, weeklyEvents = [], weeklyAssessedAt, embedded = false }) {
  const assessmentTime = view?.assessed_at || assessedAt
  const Container = embedded ? "section" : Card
  const Header = embedded ? "header" : CardHeader
  const Content = embedded ? "div" : CardContent
  return <Container className={embedded ? "min-w-0 space-y-3" : "min-w-0 border-border bg-card"}>
    <Header className={embedded ? "space-y-2" : "space-y-2 pb-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-xs text-muted-foreground">{horizon}</span>
      </div>
    </Header>
    <Content>
      <PremiumAnalysisGate>
        {view || legacyText ? <div className="space-y-3">
          <p className="text-sm font-medium leading-7">{view?.summary_fa || "آخرین چشم‌انداز ثبت‌شده در جزئیات قابل مطالعه است."}</p>
          {view?.change_condition_fa && <p className="text-sm leading-7 text-muted-foreground"><span className="font-medium text-foreground">شرط تغییر دید: </span>{view.change_condition_fa}</p>}
          {view?.change_summary_fa && <p className="rounded-lg bg-muted/25 px-3 py-2 text-xs leading-6 text-muted-foreground"><span className="font-medium text-foreground">نتیجهٔ آخرین بازبینی: </span>{view.change_summary_fa}</p>}
          {assessmentTime ? <time dateTime={assessmentTime} className="block text-[11px] leading-5 text-muted-foreground">آخرین ارزیابی: {formatGregorianTehranDateTime(assessmentTime)} تهران</time> : <p className="text-[11px] text-muted-foreground">زمان ارزیابی ثبت نشده است.</p>}
          <details className="group border-t border-border pt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">دلایل و سناریوها</summary>
            <div className="mt-3 space-y-3 text-sm leading-8 text-muted-foreground">
              <p className="whitespace-pre-line">{view?.detail_fa || legacyText}</p>
              {view?.data_as_of && <p className="text-xs">تاریخ مرجع شواهد گروه‌ها: {view.data_as_of}</p>}
              {weeklyFocus && <div className="space-y-2 border-t border-border pt-3">
                <p className="font-medium text-foreground">موضوع اصلی هفته</p><p>{weeklyFocus}</p>
                {weeklyAssessedAt && <time dateTime={weeklyAssessedAt} className="block text-[11px]">ارزیابی هفتگی: {formatGregorianTehranDateTime(weeklyAssessedAt)} تهران</time>}
                {weeklyEvents.length > 0 && <><p className="font-medium text-foreground">رویدادهای تعیین‌کننده</p><ul className="list-inside list-disc space-y-1">{weeklyEvents.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></>}
              </div>}
            </div>
          </details>
        </div> : <p className="text-sm leading-7 text-muted-foreground">هنوز ارزیابی مستقلی برای این افق ثبت نشده است.</p>}
      </PremiumAnalysisGate>
    </Content>
  </Container>
}
