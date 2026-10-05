'use client'

import type { GoogleDriveStatus } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import {
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
  startGoogleDriveConnect,
} from '@/lib/api/googleDrive'
import { useAuthStore } from '@/stores/authStore'

function formatWhen(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

export function StorageSettingsClient() {
  const t = useTranslations('settings.storage')
  const accessToken = useAuthStore((s) => s.accessToken)
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<GoogleDriveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      setStatus(await fetchGoogleDriveStatus(accessToken))
      setError(null)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [accessToken, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const gdriveError = searchParams.get('gdriveError')
    const gdriveConnected = searchParams.get('gdriveConnected')
    const known = [
      'invalid_request',
      'invalid_state',
      'state_expired',
      'state_reused',
      'connect_failed',
    ]
    if (gdriveError) {
      const key = known.includes(gdriveError) ? gdriveError : 'generic'
      setError(t(`errors.callback.${key}`))
    } else if (gdriveConnected) {
      setSuccess(t('googleDrive.connectedSuccess'))
      void load()
    }
  }, [searchParams, t, load])

  async function onConnect() {
    if (!accessToken) return
    setActionPending(true)
    setError(null)
    setSuccess(null)
    try {
      const { authUrl } = await startGoogleDriveConnect(accessToken)
      window.location.href = authUrl
    } catch {
      setError(t('errors.connectFailed'))
      setActionPending(false)
    }
  }

  async function onDisconnect() {
    if (!accessToken) return
    setActionPending(true)
    try {
      await disconnectGoogleDrive(accessToken)
      await load()
      setSuccess(t('googleDrive.disconnectedSuccess'))
    } catch {
      setError(t('errors.disconnectFailed'))
    } finally {
      setActionPending(false)
    }
  }

  if (loading) {
    return <div className="bg-surface-hover h-32 animate-pulse rounded-lg" aria-busy="true" />
  }

  const connected = status?.connected ?? false
  const needsReconnect =
    status?.status === 'REVOKED' || status?.status === 'ERROR' || Boolean(status?.lastErrorMessage)
  const locale =
    typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'
  const lastSync = formatWhen(status?.lastSyncedAt, locale)
  const connectedAt = formatWhen(status?.connectedAt, locale)

  let statusLabel = t('status.notConnected')
  let statusClass = 'bg-warning-subtle text-warning'
  if (connected && !needsReconnect) {
    statusLabel = t('status.connected')
    statusClass = 'bg-success-subtle text-success'
  } else if (needsReconnect) {
    statusLabel = t('status.reconnectRequired')
    statusClass = 'bg-error-subtle text-error'
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      {error ? (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-success text-sm" role="status">
          {success}
        </p>
      ) : null}

      <div className="border-border bg-surface-subtle/40 rounded-md border p-4 text-sm shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-foreground font-medium">{t('googleDrive.name')}</p>
            {connected && status?.googleAccountEmail ? (
              <p className="text-muted-foreground mt-1">
                {t('googleDrive.connectedAs', { email: status.googleAccountEmail })}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1">{t('googleDrive.notConnected')}</p>
            )}
            {connectedAt ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {t('googleDrive.connectedAt', { when: connectedAt })}
              </p>
            ) : null}
            {lastSync ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {t('googleDrive.lastSync', { when: lastSync })}
              </p>
            ) : null}
            {status?.lastErrorMessage ? (
              <p className="text-error mt-2 text-xs">{status.lastErrorMessage}</p>
            ) : null}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {connected && !needsReconnect ? (
            <>
              <Button size="sm" variant="secondary" isLoading={actionPending} onClick={() => void onConnect()}>
                {t('googleDrive.reconnect')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                isLoading={actionPending}
                onClick={() => void onDisconnect()}
              >
                {t('googleDrive.disconnect')}
              </Button>
            </>
          ) : (
            <Button size="sm" isLoading={actionPending} onClick={() => void onConnect()}>
              {needsReconnect ? t('googleDrive.reconnect') : t('googleDrive.connect')}
            </Button>
          )}
        </div>
      </div>

      <p className="text-muted-foreground text-xs">{t('googleDrive.noPublicLinks')}</p>
    </div>
  )
}
