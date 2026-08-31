"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
  const [hoveredItem, setHoveredItem] = useState<NavigationItem>(null);
  const [selectedRightItem, setSelectedRightItem] = useState<NavigationItem>({
    label: "حیاط",
    href: "/fun",
    side: "right",
    trail: [{ label: "فان", href: "/fun" }, { label: "حیاط" }],
  });

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
