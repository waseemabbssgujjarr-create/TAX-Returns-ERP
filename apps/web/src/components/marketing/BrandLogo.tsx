import { cn } from '@taxdesk/ui'

type BrandLogoProps = {
  className?: string
  /** Show wordmark beside the mark */
  showWordmark?: boolean
  /** Compact mark-only (icon size) */
  size?: 'sm' | 'md' | 'lg'
  /** Accessible name override */
  title?: string
}

const SIZE = {
  sm: { mark: 28, text: 'text-sm' },
  md: { mark: 36, text: 'text-base' },
  lg: { mark: 44, text: 'text-lg' },
} as const

/**
 * AdEra Labs FinTax — vector brand mark + wordmark.
 * Geometric shield + ledger lines evoke finance/tax without literal emblems.
 */
export function BrandLogo({
  className,
  showWordmark = true,
  size = 'md',
  title = 'AdEra Labs FinTax',
}: BrandLogoProps) {
  const dim = SIZE[size].mark

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={showWordmark ? true : undefined}
        role={showWordmark ? undefined : 'img'}
        aria-label={showWordmark ? undefined : title}
      >
        <title>{title}</title>
        {/* Shield base */}
        <path
          d="M24 4L40 10.5V22C40 32.5 33.2 41.2 24 44C14.8 41.2 8 32.5 8 22V10.5L24 4Z"
          className="fill-primary"
        />
        {/* Inner ledger / fintech glyph */}
        <path
          d="M16 18.5H32M16 24H28M16 29.5H24"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="32" cy="29.5" r="2.2" fill="white" />
      </svg>
      {showWordmark ? (
        <span className={cn('flex flex-col leading-tight', SIZE[size].text)}>
          <span className="text-foreground font-bold tracking-tight">AdEra Labs</span>
          <span className="text-primary text-[0.7em] font-semibold uppercase tracking-[0.16em]">
            FinTax
          </span>
        </span>
      ) : null}
    </span>
  )
}
