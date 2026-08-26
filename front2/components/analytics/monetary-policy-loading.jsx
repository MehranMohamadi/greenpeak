import { Skeleton } from "@/components/ui/skeleton"

const rows = [0, 1, 2]

export function PolicyAnalysisSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid gap-5 lg:grid-cols-[minmax(190px,0.75fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="space-y-2.5">
          <div className="rounded-xl border bg-muted/15 p-4 text-center">
            <Skeleton className="mx-auto h-12 w-20" />
            <Skeleton className="mx-auto mt-2 h-2.5 w-16" />
            <Skeleton className="mx-auto mt-3 h-6 w-32 rounded-full" />
            <Skeleton className="mx-auto mt-3 h-3 w-40" />
          </div>
          <div className="flex justify-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </section>

        <section className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div key={row} className="flex min-h-10 items-center gap-2 rounded-lg bg-muted/25 p-2">
                <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-full" />
                <Skeleton className={`h-3 ${row === 1 ? "w-4/5" : "w-full"}`} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div key={row} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-2 rounded-full" />
                </div>
                <Skeleton className={`h-3 ${row === 2 ? "w-3/5" : "w-full"}`} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-64 max-w-full" />
    </div>
  )
}

export default function MonetaryPolicyLoadingSkeleton() {
  return (
    <div className="space-y-6 bg-white p-4 dark:bg-[#0F0F12] md:p-6" role="status" aria-label="Loading monetary policy analysis">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-72 max-w-[70vw]" />
          </div>
          <Skeleton className="h-4 w-96 max-w-[80vw]" />
        </div>
        <Skeleton className="h-10 w-32 self-end rounded-lg md:self-auto" />
      </header>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]">
        <div className="flex items-center gap-2 p-6 pb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="p-6 pt-3">
          <PolicyAnalysisSkeleton />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]">
        <div className="space-y-3 p-6 pb-3 xl:flex xl:items-center xl:justify-between xl:space-y-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-56" />
          </div>
          <div className="flex max-w-full gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-8 w-11 shrink-0" />)}
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="p-6 pt-0">
          <Skeleton className="h-[420px] w-full rounded-lg" />
          <div className="mt-4 flex items-center justify-between gap-4">
            <Skeleton className="h-7 w-72 max-w-[65%]" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-4 dark:border-[#2B2B30]">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {rows.map((row) => <Skeleton key={row} className="h-20 w-full rounded-lg" />)}
        </div>
      </section>

      <section>
        <Skeleton className="mb-4 h-6 w-56" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4].map((card) => (
            <div key={card} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#2B2B30] dark:bg-[#1F1F23]">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>

      <span className="sr-only">Loading monetary policy analysis…</span>
    </div>
  )
}
