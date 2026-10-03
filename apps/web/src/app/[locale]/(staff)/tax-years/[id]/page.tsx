import { TaxYearWorkspace } from '@/components/tax-years/TaxYearWorkspace'

export default async function TaxYearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TaxYearWorkspace taxYearFileId={id} />
}
