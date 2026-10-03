import { AnalyticsOverviewSchema, type AnalyticsOverview } from '@taxdesk/schemas'

import { apiFetch } from './base'

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function fetchAnalyticsOverview(accessToken: string): Promise<AnalyticsOverview> {
  const data = await apiFetch<unknown>('/analytics/overview', {
    headers: authHeaders(accessToken),
  })
  return AnalyticsOverviewSchema.parse(data)
}
