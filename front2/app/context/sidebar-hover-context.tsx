"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type HoveredItem = {
  label: string;
} | null;

type SidebarHoverContextType = {
  hoveredItem: HoveredItem;
  setHoveredItem: (item: HoveredItem) => void;
};

const SidebarHoverContext = createContext<SidebarHoverContextType | undefined>(
  undefined
);

export function SidebarHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredItem, setHoveredItem] = useState<HoveredItem>(null);

  return (
    <SidebarHoverContext.Provider value={{ hoveredItem, setHoveredItem }}>
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