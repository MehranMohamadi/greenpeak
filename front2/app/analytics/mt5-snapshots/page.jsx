import MT5SnapshotsDebug from "@/components/analytics/mt5-snapshots-debug"
import Layout from "@/components/kokonutui/layout"

export const metadata = {
  title: "MetaTrader Snapshot JSON | GreenPeak",
  description: "Complete JSON view of stored MetaTrader snapshots",
}

export default function MT5SnapshotsPage() {
  return <Layout><MT5SnapshotsDebug /></Layout>
}
