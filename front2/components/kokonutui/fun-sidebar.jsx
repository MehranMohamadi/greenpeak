"use client";

import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Dices, Drama, Flower2, Landmark, Menu, Mic2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useSidebarHover } from "../../app/context/sidebar-hover-context";

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

const makeTrail = (...labels) => [
  { label: "فان", href: "/fun" },
  ...labels.map((label) => ({ label })),
];

export default function FunSidebar() {
  const pathname = usePathname();
  const submenuId = useId();
  const { hoveredItem, setHoveredItem, selectedRightItem, setSelectedRightItem } = useSidebarHover();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(pathname === "/fun");
  const [isMashhadOpen, setIsMashhadOpen] = useState(false);

  useEffect(() => {
    setIsExpanded(pathname === "/fun");
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const preview = (label, trail, href) => setHoveredItem({ label, href, side: "right", trail });
  const clearPreview = () => {
    if (hoveredItem?.side === "right") setHoveredItem(null);
  };

  const toggleMashhad = () => {
    setSelectedRightItem({ label: "مشهد", side: "right", trail: makeTrail("مشهد") });
    if (!isExpanded) {
      setIsExpanded(true);
      setIsMashhadOpen(true);
      return;
    }
    setIsMashhadOpen((open) => !open);
  };

  return (
    <>
      <button type="button" aria-label="باز کردن منوی سرگرمی" className="fixed right-4 top-2 z-40 rounded-lg bg-white p-1 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 dark:bg-[#0F0F12] lg:hidden" onClick={() => setIsMobileMenuOpen((open) => !open)}>
        <Menu className="h-5 w-5 text-fuchsia-600" />
      </button>
      <nav dir="rtl" aria-label="ناوبری سرگرمی" className={`fixed inset-y-0 right-0 z-40 flex-shrink-0 transform border-l border-gray-200 bg-white shadow-xl shadow-black/5 transition-all duration-200 ease-out dark:border-[#1F1F23] dark:bg-[#0F0F12] dark:shadow-black/20 lg:fixed lg:z-40 lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"} ${isExpanded ? "w-64" : "w-16"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex h-11 items-center justify-between border-b border-gray-200 px-6 dark:border-[#1F1F23] ${isExpanded ? "" : "px-4"}`}>
            <AnimatePresence>
              {isExpanded && <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden"><Link href="/fun" className="flex items-center gap-3 whitespace-nowrap font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 dark:text-white"><Dices className="h-7 w-7 text-fuchsia-500" /><span>حال خوب</span></Link></motion.div>}
            </AnimatePresence>
            {!isExpanded && <Link href="/fun" aria-label="حال خوب" className="flex w-full justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"><Dices className="h-7 w-7 text-fuchsia-500" /></Link>}
            <motion.button type="button" aria-label={isExpanded ? "جمع کردن منوی سرگرمی" : "باز کردن منوی سرگرمی"} onClick={() => setIsExpanded((expanded) => !expanded)} className="hidden rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 hover:bg-gray-100 dark:hover:bg-[#1F1F23] lg:flex" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              {isExpanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4">
            {isExpanded && <p className="mb-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">فضاها</p>}
            <div className="space-y-1">
              {funNavigation.map((item) => {
                const Icon = item.icon;
                if (item.type === "category") {
                  const trail = makeTrail(item.label);
                  const categorySelected = selectedRightItem?.trail?.some((crumb) => crumb.label === item.label);
                  return <div key={item.id}>
                    <button type="button" aria-expanded={isMashhadOpen} aria-controls={submenuId} title={isExpanded ? "" : item.label} onClick={toggleMashhad} onFocus={() => preview(item.label, trail)} onBlur={clearPreview} onMouseEnter={() => preview(item.label, trail)} onMouseLeave={clearPreview} className={`relative flex w-full items-center rounded-lg p-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 ${isExpanded ? "justify-start" : "justify-center"} ${categorySelected ? "bg-fuchsia-500/10 font-medium text-fuchsia-600 dark:text-fuchsia-400" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1F1F23] dark:hover:text-white"}`}>
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {isExpanded && <><span className="mr-3 flex-1 text-right">{item.label}</span><ChevronDown className={`h-4 w-4 transition-transform ${isMashhadOpen ? "rotate-180" : ""}`} /></>}
                    </button>
                    <AnimatePresence initial={false}>
                      {isMashhadOpen && <motion.div id={submenuId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                        <div className={`mt-1 space-y-1 border-r border-fuchsia-200 dark:border-fuchsia-900 ${isExpanded ? "mr-4 pr-3" : "mr-2 pr-1"}`}>
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childTrail = makeTrail(item.label, child.label);
                            const selected = selectedRightItem?.label === child.label;
                            return <button key={child.id} type="button" aria-pressed={selected} title={isExpanded ? "" : child.label} onClick={() => setSelectedRightItem({ label: child.label, side: "right", trail: childTrail })} onFocus={() => preview(child.label, childTrail)} onBlur={clearPreview} onMouseEnter={() => preview(child.label, childTrail)} onMouseLeave={clearPreview} className={`flex w-full items-center rounded-lg py-2 text-right text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 ${isExpanded ? "gap-2 px-3" : "justify-center px-2"} ${selected ? "bg-fuchsia-500/10 font-medium text-fuchsia-600 dark:text-fuchsia-400" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1F1F23] dark:hover:text-white"}`}><ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />{isExpanded && <span>{child.label}</span>}</button>;
                          })}
                        </div>
                      </motion.div>}
                    </AnimatePresence>
                  </div>;
                }

                const trail = makeTrail(item.label);
                const selected = selectedRightItem?.label === item.label;
                return <Link key={item.id} href={item.href} aria-current={selected ? "page" : undefined} title={isExpanded ? "" : item.label} onClick={() => { setSelectedRightItem({ label: item.label, href: item.href, side: "right", trail }); setIsMobileMenuOpen(false); }} onFocus={() => preview(item.label, trail, item.href)} onBlur={clearPreview} onMouseEnter={() => preview(item.label, trail, item.href)} onMouseLeave={clearPreview} className={`relative flex items-center rounded-lg p-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 ${isExpanded ? "justify-start" : "justify-center"} ${selected ? "bg-fuchsia-500/10 font-medium text-fuchsia-600 dark:text-fuchsia-400" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1F1F23] dark:hover:text-white"}`}>
                  {selected && <span className="absolute inset-y-1 right-0 w-[3px] rounded-full bg-fuchsia-500" />}<Icon className="h-4 w-4 flex-shrink-0" />{isExpanded && <span className="mr-3">{item.label}</span>}
                </Link>;
              })}
            </div>
          </div>
        </div>
      </nav>
      <div className="hidden w-16 flex-shrink-0 lg:block" aria-hidden="true" />
      {isMobileMenuOpen && <button type="button" aria-label="بستن منوی سرگرمی" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
    </>
  );
}
