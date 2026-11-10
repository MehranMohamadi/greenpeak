"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

// An additional 12% reduction on the previously compacted indicator panels.
export const INDICATOR_PANEL_REDUCTION = 1 - 0.9 * 0.88

// Reduce the whole panel, keeping its header and font sizes intact.
// The flexible chart/text area absorbs the reduction, including header padding.
export default function useReducedAnalysisHeight(baseHeight, { contentSized = false, frameSelector, reduction = 0.1 } = {}) {
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const [bodyHeight, setBodyHeight] = useState(baseHeight)
  const measure = useCallback(() => {
    const panel = panelRef.current
    const body = bodyRef.current
    if (!panel || !body) return
    const frame = (frameSelector && panel.closest(frameSelector)) || panel
    const fullBodyHeight = contentSized ? Math.min(baseHeight, body.scrollHeight) : baseHeight
    const fixedHeight = frame.getBoundingClientRect().height - body.getBoundingClientRect().height
    // Preserve at least one readable text line when a panel has little content.
    const next = Math.max(32, Math.round((fullBodyHeight * (1 - reduction) - fixedHeight * reduction) * 10) / 10)
    setBodyHeight(current => Math.abs(current - next) < 0.2 ? current : next)
  }, [baseHeight, contentSized, frameSelector, reduction])

  // Also remeasure when fetched text or the selected indicator changes.
  useLayoutEffect(() => { measure() })
  useEffect(() => {
    if (!panelRef.current) return
    const observer = new ResizeObserver(measure)
    observer.observe(panelRef.current)
    if (bodyRef.current) observer.observe(bodyRef.current)
    const frame = frameSelector && panelRef.current.closest(frameSelector)
    if (frame) observer.observe(frame)
    return () => observer.disconnect()
  }, [measure])

  return { panelRef, bodyRef, bodyHeight }
}
