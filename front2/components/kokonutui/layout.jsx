"use client"

import Sidebar from "./sidebar"
import FunSidebar from "./fun-sidebar"
import TopNav from "./top-nav"

export default function Layout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col transition-all duration-200 ease-out">
        <header className="h-11 border-b border-border bg-card transition-all duration-200 ease-out">
          <TopNav />
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background px-3 pb-5 pt-2 transition-all duration-200 ease-out md:px-5">
          {children}
        </main>
      </div>
      <FunSidebar />
    </div>
  )
}
