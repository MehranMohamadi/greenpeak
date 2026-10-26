import { requireWorkplacePage } from "@/lib/admin-page"
import Workplace from "@/components/workplace/workplace"
import { workTaskIdFromSearch } from "@/lib/work-tasks.mjs"

export default async function WorkplacePage({ searchParams }) {
  const params = await searchParams
  const taskId = typeof params?.task === "string" ? workTaskIdFromSearch(new URLSearchParams({ task: params.task })) : null
  await requireWorkplacePage(taskId)
  return <Workplace />
}
