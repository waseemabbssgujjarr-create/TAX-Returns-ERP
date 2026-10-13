'use client'

import { cn } from '@taxdesk/ui'
import { motion, useReducedMotion } from 'framer-motion'

interface AuthCardProps {
  children: React.ReactNode
  className?: string
}

export function AuthCard({ children, className }: AuthCardProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className={cn('mk-auth-card px-6 py-8 sm:px-8 sm:py-9', className)}
    >
      {children}
    </motion.div>
  )
}
