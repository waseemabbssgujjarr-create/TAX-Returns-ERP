// ESLint flat config (ESLint 9+)
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'
import prettierConfig from 'eslint-config-prettier'

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '**/*.config.mjs',
      '**/*.config.js',
      'apps/worker/src/modules/__fixtures__/**',
      'apps/worker/src/database/inv4-eslint.test.ts',
      'apps/worker/**/*.integration.test.ts',
      'apps/worker/src/modules/auth/tests/**',
    ],
  },

  // ── TypeScript files ─────────────────────────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      // TypeScript strict rules
      ...tseslint.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // Money safety: ban floating-point arithmetic on financial values
      // (enforced by convention + type system; no-restricted-syntax catches obvious cases)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'BinaryExpression[operator=/[+\\-*\\/]/][left.raw=/^[0-9]+\\.[0-9]+$/]',
          message:
            'Do not use floating-point literals in arithmetic. Use bigint or Decimal for monetary values.',
        },
      ],

      // Import hygiene
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ── Worker domain modules — INV-4: no direct Prisma (use PrismaRlsClient) ───
  {
    files: ['apps/worker/src/modules/**/*.ts'],
    ignores: [
      'apps/worker/src/modules/auth/tenant-bootstrap.service.ts',
      'apps/worker/src/modules/auth/tenant-bootstrap.service.test.ts',
      // google_drive_oauth_states has no RLS (pre-auth OAuth callback, no bearer
      // token yet) — mirrors the tenant-bootstrap.service.ts bootstrap-client pattern.
      'apps/worker/src/modules/google-drive/google-drive-oauth.service.ts',
      'apps/worker/src/modules/google-drive/google-drive-oauth.service.test.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              importNames: ['PrismaClient', 'Prisma'],
              allowTypeImports: true,
              message:
                'Domain modules must use PrismaRlsClient.withRlsContext() — direct PrismaClient access violates INV-4. Enums/types from @prisma/client are allowed.',
            },
          ],
          patterns: [
            {
              group: ['**/database/prisma.service', '**/database/prisma.service.ts'],
              message:
                'Inject PrismaRlsClient instead of PrismaService for tenant-scoped operations (INV-4).',
            },
          ],
        },
      ],
    },
  },

  // ── Reminder scheduler — system cron: firmDirectory listing is cross-tenant ───
  {
    files: ['apps/worker/src/modules/reminder-scheduler/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              importNames: ['PrismaClient', 'Prisma'],
              allowTypeImports: true,
              message:
                'Domain modules must use PrismaRlsClient.withRlsContext() — direct PrismaClient access violates INV-4. Enums/types from @prisma/client are allowed.',
            },
          ],
        },
      ],
    },
  },

  // ── Web app — auth tokens must not be persisted in browser storage ───────────
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[object.name="localStorage"][property.name="setItem"], MemberExpression[object.name="sessionStorage"][property.name="setItem"]',
          message:
            'Do not persist data via localStorage/sessionStorage in apps/web. Access tokens must live in Zustand memory only.',
        },
        {
          selector: 'BinaryExpression[operator=/[+\\-*\\/]/][left.raw=/^[0-9]+\\.[0-9]+$/]',
          message:
            'Do not use floating-point literals in arithmetic. Use bigint or Decimal for monetary values.',
        },
      ],
    },
  },

  // ── Test files — relax some rules ───────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // ── Prettier must be last to disable formatting rules ───────────────────────
  prettierConfig,
]
