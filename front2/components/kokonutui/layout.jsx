"use client"

import Sidebar from "./sidebar"
import FunSidebar from "./fun-sidebar"
import TopNav from "./top-nav"

export default function Layout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col transition-all duration-200 ease-out">
        <header className="h-11 border-b border-gray-200 dark:border-[#1F1F23] transition-all duration-200 ease-out">
          <TopNav />
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-2 px-6 pb-6 bg-white dark:bg-[#0F0F12] transition-all duration-200 ease-out">
          {children}
        </main>
      </div>
      <FunSidebar />
    </div>
  )
}
