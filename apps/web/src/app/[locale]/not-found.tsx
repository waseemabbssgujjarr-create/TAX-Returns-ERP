import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('errors')

  return (
    <main
      id="main-content"
      className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <p className="text-primary text-6xl font-bold" aria-hidden="true">
        404
      </p>
      <h1 className="text-foreground text-2xl font-semibold">{t('notFound.title')}</h1>
      <p className="text-muted-foreground text-sm">{t('notFound.description')}</p>
      <Link
        href={'/' as Route}
        className="bg-primary hover:bg-primary-hover focus-visible:ring-primary mt-2 rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:ring-2"
      >
        {t('notFound.action')}
      </Link>
    </main>
  )
}
