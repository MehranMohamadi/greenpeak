"use client";

import {
  BarChart2,
  Building2,
  Settings,
  HelpCircle,
  Menu,
  DollarSign,
  Activity,
  PieChart,
  Target,
  Globe,
  MessageSquare,
  Calendar,
  Brain,
  ChevronLeft,
  ChevronRight,
  Shield,
  LineChart,
  BarChart3,
  Zap,
  Users,
} from "lucide-react";

import { Home } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

import { useSidebarHover } from "../../app/context/sidebar-hover-context";

// Custom GreenPeak Icon Component
const GreenPeakIcon = ({ className }) => (
  <svg
    viewBox="0 0 818 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M263.5 219L220 187L0 480.5L228.5 252.5L484 412.5L302.5 244L438.5 78L817.5 495L437.5 0L263.5 219Z"
      fill="currentColor"
    />
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const { setHoveredItem, hoveredItem } = useSidebarHover();

  const isMainPage = pathname === "/"; // Check if we're on the main page

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(!isMainPage); // Start collapsed on non-main pages
  const [isStaticOpen, setIsStaticOpen] = useState(isMainPage); // Start static open only on main page
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(!isMainPage); // Already "auto-collapsed" on non-main pages

  // Auto-collapse after initial load with delay (only on main page)
  useEffect(() => {
    if (!isMainPage) {
      // On non-main pages, keep sidebar collapsed
      setIsCollapsed(true);
      setIsStaticOpen(false);
      setHasAutoCollapsed(true);
      return;
    }

    let timer;

    const handleContentLoaded = () => {
      // Start timer after content is loaded (only on main page)
      timer = setTimeout(() => {
        if (!hasAutoCollapsed && isMainPage) {
          setIsStaticOpen(false);
          setIsCollapsed(true);
          setHasAutoCollapsed(true);
        }
      }, 2000); // 2 second delay after content loads
    };

    // Listen for content loaded event
    window.addEventListener("contentLoaded", handleContentLoaded);

    // Fallback timer in case event doesn't fire (only on main page)
    const fallbackTimer = setTimeout(() => {
      if (!hasAutoCollapsed && isMainPage) {
        setIsStaticOpen(false);
        setIsCollapsed(true);
        setHasAutoCollapsed(true);
      }
    }, 5000); // 5 second fallback

    return () => {
      window.removeEventListener("contentLoaded", handleContentLoaded);
      if (timer) clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [hasAutoCollapsed, isMainPage]);

  // Reset sidebar state when route changes
  useEffect(() => {
    if (isMainPage) {
      // On main page, start expanded and allow auto-collapse
      setIsCollapsed(false);
      setIsStaticOpen(true);
      setHasAutoCollapsed(false);
    } else {
      // On other pages, start collapsed
      setIsCollapsed(true);
      setIsStaticOpen(false);
      setHasAutoCollapsed(true);
    }
  }, [pathname]);

  function handleNavigation() {
    setIsMobileMenuOpen(false);
  }

  // Toggle function for the arrow button
  function handleToggle() {
    setHasAutoCollapsed(true); // Prevent auto-collapse after manual interaction

    if (isStaticOpen) {
      // If currently static open, collapse it
      setIsStaticOpen(false);
      setIsCollapsed(true);
    } else {
      // If collapsed or hover-based, make it static open
      setIsStaticOpen(true);
      setIsCollapsed(false);
    }
  }

  // Determine if sidebar should be expanded
  const shouldExpand = isStaticOpen || !isCollapsed;

  // Dispatch resize event when sidebar state changes
  useEffect(() => {
    const width = shouldExpand ? 256 : 64; // 64 = w-16, 256 = w-64
    window.dispatchEvent(
      new CustomEvent("sidebarResize", {
        detail: { width },
      })
    );
  }, [shouldExpand]);

  function NavItem({
    href,
    icon: Icon,
    children,
    onClick,
    label,
    showTick = false,
    comingSoon = false,
  }) {
    const isActive = pathname === href;

    return (
      <Link
        href={href}
        onClick={onClick || handleNavigation}
        className="relative"
      onMouseEnter={() => {
  if (hoveredItem?.href !== href) {
    setHoveredItem({ label, href });
  }
}}
onMouseLeave={() => {
  if (hoveredItem) {
    setHoveredItem(null);
  }
}}
      >
        {/* Simplified active background */}
        {isActive && (
          <div className="absolute inset-0 min-w-3 bg-green-500/10 pointer-events-none dark:to-green-500/8 rounded-lg border-l-3 border-green-500 dark:border-green-400" />
        )}

        <div
          className={`
            relative flex items-center justify-center shrink-0 p-2 text-sm rounded-lg transition-colors duration-200 group z-10
            ${
              isActive
                ? "text-green-600 dark:text-green-400 font-medium"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#1F1F23]"
            }
          `}
          title={shouldExpand ? "" : children}
        >
          <Icon
            className={`h-4 w-4 flex-shrink-0 transition-colors duration-200 ${
              isActive ? "text-green-600 dark:text-green-400 h-5 w-5" : ""
            }`}
          />

          <AnimatePresence>
            {shouldExpand && (
              <span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="ml-3 whitespace-nowrap overflow-hidden flex items-center justify-between w-full"
              >
                <span>{children}</span>
                <div className="flex items-center gap-2 ml-2">
                  {showTick && (
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                      className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400"
                    >
                      <path
                        d="M6 10l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {comingSoon && (
                    <div className="absolute -right-1 -top-1 w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                </div>
              </span>
            )}
          </AnimatePresence>

          {/* Coming Soon indicator for collapsed state */}
          {comingSoon && !shouldExpand && (
            <div className="absolute -right-1 top-2 w-2 h-2 bg-amber-500 rounded-full" />
          )}
        </div>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-2 left-4 z-40 p-1 rounded-lg bg-white dark:bg-[#0F0F12] shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
      </button>
      <nav
        className={`
                fixed inset-y-0 left-0 z-40 bg-white dark:bg-[#0F0F12] transform transition-all duration-200 ease-out
                lg:translate-x-0 lg:static lg:z-auto border-r border-gray-200 dark:border-[#1F1F23]
                ${
                  isMobileMenuOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                }
                ${shouldExpand ? "w-64" : "w-16"}
            `}
        onMouseEnter={() => !isStaticOpen}
        onMouseLeave={() => !isStaticOpen}
      >
        <div className="h-full flex flex-col">
          <div
            className={`h-11 px-6 flex items-center justify-between border-b border-gray-200 dark:border-[#1F1F23] ${
              shouldExpand ? "" : "px-4"
            }`}
          >
            <AnimatePresence>
              {shouldExpand && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <Link href="/" className="flex items-center gap-3">
                    <GreenPeakIcon className="w-8 h-8 text-green-600" />
                    <span className="text-lg font-semibold hover:cursor-pointer text-gray-900 dark:text-white whitespace-nowrap">
                      {"GreenPeak Dash"}
                    </span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            {!shouldExpand && (
              <Link
                href="/"
                className="flex items-center justify-center w-full"
              >
                <GreenPeakIcon className="w-8 h-8 text-green-600" />
              </Link>
            )}
            <motion.button
              onClick={handleToggle}
              className="hidden lg:flex p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#1F1F23] transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {shouldExpand ? (
                <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              )}
            </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-2 min-h-0">
            <div className="space-y-6">
              <div>
                <AnimatePresence>
                  {shouldExpand && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 overflow-hidden"
                    >
                      Overview
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="space-y-1">
                  <NavItem href="/" icon={Home} label="Dashboard">
                    Dashboard
                  </NavItem>
                  <NavItem href="/analytics" icon={BarChart2} label="S&P 500 Intelligence">
                    S&P 500 Intelligence
                  </NavItem>
                </div>
              </div>

              <div>
                <AnimatePresence>
                  {shouldExpand && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 overflow-hidden"
                    >
                      Market Analysis
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="space-y-1">
                  <NavItem
                    label="Monetary Policy"
                    href="/analytics/monetary-policy"
                    icon={DollarSign}
                    showTick={true}
                  >
                    Monetary Policy
                  </NavItem>
                  <NavItem
                    href="/analytics/systemic-risk"
                    icon={Shield}
                    showTick={true}
                    label="Systemic Risk"
                  >
                    Systemic Risk
                  </NavItem>
                  <NavItem
                    href="/analytics/liquidity-flows"
                    icon={Activity}
                    showTick={true}
                    label="Liquidity Flows"
                  >
                    Liquidity Flows
                  </NavItem>
                  <NavItem
                    href="/analytics/macroeconomic"
                    icon={BarChart3}
                    showTick={true}
                    label="Macroeconomic"
                  >
                    Macroeconomic
                  </NavItem>
                  <NavItem
                    href="/analytics/corporate-earnings"
                    icon={Building2}
                    showTick={true}
                    label="Corporate Earnings"
                  >
                    Corporate Earnings
                  </NavItem>
                  <NavItem
                    href="/analytics/valuation"
                    icon={LineChart}
                    showTick={true}
                    label="Valuation"
                  >
                    Valuation
                  </NavItem>
                  <NavItem
                    href="/analytics/sector-performance"
                    icon={PieChart}
                    comingSoon={true}
                    label="Sector Performance"
                  >
                    Sector Performance
                  </NavItem>
                  <NavItem
                    href="/analytics/derivatives"
                    icon={Zap}
                    comingSoon={true}
                    label="Derivatives"
                  >
                    Derivatives
                  </NavItem>
                  <NavItem
                    href="/analytics/market-internals"
                    icon={Users}
                    comingSoon={true}
                    label="Market Internals"
                  >
                    Market Internals
                  </NavItem>
                  <NavItem
                    href="/analytics/intermarket"
                    icon={Globe}
                    comingSoon={true}
                    label="Intermarket"
                  >
                    Intermarket
                  </NavItem>
                  <NavItem
                    href="/analytics/sentiment"
                    icon={MessageSquare}
                    comingSoon={true}
                    label="Sentiment"
                  >
                    Sentiment
                  </NavItem>
                  <NavItem
                    href="/analytics/macro-calendar"
                    icon={Calendar}
                    comingSoon={true}
                    label="Macro Calendar & News"
                  >
                    Macro Calendar & News
                  </NavItem>
                  <NavItem
                    href="/analytics/institutional"
                    icon={Brain}
                    comingSoon={true}
                    label="Institutional"
                  >
                    Institutional
                  </NavItem>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed bottom section for Settings and Help */}
          <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 dark:border-[#1F1F23] bg-white dark:bg-[#0F0F12]">
            <div className="space-y-1">
              <NavItem href="/settings" icon={Settings}>
                Settings
              </NavItem>
              <NavItem href="/help" icon={HelpCircle}>
                Help
              </NavItem>
            </div>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
