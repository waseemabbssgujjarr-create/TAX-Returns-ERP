'use client'

import { cn } from '@taxdesk/ui'
import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={cn(className)}
      initial={reduce ? false : { opacity: 1, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, delay, ease: [0, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
