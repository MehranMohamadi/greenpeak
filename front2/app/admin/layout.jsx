import { requireAdminPage } from "@/lib/admin-page"

export default async function AdminLayout({ children }) {
  await requireAdminPage()
  return children
}
