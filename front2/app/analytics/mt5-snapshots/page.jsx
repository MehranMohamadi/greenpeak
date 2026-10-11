import MT5SnapshotsDebug from "@/components/analytics/mt5-snapshots-debug"
import Layout from "@/components/kokonutui/layout"
import { requireAdminPage } from "@/lib/admin-page"

export const metadata = {
  title: "MetaTrader Snapshot JSON | GreenPeak",
  description: "Complete JSON view of stored MetaTrader snapshots",
}

export default async function MT5SnapshotsPage() {
  await requireAdminPage()
  return <Layout><MT5SnapshotsDebug /></Layout>
}
