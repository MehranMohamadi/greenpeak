"use client";

import { BookOpen, CandlestickChart, ChevronDown, ChevronLeft, ChevronRight, Dices, Drama, Flower2, Landmark, Menu, Mic2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useSidebarHover } from "@/app/context/sidebar-hover-context";
import { getActiveNavHref } from "@/lib/navigation-state";

const funNavigation = [
  {
    id: "mashhad",
    type: "category",
    label: "مشهد",
    icon: Landmark,
    children: [
      { id: "theater", type: "action", label: "تئاتر", icon: Drama },
      { id: "book-club", type: "action", label: "کتاب‌خوانی", icon: BookOpen },
      { id: "poetry", type: "action", label: "جلسهٔ شعر", icon: Mic2 },
    ],
  },
  { id: "yard", type: "link", label: "حیاط", href: "/fun", icon: Flower2 },
];

const funHrefs = funNavigation.filter((item) => item.type === "link").map((item) => item.href);
const rightHrefs = [...funHrefs, "/trading"];
const makeTrail = (...labels) => [
  { label: "حال خوب", href: "/fun" },
  ...labels.map((label) => ({ label })),
];
const neutralItem = "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1F1F23] dark:hover:text-white";
const itemFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 motion-reduce:transition-none";

export default function FunSidebar() {
  const pathname = usePathname();
  const submenuId = useId();
  const navId = useId();
  const mobileToggleRef = useRef(null);
  const mobileCloseRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { hoveredItem, setHoveredItem, selectedRightItem, setSelectedRightItem } = useSidebarHover();
  const activeHref = getActiveNavHref(pathname, rightHrefs);
  const isFunRoute = funHrefs.includes(activeHref);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMashhadOpen, setIsMashhadOpen] = useState(false);
  const showLabels = isExpanded || isMobileMenuOpen;
  useEffect(() => { if (isMobileMenuOpen) mobileCloseRef.current?.focus(); }, [isMobileMenuOpen]);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const escape = (event) => { if (event.key === "Escape") { setIsMobileMenuOpen(false); mobileToggleRef.current?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const preview = (label, trail, href) => setHoveredItem({ label, href, side: "right", trail });
  const clearPreview = () => {
    if (hoveredItem?.side === "right") setHoveredItem(null);
  };
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    clearPreview();
    mobileToggleRef.current?.focus();
  };
  const selectMashhad = (label, trail) => {
    setSelectedRightItem({ label, side: "right", trail });
  };
  const toggleMashhad = () => {
    selectMashhad("مشهد", makeTrail("مشهد"));
    setIsMashhadOpen((open) => !open);
  };

  return (
    <>
      <button ref={mobileToggleRef} type="button" aria-label="باز کردن منوی سرگرمی" aria-expanded={isMobileMenuOpen} aria-controls={navId} className={`fixed right-4 top-2 z-40 rounded-lg bg-white p-1 shadow-md dark:bg-[#0F0F12] lg:hidden ${itemFocus}`} onClick={() => setIsMobileMenuOpen((open) => !open)}>
        <Menu className="h-5 w-5 text-fuchsia-600" />
      </button>
      <nav id={navId} dir="rtl" aria-label="ناوبری سرگرمی" onKeyDown={(event) => { if (event.key === "Escape" && isMobileMenuOpen) closeMobileMenu(); }} className={`fixed inset-y-0 right-0 z-40 max-w-[calc(100vw-3rem)] flex-shrink-0 transform border-l border-gray-200 bg-white shadow-xl shadow-black/5 transition-[width,transform,visibility] duration-200 ease-out motion-reduce:transition-none dark:border-[#1F1F23] dark:bg-[#0F0F12] dark:shadow-black/20 lg:visible lg:translate-x-0 ${isMobileMenuOpen ? "visible translate-x-0" : "invisible translate-x-full"} ${showLabels ? "w-64" : "w-16"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className={`flex h-11 shrink-0 items-center border-b border-gray-200 px-2 dark:border-[#1F1F23] justify-between gap-1`}>
            <Link aria-label="حال خوب" title="حال خوب" href="/fun" onClick={() => { setSelectedRightItem(null); setIsMobileMenuOpen(false); }} className={`flex min-w-0 items-center gap-3 rounded-md whitespace-nowrap font-semibold text-gray-900 dark:text-white ${itemFocus}`}><Dices aria-hidden="true" className="h-7 w-7 shrink-0 text-fuchsia-500" />{showLabels && <span>حال خوب</span>}</Link>
            <button type="button" aria-label={isExpanded ? "جمع کردن منوی سرگرمی" : "باز کردن منوی سرگرمی"} aria-expanded={isExpanded} aria-controls={navId} title={isExpanded ? "جمع کردن منوی سرگرمی" : "باز کردن منوی سرگرمی"} onClick={() => setIsExpanded((expanded) => !expanded)} className={`hidden h-7 w-4 shrink-0 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-[#1F1F23] lg:flex ${itemFocus}`}>
              {isExpanded ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <ChevronLeft aria-hidden="true" className="h-4 w-4" />}
            </button>
            <button ref={mobileCloseRef} type="button" aria-label="بستن منوی سرگرمی" onClick={closeMobileMenu} className={`rounded-md p-1.5 lg:hidden ${itemFocus}`}><X aria-hidden="true" className="h-5 w-5" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
            {showLabels && <p className="mb-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">فضاها</p>}
            <div className="space-y-1">
              {funNavigation.map((item) => {
                const Icon = item.icon;
                if (item.type === "category") {
                  const trail = makeTrail(item.label);
                  return <div key={item.id}>
                    <button type="button" aria-label={item.label} aria-expanded={isMashhadOpen} aria-controls={submenuId} title={item.label} onClick={toggleMashhad} onFocus={() => preview(item.label, trail)} onBlur={clearPreview} className={`relative flex min-h-9 w-full items-center rounded-lg p-2 text-sm transition-colors ${itemFocus} ${neutralItem} ${showLabels ? "justify-start" : "justify-center"} ${isMashhadOpen ? "font-medium" : ""}`}>
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      {showLabels && <span className="mr-3 flex-1 text-right">{item.label}</span>}
                      <ChevronDown aria-hidden="true" className={`${showLabels ? "h-4 w-4" : "absolute bottom-0 left-0 h-2.5 w-2.5"} shrink-0 transition-transform motion-reduce:transition-none ${isMashhadOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isMashhadOpen && <motion.div id={submenuId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden">
                        <div className="mb-1 mr-3 mt-0.5 space-y-0.5 pr-3">
                          {item.children.map((child, index) => {
                            const ChildIcon = child.icon;
                            const childTrail = makeTrail(item.label, child.label);
                            const selected = isFunRoute && selectedRightItem?.label === child.label;
                            return <div key={child.id} className="relative">
                              <span aria-hidden="true" className={`absolute right-0 top-0 w-px bg-gray-300 dark:bg-gray-700 ${index === item.children.length - 1 ? "bottom-1/2" : "bottom-0"}`} />
                              <span aria-hidden="true" className="absolute right-0 top-1/2 h-px w-3 bg-gray-300 dark:bg-gray-700" />
                              <button type="button" aria-label={child.label} aria-pressed={selected} title={child.label} onClick={() => selectMashhad(child.label, childTrail)} onFocus={() => preview(child.label, childTrail)} onBlur={clearPreview} className={`flex min-h-9 w-full items-center justify-start gap-3 rounded-lg px-2 py-2 text-right text-sm transition-colors ${itemFocus} ${neutralItem} ${selected ? "bg-gray-100 font-medium dark:bg-[#1F1F23]" : ""}`}><ChildIcon aria-hidden="true" className="h-5 w-5 shrink-0" />{showLabels && <span>{child.label}</span>}</button>
                            </div>;
                          })}
                        </div>
                      </motion.div>}
                    </AnimatePresence>
                  </div>;
                }

                const trail = makeTrail(item.label);
                const selected = activeHref === item.href;
                return <Link key={item.id} href={item.href} aria-label={item.label} aria-current={selected ? "page" : undefined} title={item.label} onClick={() => { setSelectedRightItem(null); setIsMobileMenuOpen(false); clearPreview(); }} onFocus={() => preview(item.label, trail, item.href)} onBlur={clearPreview} className={`relative flex min-h-9 items-center justify-start gap-3 rounded-lg p-2 text-sm transition-colors ${itemFocus} ${selected ? "bg-fuchsia-500/10 font-medium text-fuchsia-600 dark:text-fuchsia-400" : neutralItem}`}>
                  {selected && <span aria-hidden="true" className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-fuchsia-500" />}<Icon aria-hidden="true" className="h-5 w-5 shrink-0" />{showLabels && <span>{item.label}</span>}
                </Link>;
              })}
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white px-2 py-2 dark:border-[#1F1F23] dark:bg-[#0F0F12]">
            <Link href="/trading" aria-label="داشبورد معاملات" aria-current={activeHref === "/trading" ? "page" : undefined} title="داشبورد معاملات" onClick={() => { setSelectedRightItem(null); setIsMobileMenuOpen(false); clearPreview(); }} onFocus={() => preview("داشبورد معاملات", [{ label: "داشبورد معاملات", href: "/trading" }], "/trading")} onBlur={clearPreview} className={`relative flex min-h-10 w-full items-center gap-3 rounded-lg p-2 text-sm transition-colors ${itemFocus} ${activeHref === "/trading" ? "bg-green-500/10 font-medium text-green-600 dark:text-green-400" : neutralItem} ${showLabels ? "justify-start" : "justify-center"}`}>
              <CandlestickChart aria-hidden="true" className="h-5 w-5 shrink-0" />
              {showLabels && <span className="flex-1 text-right">داشبورد معاملات</span>}
            </Link>
          </div>
        </div>
      </nav>
      <div className={`hidden flex-shrink-0 lg:block ${isExpanded ? "w-64" : "w-16"}`} aria-hidden="true" />
      {isMobileMenuOpen && <button type="button" aria-label="بستن منوی سرگرمی" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={closeMobileMenu} />}
    </>
  );
}
