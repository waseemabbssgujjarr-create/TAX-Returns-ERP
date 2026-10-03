import { readFileSync } from 'node:fs'
import path from 'node:path'

const tsParser = require('@typescript-eslint/parser') as typeof import('@typescript-eslint/parser')
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '../../../..')
const violationFile = path.join(
  repoRoot,
  'apps/worker/src/modules/__fixtures__/inv4-prisma-violation.ts',
)

describe('INV-4 ESLint architecture rule', () => {
  it('flags direct PrismaClient imports in domain modules', async () => {
    const source = readFileSync(violationFile, 'utf8')

    const eslint = new ESLint({
      cwd: repoRoot,
      // Isolate from repo eslint.config.mjs so the test is self-contained
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: tsParser,
            parserOptions: {
              ecmaVersion: 'latest',
              sourceType: 'module',
            },
          },
          rules: {
            'no-restricted-imports': [
              'error',
              {
                paths: [
                  {
                    name: '@prisma/client',
                    importNames: ['PrismaClient', 'Prisma'],
                    message:
                      'Domain modules must use PrismaRlsClient.withRlsContext() — direct PrismaClient access violates INV-4.',
                  },
                ],
              },
            ],
          },
        },
      ],
    })

    const results = await eslint.lintText(source, { filePath: violationFile })
    const messages = results.flatMap((file) => file.messages)
    const restricted = messages.find((m) => m.ruleId === 'no-restricted-imports')

    expect(restricted).toBeDefined()
    expect(restricted?.message).toMatch(/INV-4/i)
  })
})
