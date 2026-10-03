import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LegalDocument } from '@/components/marketing/LegalDocument'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'legal.terms' })
  return {
    title: t('title'),
    description: t('metaDescription'),
  }
}

export default async function TermsOfServicePage() {
  const t = await getTranslations('legal.terms')
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
          title: t('sections.acceptance.title'),
          paragraphs: [t('sections.acceptance.body')],
        },
        {
          title: t('sections.service.title'),
          paragraphs: [t('sections.service.body')],
          bullets: [t('sections.service.b1'), t('sections.service.b2'), t('sections.service.b3')],
        },
        {
          title: t('sections.taxSafety.title'),
          paragraphs: [t('sections.taxSafety.body')],
          bullets: [
            t('sections.taxSafety.b1'),
            t('sections.taxSafety.b2'),
            t('sections.taxSafety.b3'),
            t('sections.taxSafety.b4'),
          ],
        },
        {
          title: t('sections.accounts.title'),
          paragraphs: [t('sections.accounts.body')],
          bullets: [
            t('sections.accounts.b1'),
            t('sections.accounts.b2'),
            t('sections.accounts.b3'),
          ],
        },
        {
          title: t('sections.acceptableUse.title'),
          paragraphs: [t('sections.acceptableUse.body')],
          bullets: [
            t('sections.acceptableUse.b1'),
            t('sections.acceptableUse.b2'),
            t('sections.acceptableUse.b3'),
          ],
        },
        {
          title: t('sections.liability.title'),
          paragraphs: [t('sections.liability.body')],
        },
        {
          title: t('sections.changes.title'),
          paragraphs: [t('sections.changes.body')],
        },
        {
          title: t('sections.contact.title'),
          paragraphs: [t('sections.contact.body')],
        },
      ]}
    />
  )
}
