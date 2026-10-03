import { defineConfig } from 'vitest/config'

const integrationCliRun = process.argv.some((arg) => arg.includes('.integration.test.'))

export default defineConfig({
  test: {
    environment: 'node',
    include: integrationCliRun ? ['src/**/*.integration.test.ts'] : ['src/**/*.test.ts'],
    exclude: integrationCliRun ? [] : ['src/**/*.integration.test.ts'],
    setupFiles: ['src/test/setup-env.ts'],
  },
})
