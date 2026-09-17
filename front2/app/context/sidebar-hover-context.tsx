"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type NavigationItem = {
  label: string;
  href?: string;
  side: "left" | "right";
  trail?: BreadcrumbItem[];
} | null;

type SidebarHoverContextType = {
  hoveredItem: NavigationItem;
  setHoveredItem: (item: NavigationItem) => void;
  selectedRightItem: NavigationItem;
  setSelectedRightItem: (item: NavigationItem) => void;
};

const SidebarHoverContext = createContext<SidebarHoverContextType | undefined>(
  undefined
);

export function SidebarHoverProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<NavigationItem>(null);
  // This is an in-page content selection, not the current navigation route.
  const [selectedRightItem, setSelectedRightItem] = useState<NavigationItem>(null);

  useEffect(() => {
    setHoveredItem(null);
    setSelectedRightItem(null);
  }, [pathname]);

  return (
    <SidebarHoverContext.Provider value={{ hoveredItem, setHoveredItem, selectedRightItem, setSelectedRightItem }}>
      {children}
    </SidebarHoverContext.Provider>
  );
}

export function useSidebarHover() {
  const ctx = useContext(SidebarHoverContext);
  if (!ctx) {
    throw new Error("useSidebarHover must be used within SidebarHoverProvider");
  }
  return ctx;
}
