import { apiFetch } from './base'

export async function fetchNotices(accessToken: string, page = 1) {
  return apiFetch<{
    items: Array<{
      id: string
      title: string
      status: string
      clientId: string
      deadline: string | null
    }>
    total: number
  }>(`/notices?page=${page}&pageSize=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function fetchAllTaxYears(accessToken: string, page = 1) {
  return apiFetch<{
    items: Array<{
      id: string
      clientId: string
      clientName: string
      taxYear: number
      status: string
      dueDate: string | null
      overdue: boolean
      filingStatus: string | null
    }>
    total: number
  }>(`/tax-years?page=${page}&pageSize=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function fetchComplianceEvents(accessToken: string, page = 1) {
  return apiFetch<{
    items: Array<{ id: string; title: string; kind: string; eventAt: string }>
    total: number
  }>(`/compliance-events?page=${page}&pageSize=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function fetchInvoices(accessToken: string, page = 1) {
  return apiFetch<{
    items: Array<{
      id: string
      invoiceNumber: string
      amountPaisa: string
      balancePaisa: string
      status: string
      clientId: string
    }>
    total: number
  }>(`/invoices?page=${page}&pageSize=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function fetchPortalHome(accessToken: string) {
  return apiFetch<{
    clientId: string
    infoRequests: Array<{ id: string; title: string; eventAt: string }>
    invoices: Array<{ invoiceNumber: string; balancePaisa: string; status: string }>
    actions: { canUploadDocuments: true; canViewBilling: boolean }
  }>('/portal/home', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
