import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Clean up after each test (unmount components, clear DOM)
afterEach(() => {
  cleanup()
})

// Extend vitest matchers with Testing Library assertions
// (add @testing-library/jest-dom if needed)
