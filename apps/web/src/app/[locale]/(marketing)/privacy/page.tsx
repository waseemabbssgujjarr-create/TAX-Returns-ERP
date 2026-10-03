import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LegalDocument } from '@/components/marketing/LegalDocument'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legal.privacy' })
  return {
    title: t('title'),
    description: t('metaDescription'),
  }
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('legal.privacy')
  const tCommon = await getTranslations('legal')

  return (
    <LegalDocument
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      reviewBanner={tCommon('reviewBanner')}
      intro={[t('intro1'), t('intro2')]}
      backLabel={tCommon('backHome')}
      sections={[
        {
          title: t('sections.scope.title'),
          paragraphs: [t('sections.scope.body')],
        },
        {
          title: t('sections.tenancy.title'),
          paragraphs: [t('sections.tenancy.body')],
          bullets: [t('sections.tenancy.b1'), t('sections.tenancy.b2'), t('sections.tenancy.b3')],
        },
        {
          title: t('sections.sensitive.title'),
          paragraphs: [t('sections.sensitive.body')],
          bullets: [
            t('sections.sensitive.b1'),
            t('sections.sensitive.b2'),
            t('sections.sensitive.b3'),
            t('sections.sensitive.b4'),
          ],
        },
        {
          title: t('sections.ai.title'),
          paragraphs: [t('sections.ai.body')],
          bullets: [
            t('sections.ai.b1'),
            t('sections.ai.b2'),
            t('sections.ai.b3'),
            t('sections.ai.b4'),
            t('sections.ai.b5'),
          ],
        },
        {
          title: t('sections.retention.title'),
          paragraphs: [t('sections.retention.body')],
          bullets: [
            t('sections.retention.b1'),
            t('sections.retention.b2'),
            t('sections.retention.b3'),
            t('sections.retention.b4'),
          ],
        },
        {
          title: t('sections.security.title'),
          paragraphs: [t('sections.security.body')],
          bullets: [
            t('sections.security.b1'),
            t('sections.security.b2'),
            t('sections.security.b3'),
            t('sections.security.b4'),
          ],
        },
        {
          title: t('sections.contact.title'),
          paragraphs: [t('sections.contact.body')],
        },
      ]}
    />
  )
}
