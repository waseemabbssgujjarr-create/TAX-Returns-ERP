'use client'

import { useEffect } from 'react'

import { useRouter } from '@/i18n/navigation'
import { useAuthStore } from '@/stores/authStore'

export function useRequirePartialSession() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionState = useAuthStore((s) => s.sessionState)

  useEffect(() => {
    // Only bounce unauthenticated users — after TOTP success sessionState becomes 'full'
    // and must not be treated as a failure (that would race router.push('/dashboard')).
    if (sessionState === 'unauthenticated' || !accessToken) {
      router.replace('/login')
    }
  }, [accessToken, router, sessionState])

  return { accessToken, ready: sessionState === 'partial' && !!accessToken }
}
