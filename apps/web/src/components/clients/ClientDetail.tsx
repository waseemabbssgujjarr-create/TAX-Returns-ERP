'use client'

import type { ClientDetail as ClientDetailType } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { DocumentsList } from '@/components/documents/DocumentsList'
import { TaxYearList } from '@/components/tax-years/TaxYearList'
import {
  addClientNote,
  archiveClient,
  fetchClient,
  fetchClientActivity,
  revealClientField,
} from '@/lib/api/clients'
import { useAuthStore } from '@/stores/authStore'

export function ClientDetail({ clientId }: { clientId: string }) {
  const t = useTranslations('clients')
  const { locale } = useParams<{ locale: string }>()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  const [client, setClient] = useState<ClientDetailType | null>(null)
  const [activity, setActivity] = useState<
    { id: string; kind: string; at: string; summary: string; authorName: string | null }[]
  >([])
  const [revealed, setRevealed] = useState<{ cnic?: string; ntn?: string }>({})
  const [noteBody, setNoteBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken || sessionState !== 'full') return
    setLoading(true)
    try {
      const [detail, timeline] = await Promise.all([
        fetchClient(accessToken, clientId),
        fetchClientActivity(accessToken, clientId),
      ])
      setClient(detail)
      setActivity(timeline.items)
      setError(null)
    } catch {
      setError(t('errors.notFound'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, sessionState, clientId, t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleReveal(field: 'cnic' | 'ntn') {
    if (!accessToken) return
    const { value } = await revealClientField(accessToken, clientId, { field })
    setRevealed((prev) => ({ ...prev, [field]: value }))
    void load()
  }

  async function handleArchive() {
    if (!accessToken || !window.confirm(t('detail.archiveConfirm'))) return
    await archiveClient(accessToken, clientId)
    void load()
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !noteBody.trim()) return
    await addClientNote(accessToken, clientId, { body: noteBody.trim() })
    setNoteBody('')
    void load()
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="bg-surface-hover h-8 w-48 animate-pulse rounded" />
        <div className="bg-surface-hover h-40 animate-pulse rounded-lg" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div>
        <p className="text-error">{error ?? t('errors.notFound')}</p>
        <Link href={`/${locale}/clients`} className="text-primary mt-4 inline-block underline">
          {t('detail.backToList')}
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={`/${locale}/clients`}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              {t('detail.backToList')}
            </Link>
            <h1 className="text-foreground mt-1 text-2xl font-semibold">{client.displayName}</h1>
            <p className="text-muted-foreground text-sm">
              {t(`type.${client.type}`)} · {t(`filerStatus.${client.filerStatus}`)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/${locale}/clients/${clientId}/edit`}>{t('detail.edit')}</Link>
            </Button>
            {!client.isArchived && (
              <Button variant="secondary" onClick={() => void handleArchive()}>
                {t('detail.archive')}
              </Button>
            )}
          </div>
        </div>

        {client.filerStatus === 'UNKNOWN' && (
          <div
            className="border-info/30 bg-info/10 rounded-md border px-4 py-3 text-sm"
            role="status"
          >
            {t('detail.atlBanner')}
          </div>
        )}

        <section aria-labelledby="identity-heading" className="border-border rounded-lg border p-4">
          <h2 id="identity-heading" className="text-lg font-medium">
            {t('detail.identity')}
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">{t('columns.cnic')}</dt>
              <dd className="font-mono text-sm">
                {revealed.cnic ?? client.cnicMasked ?? '—'}
                {client.cnicMasked && !revealed.cnic && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="ms-2 inline-flex h-8 px-2 text-xs"
                    onClick={() => void handleReveal('cnic')}
                  >
                    {t('detail.revealCnic')}
                  </Button>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t('columns.ntn')}</dt>
              <dd className="font-mono text-sm">
                {revealed.ntn ?? client.ntnMasked ?? '—'}
                {client.ntnMasked && !revealed.ntn && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="ms-2 inline-flex h-8 px-2 text-xs"
                    onClick={() => void handleReveal('ntn')}
                  >
                    {t('detail.revealNtn')}
                  </Button>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <TaxYearList clientId={clientId} />

        <DocumentsList clientId={clientId} showUpload compact />
        <p className="text-sm">
          <Link
            href={`/${locale}/documents?clientId=${clientId}`}
            className="text-primary underline"
          >
            {t('detail.documentsLink')}
          </Link>
        </p>

        <section aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="text-lg font-medium">
            {t('detail.notes')}
          </h2>
          <form onSubmit={(e) => void handleAddNote(e)} className="mt-3 space-y-2">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder={t('detail.notePlaceholder')}
              rows={3}
              className="border-border bg-surface w-full rounded-md border px-3 py-2 text-base"
            />
            <Button type="submit" disabled={!noteBody.trim()}>
              {t('detail.addNote')}
            </Button>
          </form>
        </section>
      </div>

      <aside aria-labelledby="activity-heading" className="border-border rounded-lg border p-4">
        <h2 id="activity-heading" className="text-lg font-medium">
          {t('detail.activity')}
        </h2>
        {activity.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">{t('detail.noActivity')}</p>
        ) : (
          <ul className="mt-4 space-y-3" role="list">
            {activity.map((item) => (
              <li key={item.id} className="border-border border-b pb-3 text-sm last:border-0">
                <time className="text-muted-foreground text-xs">
                  {new Date(item.at).toLocaleString(locale)}
                </time>
                <p className="mt-1">{item.summary}</p>
                {item.authorName && (
                  <p className="text-muted-foreground text-xs">{item.authorName}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
