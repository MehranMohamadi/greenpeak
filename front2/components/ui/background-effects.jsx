"use client"

import { motion } from "framer-motion"

const FLOATING_ELEMENTS = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  initialX: (index * 41 + 13) % 100,
  initialY: (index * 29 + 17) % 100,
  delay: (index % 4) * 0.5,
  duration: 10 + (index % 6) * 1.5,
  size: 20 + (index % 5) * 8,
}))

export default function BackgroundEffects() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-cyan-50/30 via-transparent to-cyan-50/30 dark:from-cyan-900/10 dark:via-transparent dark:to-cyan-900/10"
        animate={{
          background: [
            "linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(34, 211, 238, 0.05) 100%)",
            "linear-gradient(135deg, rgba(34, 211, 238, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)",
            "linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(34, 211, 238, 0.05) 100%)"
          ]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating geometric shapes */}
      {FLOATING_ELEMENTS.map((element) => (
        <motion.div
          key={element.id}
          className="absolute rounded-full bg-gradient-to-br from-cyan-400/10 to-cyan-400/10 dark:from-cyan-400/5 dark:to-cyan-400/5 backdrop-blur-sm"
          style={{
            width: element.size,
            height: element.size,
            left: `${element.initialX}%`,
            top: `${element.initialY}%`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, 50, 0],
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: element.duration,
            delay: element.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Subtle light rays */}
      <motion.div
        className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent"
        animate={{
          opacity: [0.2, 0.8, 0.2],
          scaleY: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent"
        animate={{
          opacity: [0.8, 0.2, 0.8],
          scaleY: [1, 0.5, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
    </div>
  )
}
