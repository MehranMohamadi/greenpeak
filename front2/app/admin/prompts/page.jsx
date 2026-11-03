import { requireAdminPage } from "@/lib/admin-page"
import PromptManager from "@/components/workplace/prompt-manager"

export default async function PromptsPage() {
  await requireAdminPage()
  return <PromptManager />
}
