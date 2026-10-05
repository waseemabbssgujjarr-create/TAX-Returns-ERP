import { redirect } from 'next/navigation'

/** Legacy admin storage URL → Settings → Storage. */
export default async function AdminStorageRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/settings/storage`)
}
