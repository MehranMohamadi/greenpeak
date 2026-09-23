"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarHover } from "@/app/context/sidebar-hover-context";
import { normalizeNavigationPath, US_MARKET } from "@/lib/navigation-state";

const routeLabels = {
  "/": "Dashboard",
  "/analytics": US_MARKET.label,
  "/analytics/monetary-policy": "Monetary Policy & System Liquidity",
  "/analytics/systemic-risk": "Credit & Financial Stability",
  "/analytics/macroeconomic": "Growth, Inflation & Labor",
  "/analytics/corporate-earnings": "Corporate Fundamentals & Earnings",
  "/analytics/valuation": "Valuation",
  "/analytics/market-internals": "Market Structure, Sectors & Concentration",
  "/analytics/intermarket": "Capital Flows & Intermarket",
  "/analytics/sentiment": "Positioning, Sentiment & Volatility",
  "/analytics/events": "News & Events",
  "/analytics/feature-pipeline-debug": "Feature Pipeline JSON",
  "/analytics/mt5-snapshots": "MetaTrader Snapshot JSON",
  "/settings": "Settings",
  "/help": "Help",
  "/test-charts": "Test Charts",
  "/fun": "حیاط",
};

export default function TopNav() {
  const pathname = normalizeNavigationPath(usePathname());
  const { hoveredItem } = useSidebarHover();
  const isFunRoute = pathname === "/fun" || pathname.startsWith("/fun/");
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbs = isFunRoute
    ? [{ label: "حال خوب", href: "/fun" }]
    : [{ label: "GreenPeak", href: "/" }];

  if (pathname === "/") breadcrumbs.push({ label: "Dashboard" });
  let currentPath = "";
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    breadcrumbs.push({
      label: routeLabels[currentPath] || segment.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      href: index === pathSegments.length - 1 ? undefined : currentPath,
    });
  });

  // Hover previews supplement the true route; an action never replaces breadcrumbs.
  const preview = hoveredItem?.side === (isFunRoute ? "right" : "left") ? hoveredItem : null;

  return (
    <nav aria-label={isFunRoute ? "مسیر راهنما" : "Breadcrumb"} className={`flex h-full min-w-0 items-center gap-4 border-b border-border bg-card px-14 lg:px-6 ${isFunRoute ? "justify-end" : "justify-start"}`}>
      <ol dir={isFunRoute ? "rtl" : "ltr"} className="flex min-w-0 items-center gap-1 text-sm font-medium">
        {breadcrumbs.map((item, index) => (
          <li key={`${item.label}-${index}`} className={`min-w-0 items-center ${index < breadcrumbs.length - 2 ? "hidden sm:flex" : "flex"}`}>
            {index > 0 && (isFunRoute
              ? <ChevronLeft aria-hidden="true" className="mx-1 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              : <ChevronRight aria-hidden="true" className="mx-1 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />)}
            {item.href ? (
              <Link href={item.href} title={item.label} className="truncate rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" title={item.label} className="truncate text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
      {preview && <span dir="auto" aria-label={isFunRoute ? "پیش‌نمایش گزینه" : "Navigation preview"} className="hidden min-w-0 truncate border-s border-gray-200 ps-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400 xl:block">{isFunRoute ? "پیش‌نمایش: " : "Preview: "}{preview.label}</span>}
    </nav>
  );
}
