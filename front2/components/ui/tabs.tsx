"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md border border-slate-300/80 bg-slate-100/90 p-1 text-slate-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-400",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium text-slate-500 ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=inactive]:hover:bg-white/80 data-[state=inactive]:hover:text-slate-900 data-[state=active]:border-cyan-500/50 data-[state=active]:bg-cyan-50 data-[state=active]:font-semibold data-[state=active]:text-cyan-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-cyan-500/15 dark:text-slate-400 dark:data-[state=inactive]:hover:bg-white/[0.06] dark:data-[state=inactive]:hover:text-slate-100 dark:data-[state=active]:border-cyan-400/50 dark:data-[state=active]:bg-cyan-400/15 dark:data-[state=active]:text-cyan-100 dark:data-[state=active]:ring-cyan-400/15",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
