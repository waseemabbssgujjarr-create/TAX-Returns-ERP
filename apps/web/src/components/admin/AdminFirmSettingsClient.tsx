'use client'

import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { staffInputClassName } from '@/components/staff/staffUi'
import { fetchFirmSettings, patchFirmSettings } from '@/lib/api/admin'
import { useAuthStore } from '@/stores/authStore'

export function AdminFirmSettingsClient() {
  const t = useTranslations('admin.firmSettings')
  const accessToken = useAuthStore((s) => s.accessToken)
  const [idle, setIdle] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const s = await fetchFirmSettings(accessToken)
      setIdle(s.idleTimeoutMinutes)
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

  async function onSave() {
    if (!accessToken) return
    try {
      const s = await patchFirmSettings(accessToken, { idleTimeoutMinutes: idle })
      setIdle(s.idleTimeoutMinutes)
      setSaved(true)
      setError(null)
    } catch {
      setError(t('errors.saveFailed'))
    }
  }

  if (loading)
    return <div className="bg-surface-hover h-24 animate-pulse rounded-lg" aria-busy="true" />

  return (
    <div className="max-w-md space-y-4">
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-muted-foreground text-sm" role="status">
          {t('saved')}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-muted-foreground">{t('idleTimeout')}</span>
        <input
          type="number"
          min={0}
          className={staffInputClassName}
          value={idle}
          onChange={(e) => setIdle(Number(e.target.value))}
        />
      </label>
      <Button onClick={() => void onSave()}>{t('save')}</Button>
    </div>
  )
}
