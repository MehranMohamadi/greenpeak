"use client";

import { BookOpen, Dices, Flower2, GraduationCap, HelpCircle, Landmark, Menu, Mic2, Smile, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useSidebarHover } from "@/app/context/sidebar-hover-context";
import { getActiveNavHref } from "@/lib/navigation-state";
import { ThemeToggle } from "@/components/theme-toggle";
import ProfileDropdown from "./profile-01";

const funNavigation = [
  {
    id: "mashhad",
    label: "در شهر",
    icon: Landmark,
    children: [
      { id: "book-club", label: "کتاب‌خوانی", icon: BookOpen },
      { id: "poetry", label: "شعرخوانی", icon: Mic2 },
    ],
  },
  {
    id: "yard",
    label: "حیات",
    href: "/fun",
    icon: Flower2,
    children: [
      { id: "investment-course", label: "دوره سرمایه گذاری", href: "/fun/investment-course", icon: GraduationCap },
      { id: "wellbeing-gathering", label: "دورهمی حال خوب", icon: Smile },
      { id: "managers-gathering", label: "دورهمی مدیران", icon: UsersRound },
    ],
  },
];

const funHrefs = funNavigation.flatMap((item) => [item.href, ...item.children.map((child) => child.href)]).filter(Boolean);
let categoryExpansionState = { mashhad: true, yard: true };
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
  const activeHref = getActiveNavHref(pathname, funHrefs);
  const isFunRoute = activeHref !== null;
  const isHelpActive = pathname === "/help" || pathname.startsWith("/help/");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState(() => categoryExpansionState);
  const showLabels = isMobileMenuOpen;
  useEffect(() => { if (isMobileMenuOpen) mobileCloseRef.current?.focus(); }, [isMobileMenuOpen]);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const escape = (event) => { if (event.key === "Escape") { setIsMobileMenuOpen(false); mobileToggleRef.current?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    const activeCategory = funNavigation.find((item) => item.children.some((child) => child.href && getActiveNavHref(pathname, [child.href])));
    if (activeCategory) {
      setOpenCategories((current) => {
        if (current[activeCategory.id]) return current;
        categoryExpansionState = { ...current, [activeCategory.id]: true };
        return categoryExpansionState;
      });
    }
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
  const selectItem = (label, trail) => {
    setSelectedRightItem({ label, side: "right", trail });
  };
  const toggleCategory = (item) => {
    selectItem(item.label, makeTrail(item.label));
    setOpenCategories((current) => {
      categoryExpansionState = { ...current, [item.id]: !current[item.id] };
      return categoryExpansionState;
    });
  };

  return (
    <>
      <button ref={mobileToggleRef} type="button" aria-label="باز کردن منوی سرگرمی" aria-expanded={isMobileMenuOpen} aria-controls={navId} className={`fixed right-4 top-2 z-40 rounded-lg bg-white p-1 shadow-md dark:bg-[#0F0F12] lg:hidden ${itemFocus}`} onClick={() => setIsMobileMenuOpen((open) => !open)}>
        <Menu className="h-5 w-5 text-primary" />
      </button>
      <nav id={navId} dir="rtl" aria-label="ناوبری سرگرمی" onKeyDown={(event) => { if (event.key === "Escape" && isMobileMenuOpen) closeMobileMenu(); }} className={`fixed inset-y-0 right-0 z-40 max-w-[calc(100vw-3rem)] flex-shrink-0 transform border-l border-gray-200 bg-white shadow-xl shadow-black/5 transition-[width,transform,visibility] duration-200 ease-out motion-reduce:transition-none dark:border-[#1F1F23] dark:bg-[#0F0F12] dark:shadow-black/20 lg:visible lg:translate-x-0 ${isMobileMenuOpen ? "visible translate-x-0" : "invisible translate-x-full"} ${showLabels ? "w-64" : "w-16"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className={`flex h-11 shrink-0 items-center border-b border-gray-200 px-3 dark:border-[#1F1F23] ${showLabels ? "justify-between gap-1" : "justify-center"}`}>
            <Link aria-label="حال خوب" title="حال خوب" href="/fun" onClick={() => { setSelectedRightItem(null); setIsMobileMenuOpen(false); }} className={`flex min-w-0 items-center gap-3 rounded-md whitespace-nowrap font-semibold text-gray-900 dark:text-white ${itemFocus}`}><Dices aria-hidden="true" className="h-8 w-8 shrink-0 text-primary" />{showLabels && <span>حال خوب</span>}</Link>
            <button ref={mobileCloseRef} type="button" aria-label="بستن منوی سرگرمی" onClick={closeMobileMenu} className={`rounded-md p-1.5 lg:hidden ${itemFocus}`}><X aria-hidden="true" className="h-5 w-5" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
            {showLabels && <p className="mb-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">فضاها</p>}
            <div>
              {funNavigation.map((item) => {
                const Icon = item.icon;
                const CategoryControl = item.href ? Link : "button";
                const trail = makeTrail(item.label);
                const isOpen = Boolean(openCategories[item.id]);
                const categorySubmenuId = `${submenuId}-${item.id}`;
                const selected = isFunRoute && (selectedRightItem?.trail?.some((part) => part.label === item.label) || item.children.some((child) => child.href === activeHref) || (!selectedRightItem && activeHref === item.href));
                return <section key={item.id} className="mt-3">
                  <CategoryControl href={item.href} type={item.href ? undefined : "button"} aria-label={item.label} aria-expanded={isOpen} aria-controls={categorySubmenuId} title={item.label} onClick={() => toggleCategory(item)} onFocus={() => preview(item.label, trail, item.href)} onBlur={clearPreview} className={`relative flex h-9 w-full min-w-0 items-center justify-start gap-3 rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none ${itemFocus} ${selected ? "bg-primary/10 font-medium text-primary" : neutralItem}`}>
                    {selected && <span aria-hidden="true" className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-primary" />}
                    <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center"><Icon className="h-5 w-5" /></span>
                    {showLabels && <span className="truncate text-right">{item.label}</span>}
                  </CategoryControl>
                  <AnimatePresence initial={false}>
                    {isOpen && <motion.div id={categorySubmenuId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden">
                      <div className="pr-4">
                        {item.children.map((child, index) => {
                          const ChildIcon = child.icon;
                          const ChildControl = child.href ? Link : "button";
                          const childTrail = makeTrail(item.label, child.label);
                          const childSelected = child.href ? activeHref === child.href : isFunRoute && selectedRightItem?.label === child.label;
                          return <div key={child.id} className="relative">
                            <span aria-hidden="true" className={`absolute -right-2 top-0 w-px bg-gray-300 dark:bg-gray-700 ${index === item.children.length - 1 ? "bottom-1/2" : "bottom-0"}`} />
                            <span aria-hidden="true" className="absolute -right-2 top-1/2 h-px w-2 bg-gray-300 dark:bg-gray-700" />
                            <ChildControl href={child.href} type={child.href ? undefined : "button"} aria-label={child.label} aria-current={child.href && childSelected ? "page" : undefined} aria-pressed={child.href ? undefined : childSelected} title={child.label} onClick={() => { if (child.href) { setSelectedRightItem(null); setIsMobileMenuOpen(false); clearPreview(); } else selectItem(child.label, childTrail); }} onFocus={() => preview(child.label, childTrail, child.href)} onBlur={clearPreview} className={`flex h-9 w-full min-w-0 items-center justify-start gap-3 rounded-lg px-2 text-right text-sm transition-colors motion-reduce:transition-none ${itemFocus} ${childSelected ? "bg-primary/10 font-medium text-primary" : neutralItem}`}><span aria-hidden="true" className="flex h-5 w-5 shrink-0 translate-x-1.5 items-center justify-center"><ChildIcon className="h-5 w-5" /></span>{showLabels && <span className="truncate">{child.label}</span>}</ChildControl>
                          </div>;
                        })}
                      </div>
                    </motion.div>}
                  </AnimatePresence>
                </section>;
              })}
            </div>
          </div>
          <div className="shrink-0 border-t border-gray-200 bg-white px-2 py-2 dark:border-[#1F1F23] dark:bg-[#0F0F12]">
            <Link href="/help" aria-label="راهنما" aria-current={isHelpActive ? "page" : undefined} title="راهنما" onClick={() => setIsMobileMenuOpen(false)} className={`relative flex h-9 min-w-0 items-center justify-start gap-3 rounded-lg px-3 text-sm transition-colors ${itemFocus} ${isHelpActive ? "bg-primary/10 font-medium text-primary" : neutralItem}`}>
              {isHelpActive && <span aria-hidden="true" className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-primary" />}
              <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center"><HelpCircle className="h-5 w-5" /></span>
              {showLabels && <span className="truncate">راهنما</span>}
            </Link>
            <ThemeToggle showLabel={showLabels} label="تم" className={showLabels ? "h-9 justify-start px-3" : "h-9 w-full rounded-lg"} />
            <ProfileDropdown showLabel={showLabels} triggerLabel="حساب کاربری" triggerClassName="h-11 w-full justify-start rounded-lg px-2.5 py-2" />
          </div>
        </div>
      </nav>
      <div className="hidden w-16 flex-shrink-0 lg:block" aria-hidden="true" />
      {isMobileMenuOpen && <button type="button" aria-label="بستن منوی سرگرمی" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={closeMobileMenu} />}
    </>
  );
}
