"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarHover } from "../../app/context/sidebar-hover-context";

export default function TopNav() {
  const pathname = usePathname();
  const { hoveredItem, selectedRightItem } = useSidebarHover();

  const routeLabels = {
    "/": "Dashboard",
    "/analytics": "Analytics",
    "/sp500": "S&P 500",
    "/analytics/monetary-policy": "Monetary Policy",
    "/analytics/systemic-risk": "Systemic Risk",
    "/analytics/liquidity-flows": "Liquidity Flows",
    "/analytics/macroeconomic": "Macroeconomic",
    "/analytics/corporate-earnings": "Corporate Earnings",
    "/analytics/valuation": "Valuation",
    "/analytics/sector-performance": "Sector Performance",
    "/analytics/derivatives": "Derivatives",
    "/analytics/market-internals": "Market Internals",
    "/analytics/intermarket": "Intermarket",
    "/analytics/sentiment": "Sentiment",
    "/analytics/macro-calendar": "Macro Calendar & News",
    "/analytics/institutional": "Institutional",
    "/analytics/feature-pipeline-debug": "Feature Pipeline JSON",
    "/settings": "Settings",
    "/help": "Help",
    "/test-charts": "Test Charts",
    "/fun": "حیاط",
  };

  const generateBreadcrumbs = () => {
    const pathSegments = pathname.split("/").filter(Boolean);
    const isFunRoute = pathname === "/fun" || pathname.startsWith("/fun/");
    const breadcrumbs = isFunRoute
      ? [{ label: "فان", href: "/fun" }]
      : [{ label: "GreenPeak", href: "/" }];

    if (pathname === "/") {
      breadcrumbs.push({ label: "Dashboard", href: null });
      return breadcrumbs;
    }

    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;
      const label =
        routeLabels[currentPath] ||
        segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      breadcrumbs.push({
        label,
        href: isLast ? null : currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  const isFunRoute = pathname === "/fun" || pathname.startsWith("/fun/");

  const effectiveBreadcrumbs = (() => {
    if (isFunRoute) {
      const rightItem = hoveredItem?.side === "right" ? hoveredItem : selectedRightItem;
      return rightItem?.trail || [{ label: "فان", href: "/fun" }, { label: "حیاط" }];
    }
    const activeSide = isFunRoute ? "right" : "left";
    if (!hoveredItem || hoveredItem.side !== activeSide || breadcrumbs.length === 0) return breadcrumbs;
    const base = breadcrumbs.slice(0, -1);  
    return [
      ...base,
      {
        label: hoveredItem.label,
      },
    ];
  })();

  return (
    <nav className={`px-3 sm:px-6 flex items-center bg-white dark:bg-[#0F0F12] border-b border-gray-200 dark:border-[#1F1F23] h-full ${isFunRoute ? "justify-end" : "justify-start"}`}>
      <div dir={isFunRoute ? "rtl" : "ltr"} className="font-medium text-sm hidden sm:flex items-center gap-1 truncate max-w-[500px]">
        {effectiveBreadcrumbs.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center">
            {index > 0 && (
              isFunRoute
                ? <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400 mx-1" />
                : <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400 mx-1" />
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900 dark:text-gray-100">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>

    </nav>
  );
}
