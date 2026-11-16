"use client"

import PremiumAnalysisGate from "@/components/analytics/premium-analysis-gate"
import AnalysisDetailsDialog from "@/components/analytics/analysis-details-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatGregorianTehranDateTime } from "@/lib/date-format"

export default function MarketOutlookCard({ title = "چشم‌انداز بازار", horizon, view, legacyText, assessedAt, weeklyFocus, weeklyEvents = [], weeklyAssessedAt, embedded = false }) {
  const assessmentTime = view?.assessed_at || assessedAt
  const summary = view?.summary_fa || (embedded ? view?.detail_fa || legacyText : "آخرین چشم‌انداز ثبت‌شده در جزئیات قابل مطالعه است.")
  const explanation = view?.detail_fa || legacyText
  const hasDetails = Boolean(explanation && explanation !== summary || weeklyFocus || weeklyEvents.length || view?.change_status === "unchanged" && view?.change_summary_fa)
  const Container = embedded ? "section" : Card
  const Header = embedded ? "header" : CardHeader
  const Content = embedded ? "div" : CardContent
  return <Container className={embedded ? "min-w-0 space-y-2" : "min-w-0 border-border bg-card"}>
    {!embedded && <Header className="space-y-2 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-xs text-muted-foreground">{horizon}</span>
      </div>
    </Header>}
    <Content className="text-[13px] font-medium leading-[26px] text-black dark:text-white">
      <PremiumAnalysisGate>
        {view || legacyText ? <div className="space-y-2">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-line">{summary}</p>
            {hasDetails && <AnalysisDetailsDialog title={title}>
              {explanation && explanation !== summary && <p className="whitespace-pre-line">{explanation}</p>}
              {view?.change_status === "unchanged" && view.change_summary_fa && <p>نتیجهٔ آخرین بازبینی: {view.change_summary_fa}</p>}
              {view?.data_as_of && <p className="text-xs">تاریخ مرجع شواهد گروه‌ها: {view.data_as_of}</p>}
              {weeklyFocus && <div className="space-y-2 border-t border-border pt-3">
                <p>موضوع اصلی هفته</p><p>{weeklyFocus}</p>
                {weeklyAssessedAt && <time dateTime={weeklyAssessedAt} className="block text-[11px]">ارزیابی هفتگی: {formatGregorianTehranDateTime(weeklyAssessedAt)}</time>}
              </div>}
              {weeklyEvents.length > 0 && <div><p>رویدادهای تعیین‌کننده</p><ul className="list-inside list-disc space-y-1">{weeklyEvents.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>}
            </AnalysisDetailsDialog>}
          </div>
          {view?.change_condition_fa && <p className="whitespace-pre-line"><span>شرط تغییر دید: </span>{view.change_condition_fa}</p>}
          {view?.change_status === "unchanged" ? <p>بدون تغییر در آخرین بازبینی</p> : view?.change_summary_fa && <p className="whitespace-pre-line"><span>نتیجهٔ آخرین بازبینی: </span>{view.change_summary_fa}</p>}
          {!embedded && (assessmentTime ? <time dateTime={assessmentTime} className="block text-[11px] leading-5 text-muted-foreground">آخرین ارزیابی: {formatGregorianTehranDateTime(assessmentTime)}</time> : <p className="text-[11px] text-muted-foreground">زمان ارزیابی ثبت نشده است.</p>)}
        </div> : <p>هنوز ارزیابی مستقلی برای این افق ثبت نشده است.</p>}
      </PremiumAnalysisGate>
    </Content>
  </Container>
}
