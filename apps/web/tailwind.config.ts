import type { Config } from 'tailwindcss'
import { taxdeskPreset } from '../../packages/ui/src/tailwind.preset'

const config: Config = {
  // Apply the shared design-system preset first
  presets: [taxdeskPreset],

  content: [
    './src/**/*.{ts,tsx}',
    // Include UI package components so Tailwind sees their class usage
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],

  theme: {
    extend: {
      // App-level overrides and additions go here.
      // Prefer adding tokens to the preset in packages/ui instead.
    },
  },

  plugins: [],
}

export default config
