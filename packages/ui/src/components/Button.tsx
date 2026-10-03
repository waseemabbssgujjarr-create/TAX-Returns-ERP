import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { cn } from '../utils'

// ── Variants ──────────────────────────────────────────────────────────────────

const buttonVariants = cva(
  // Base styles — applied to every button variant
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-md text-sm font-medium no-underline hover:no-underline',
    // Touch target: minimum 44×44 px per WCAG
    'min-h-[44px] min-w-[44px]',
    // Transitions
    'transition-colors duration-fast',
    // Focus ring (visible only via keyboard)
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    // Press state
    'active:scale-[0.98]',
    // Disabled
    'disabled:pointer-events-none disabled:opacity-40',
    // RTL-safe
    '[&>svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: ['bg-primary text-white', 'hover:bg-primary-hover', 'active:bg-primary-active'],
        secondary: ['bg-surface border border-border text-foreground', 'hover:bg-surface-hover'],
        outline: [
          'border border-border-strong bg-transparent text-foreground',
          'hover:bg-surface-hover',
        ],
        ghost: ['text-foreground', 'hover:bg-surface-hover'],
        destructive: ['bg-error text-white', 'hover:opacity-90'],
        link: ['text-primary underline-offset-4 hover:underline', 'min-h-auto min-w-auto p-0'],
      },
      size: {
        sm: 'h-9 px-3 text-xs min-h-[36px]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** When true, renders the child as the root element (useful for links) */
  asChild?: boolean
  /** Shows a spinner and disables the button */
  isLoading?: boolean
  /** Accessible label for the loading state */
  loadingLabel?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingLabel = 'Loading…',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? isLoading}
        aria-disabled={disabled ?? isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">{loadingLabel}</span>
            {/* Keep original children for width stability but hide them */}
            <span aria-hidden="true" className="select-none opacity-0">
              {children}
            </span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)

Button.displayName = 'Button'

export { Button, buttonVariants }
