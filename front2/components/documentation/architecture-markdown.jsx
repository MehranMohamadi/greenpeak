"use client"

import { isValidElement, useEffect, useId, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function MermaidDiagram({ chart }) {
  const containerRef = useRef(null)
  const reactId = useId()
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        const { default: mermaid } = await import("mermaid")
        const isDark = document.documentElement.classList.contains("dark")

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDark ? "dark" : "neutral",
          flowchart: { htmlLabels: true, useMaxWidth: true },
          sequence: { useMaxWidth: true, wrap: true },
        })

        const diagramId = `architecture-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`
        const { svg, bindFunctions } = await mermaid.render(diagramId, chart)

        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = svg
        bindFunctions?.(containerRef.current)
        setError("")
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "فلوچارت قابل نمایش نیست.",
          )
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [chart, reactId])

  if (error) {
    return (
      <div
        className="my-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
        dir="rtl"
      >
        <p className="font-semibold">خطا در نمایش فلوچارت</p>
        <p className="mt-1 break-words">{error}</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-white p-4 text-left text-xs text-gray-700 dark:bg-black/30 dark:text-gray-300">
          <code>{chart}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-8 flex min-h-40 items-center justify-center overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-[#2A2A2E] dark:bg-[#17171A] [&_svg]:h-auto [&_svg]:max-w-full"
      aria-label="نمودار معماری"
    >
      <span className="text-sm text-gray-500 dark:text-gray-400">
        در حال رسم فلوچارت...
      </span>
    </div>
  )
}

const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-950 dark:text-white md:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-4 mt-12 scroll-mt-16 border-b border-gray-200 pb-3 text-2xl font-bold text-gray-950 first:mt-0 dark:border-[#2A2A2E] dark:text-white">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-3 mt-8 scroll-mt-16 text-xl font-semibold text-gray-900 dark:text-gray-100">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-4 leading-8 text-gray-700 dark:text-gray-300">{children}</p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800 dark:text-emerald-400 dark:decoration-emerald-700"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pr-6 text-gray-700 marker:text-emerald-600 dark:text-gray-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pr-6 text-gray-700 marker:font-semibold marker:text-emerald-700 dark:text-gray-300 dark:marker:text-emerald-400">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pr-1 leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-r-4 border-emerald-500 bg-emerald-50/70 px-5 py-2 text-gray-800 dark:bg-emerald-950/20 dark:text-gray-200">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-[#2A2A2E]">
      <table className="w-full min-w-[680px] border-collapse text-right text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 text-gray-900 dark:bg-[#242428] dark:text-gray-100">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-200 dark:divide-[#2A2A2E]">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="align-top even:bg-gray-50/70 dark:even:bg-white/[0.02]">
      {children}
    </tr>
  ),
  th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
  td: ({ children }) => (
    <td className="px-4 py-3 leading-6 text-gray-700 dark:text-gray-300">
      {children}
    </td>
  ),
  hr: () => <hr className="my-10 border-gray-200 dark:border-[#2A2A2E]" />,
  pre: ({ children }) => {
    if (
      isValidElement(children) &&
      children.props.className === "language-mermaid"
    ) {
      return <MermaidDiagram chart={String(children.props.children).trim()} />
    }

    return (
      <pre
        className="my-6 overflow-x-auto rounded-xl border border-gray-800 bg-[#111827] p-5 text-left text-sm leading-6 text-gray-100 shadow-sm"
        dir="ltr"
      >
        {children}
      </pre>
    )
  },
  code: ({ className, children }) => {
    const isBlock = className?.startsWith("language-")

    if (isBlock) {
      return <code className={className}>{children}</code>
    }

    return (
      <code
        className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-800 dark:bg-white/10 dark:text-emerald-300"
        dir="ltr"
      >
        {children}
      </code>
    )
  },
}

export default function ArchitectureMarkdown({ markdown }) {
  return (
    <article
      className="mx-auto w-full max-w-6xl py-8 text-right"
      dir="rtl"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
