"use client"

import { createContext, useContext, useRef, useState } from "react"

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  return <ChatContext.Provider value={{ open, setOpen, triggerRef }}>{children}</ChatContext.Provider>
}

export function useChat() {
  return useContext(ChatContext)
}
