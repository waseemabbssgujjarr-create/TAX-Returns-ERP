import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'e2e', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.stories.tsx', '**/*.config.*', '**/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@taxdesk/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@taxdesk/schemas': path.resolve(__dirname, '../../packages/schemas/src/index.ts'),
      '@taxdesk/tax-engine': path.resolve(__dirname, '../../packages/tax-engine/src/index.ts'),
      '@taxdesk/rules': path.resolve(__dirname, '../../packages/rules/src/index.ts'),
      '@taxdesk/i18n': path.resolve(__dirname, '../../packages/i18n/src/index.ts'),
    },
  },
})
