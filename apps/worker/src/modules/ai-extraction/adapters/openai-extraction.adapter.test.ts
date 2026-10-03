import type { ConfigService } from '@nestjs/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OpenAiNotConfiguredError } from '../openai.errors'

import { OpenAiExtractionAdapter } from './openai-extraction.adapter'

describe('OpenAiExtractionAdapter', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  it('throws OpenAiNotConfiguredError when API key is empty', async () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'openai.apiKey') return ''
        return undefined
      }),
    } as unknown as ConfigService

    const adapter = new OpenAiExtractionAdapter(config)

    await expect(
      adapter.classify({ fileId: 'k', mimeType: 'application/pdf', firmId: 'f' }),
    ).rejects.toBeInstanceOf(OpenAiNotConfiguredError)
  })
})
