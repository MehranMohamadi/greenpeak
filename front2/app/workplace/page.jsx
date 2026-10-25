import { requireWorkplacePage } from "@/lib/admin-page"
import Workplace from "@/components/workplace/workplace"

export default async function WorkplacePage() {
  await requireWorkplacePage()
  return <Workplace />
}
