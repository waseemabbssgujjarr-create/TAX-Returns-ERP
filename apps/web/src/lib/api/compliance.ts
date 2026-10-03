import type { PenaltyEstimateBody } from '@taxdesk/schemas'
import { PenaltyEstimateResultSchema } from '@taxdesk/schemas'

import { apiFetch } from './base'

export async function estimatePenalty(accessToken: string, body: PenaltyEstimateBody) {
  const data = await apiFetch<unknown>('/compliance/penalty-estimate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  })
  return PenaltyEstimateResultSchema.parse(data)
}
