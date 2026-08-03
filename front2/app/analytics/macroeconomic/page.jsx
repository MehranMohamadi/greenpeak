"use client";

import Layout from "@/components/kokonutui/layout";
import Macroeconomic from "@/components/analytics/macroeconomic";

export default function MacroeconomicPage() {
  return (
    <Layout>
      <div className="relative">
        <Macroeconomic />
      </div>
    </Layout>
  );
}
