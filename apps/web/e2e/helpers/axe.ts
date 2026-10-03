import type { Page } from '@playwright/test'

type AxeBuilderLike = {
  include: (selector: string) => AxeBuilderLike
  analyze: () => Promise<{ violations: { id: string; impact?: string; nodes: unknown[] }[] }>
}

/**
 * Runs axe if @axe-core/playwright is installed; otherwise no-ops.
 */
export async function runAxeIfAvailable(
  page: Page,
  options?: { include?: string },
): Promise<void> {
  let AxeBuilder: new (args: { page: Page }) => AxeBuilderLike
  try {
    const mod = await import('@axe-core/playwright')
    AxeBuilder = mod.AxeBuilder as typeof AxeBuilder
  } catch {
    return
  }

  let builder = new AxeBuilder({ page })
  if (options?.include) {
    builder = builder.include(options.include)
  }
  const results = await builder.analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  )
  if (serious.length > 0) {
    throw new Error(
      `axe: ${serious.length} critical/serious violation(s): ${serious.map((v) => v.id).join(', ')}`,
    )
  }
}
