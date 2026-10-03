import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names safely, resolving conflicts correctly.
 * Use this instead of template literals for conditional class logic.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary text-white', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
