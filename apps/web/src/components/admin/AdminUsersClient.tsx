'use client'

import { PatchUserRoleBodySchema, UserRoleSchema } from '@taxdesk/schemas'
import { Button } from '@taxdesk/ui'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import { staffSelectClassName } from '@/components/staff/staffUi'
import { fetchAdminUsers, patchAdminUserRole } from '@/lib/api/admin'
import { useAuthStore } from '@/stores/authStore'

export function AdminUsersClient() {
  const t = useTranslations('admin.users')
  const accessToken = useAuthStore((s) => s.accessToken)
  const [items, setItems] = useState<Awaited<ReturnType<typeof fetchAdminUsers>>['items']>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const page = await fetchAdminUsers(accessToken)
      setItems(page.items)
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

  async function onRoleChange(userId: string, role: string) {
    if (!accessToken) return
    const parsed = PatchUserRoleBodySchema.safeParse({ role })
    if (!parsed.success) return
    try {
      await patchAdminUserRole(accessToken, userId, parsed.data)
      await load()
    } catch {
      setError(t('errors.saveFailed'))
    }
  }

  if (loading)
    return <div className="bg-surface-hover h-32 animate-pulse rounded-lg" aria-busy="true" />

  return (
    <div className="space-y-4 p-4 sm:p-0">
      <p className="text-muted-foreground text-sm">{t('hint')}</p>
      {error && (
        <p className="text-error text-sm" role="alert">
          {error}
        </p>
      )}
      <div className="border-border overflow-x-auto rounded-md border shadow-sm">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-surface-subtle/80">
            <tr className="border-border text-muted-foreground border-b text-start">
              <th className="px-3 py-2.5 font-medium">{t('columns.name')}</th>
              <th className="px-3 py-2.5 font-medium">{t('columns.email')}</th>
              <th className="px-3 py-2.5 font-medium">{t('columns.role')}</th>
              <th className="px-3 py-2.5 font-medium">{t('columns.totp')}</th>
              <th className="px-3 py-2.5 font-medium">{t('columns.active')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-border/60 hover:bg-surface-hover/50 border-b">
                <td className="px-3 py-2.5">{u.name}</td>
                <td className="px-3 py-2.5">{u.email}</td>
                <td className="px-3 py-2.5">
                  <select
                    className={staffSelectClassName}
                    value={u.role}
                    onChange={(e) => void onRoleChange(u.id, e.target.value)}
                    aria-label={t('columns.role')}
                  >
                    {UserRoleSchema.options
                      .filter((r) => r !== 'CLIENT')
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="px-3 py-2.5">{u.totpEnabled ? t('yes') : t('no')}</td>
                <td className="px-3 py-2.5">{u.isActive ? t('yes') : t('no')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" onClick={() => void load()}>
        {t('refresh')}
      </Button>
    </div>
  )
}
