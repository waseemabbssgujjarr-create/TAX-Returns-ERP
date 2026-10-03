import type { Config } from 'tailwindcss'

/**
 * TaxDesk PK Tailwind Preset.
 * Consumed by apps/web/tailwind.config.ts.
 *
 * Maps CSS custom property tokens to Tailwind utility classes.
 * Never put raw color values here — always reference var(--token-name).
 */
export const taxdeskPreset: Partial<Config> = {
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-active': 'var(--color-primary-active)',
        'primary-subtle': 'var(--color-primary-subtle)',

        surface: 'var(--color-surface)',
        'surface-subtle': 'var(--color-surface-subtle)',
        'surface-hover': 'var(--color-surface-hover)',
        canvas: 'var(--color-canvas)',

        foreground: 'var(--color-foreground)',
        'muted-foreground': 'var(--color-muted-foreground)',

        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',

        success: 'var(--color-success)',
        'success-subtle': 'var(--color-success-subtle)',
        warning: 'var(--color-warning)',
        'warning-subtle': 'var(--color-warning-subtle)',
        error: 'var(--color-error)',
        'error-subtle': 'var(--color-error-subtle)',
        info: 'var(--color-info)',
        'info-subtle': 'var(--color-info-subtle)',
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },

      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        urdu: ['var(--font-urdu)', 'sans-serif'],
      },

      fontSize: {
        xs: ['var(--text-xs)', { lineHeight: '1rem' }],
        sm: ['var(--text-sm)', { lineHeight: '1.25rem' }],
        base: ['var(--text-base)', { lineHeight: '1.5rem' }],
        lg: ['var(--text-lg)', { lineHeight: '1.75rem' }],
        xl: ['var(--text-xl)', { lineHeight: '1.75rem' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '2rem' }],
        '3xl': ['var(--text-3xl)', { lineHeight: '2.25rem' }],
      },

      zIndex: {
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
      },

      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },

      // Breakpoints matching ux-standards.md
      screens: {
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
      },
    },
  },
}
