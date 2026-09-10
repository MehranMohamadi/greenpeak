"use client";

import { CalendarDays, HelpCircle, Home, Menu, Pin, PinOff, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { marketAnalysisCategories } from "@/lib/analytics-registry";
import { getActiveNavHref, US_MARKET } from "@/lib/navigation-state";
import { useSidebarHover } from "@/app/context/sidebar-hover-context";
import ProfileDropdown from "./profile-01";
import { ThemeToggle } from "../theme-toggle";

const markets = [{ ...US_MARKET, children: marketAnalysisCategories.map((category) => ({ ...category, href: `/analytics/${category.page}` })) }];
let marketExpansionState = { [US_MARKET.id]: true };
const hrefs = ["/", "/help", "/analytics/events", ...markets.flatMap((market) => [market.href, ...market.children.map((child) => child.href)])];
const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400";
const USIcon = () => <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current text-[10px] font-bold">US</span>;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setHoveredItem } = useSidebarHover();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [openMarkets, setOpenMarkets] = useState(() => marketExpansionState);
  const timer = useRef(null);
  const trigger = useRef(null);
  const mobileClose = useRef(null);
  const expanded = pinned || hovered || focused || mobile;
  const activeHref = getActiveNavHref(pathname, hrefs);
  useEffect(() => { if (mobile) mobileClose.current?.focus(); }, [mobile]);
  useEffect(() => {
    if (!mobile) return;
    const escape = (event) => { if (event.key === "Escape") { setMobile(false); trigger.current?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [mobile]);

  useEffect(() => {
    try { setPinned(localStorage.getItem("greenpeak.nav.pinned") === "true"); } catch {}
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    setMobile(false);
    setHoveredItem(null);
  }, [pathname, setHoveredItem]);
  function closeMobile() { setMobile(false); trigger.current?.focus(); }
  function toggleMarket(id) {
    // Preserve the toggle when navigating remounts the page's sidebar.
    marketExpansionState = { ...openMarkets, [id]: !openMarkets[id] };
    setOpenMarkets(marketExpansionState);
    router.push(markets.find((market) => market.id === id).href);
  }
  function navItem(href, label, Icon, display = label, nested = false) {
    const active = activeHref === href;
    return <Link href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined} onClick={() => setMobile(false)} onMouseEnter={() => setHoveredItem({ label, href, side: "left" })} onMouseLeave={() => setHoveredItem(null)} className={`relative flex h-9 min-w-0 items-center justify-start gap-3 rounded-lg text-sm transition-colors motion-reduce:transition-none ${nested ? "px-2" : "px-3"} ${focusStyle} ${active ? "bg-green-500/10 font-medium text-green-600 dark:text-green-400" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1F1F23] dark:hover:text-white"}`}>
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-green-500 dark:bg-green-400" />}
      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center ${nested ? "-translate-x-1.5" : ""}`}><Icon className="h-5 w-5" /></span>{expanded && <span dir="auto" className="truncate">{display}</span>}
    </Link>;
  }

  return <>
    <button ref={trigger} type="button" aria-label="Open financial navigation" aria-expanded={mobile} aria-controls="financial-navigation" onClick={() => setMobile((value) => !value)} className={`fixed left-4 top-2 z-40 rounded bg-white p-1 dark:bg-[#0F0F12] lg:hidden ${focusStyle}`}><Menu className="h-5 w-5" /></button>
    <nav id="financial-navigation" aria-label="Financial navigation" dir="ltr"
      onPointerEnter={(event) => { if (event.pointerType !== "touch") { clearTimeout(timer.current); timer.current = setTimeout(() => setHovered(true), 200); } }}
      onPointerLeave={() => { clearTimeout(timer.current); setHovered(false); }}
      onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => { if (event.key === "Escape" && mobile) closeMobile(); }}
      className={`fixed inset-y-0 left-0 z-40 max-w-[calc(100vw-3rem)] border-r border-gray-200 bg-white shadow-xl shadow-black/5 dark:shadow-black/20 transition-[width,transform,visibility] duration-200 motion-reduce:transition-none dark:border-[#1F1F23] dark:bg-[#0F0F12] lg:visible lg:translate-x-0 ${mobile ? "visible translate-x-0" : "invisible -translate-x-full"} ${expanded ? "w-64" : "w-16"}`}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 dark:border-[#1F1F23] px-3">
          <Link href="/" aria-label="GreenPeak" title="GreenPeak" className={`flex min-w-0 items-center gap-3 rounded font-semibold text-gray-900 dark:text-white ${focusStyle}`}>
            <svg aria-hidden="true" viewBox="0 0 818 512" fill="none" className="h-8 w-8 shrink-0 text-green-600">
              <path d="M263.5 219L220 187L0 480.5L228.5 252.5L484 412.5L302.5 244L438.5 78L817.5 495L437.5 0L263.5 219Z" fill="currentColor" />
            </svg>
            {expanded && <span className="truncate">GreenPeak</span>}
          </Link>
          <button type="button" title={pinned ? "Unpin navigation" : "Pin navigation"} aria-label={pinned ? "Unpin navigation" : "Pin navigation"} aria-pressed={pinned} onClick={() => setPinned((value) => { try { localStorage.setItem("greenpeak.nav.pinned", String(!value)); } catch {} return !value; })} className={`hidden rounded p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1F1F23] ${expanded ? "lg:block" : ""} ${focusStyle}`}>{pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</button>
          <button ref={mobileClose} type="button" aria-label="Close financial navigation" onClick={closeMobile} className={`rounded p-2 lg:hidden ${focusStyle}`}><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          {navItem("/", "Dashboard", Home)}
          {markets.map((market) => <section key={market.id} className="mt-3">
            <div className={activeHref && market.children.some((child) => child.href === activeHref) ? "font-medium" : ""}>
              <button type="button" title={market.labelFa} aria-label={market.labelFa} aria-expanded={Boolean(openMarkets[market.id])} onClick={() => toggleMarket(market.id)} onMouseEnter={() => setHoveredItem({ label: market.labelFa, href: market.href, side: "left" })} onMouseLeave={() => setHoveredItem(null)} className={`relative flex h-9 w-full min-w-0 items-center justify-start gap-3 rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none ${focusStyle} ${activeHref === market.href ? "bg-green-500/10 font-medium text-green-600 dark:text-green-400" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#1F1F23] dark:hover:text-white"}`}>
                {activeHref === market.href && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-green-500 dark:bg-green-400" />}
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center"><USIcon /></span>
                {expanded && <span dir="auto" className="truncate">{market.labelFa}</span>}
              </button>
            </div>
            {openMarkets[market.id] && <div className="pl-4">
              {market.children.map((child, index) => <div key={child.page} className="relative">
                <span aria-hidden="true" className={`absolute -left-2 top-0 w-px bg-gray-300 dark:bg-gray-700 ${index === market.children.length - 1 ? "bottom-1/2" : "bottom-0"}`} />
                <span aria-hidden="true" className="absolute -left-2 top-1/2 h-px w-2 bg-gray-300 dark:bg-gray-700" />
                {navItem(child.href, child.name, child.icon, child.shortName, true)}
              </div>)}
            </div>}
          </section>)}
          <div className="mt-3">{navItem("/analytics/events", "News & Events", CalendarDays)}</div>
        </div>
        <div className="shrink-0 border-t border-gray-200 bg-white px-2 py-2 dark:border-[#1F1F23] dark:bg-[#0F0F12]">
          <ProfileDropdown showLabel={expanded} triggerClassName="h-11 w-full justify-start rounded-lg px-2.5 py-2" />
          <ThemeToggle showLabel={expanded} className={expanded ? "" : "mx-auto"} />
          {navItem("/help", "Help", HelpCircle)}
        </div>
      </div>
    </nav>
    <div aria-hidden="true" className={`hidden shrink-0 lg:block ${pinned ? "w-64" : "w-16"}`} />
    {mobile && <button type="button" aria-label="Close financial navigation" onClick={closeMobile} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
  </>;
}
