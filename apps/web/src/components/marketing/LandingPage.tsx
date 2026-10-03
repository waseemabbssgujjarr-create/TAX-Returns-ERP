import { HeroSection } from './HeroSection'
import {
  BillingSection,
  ComplianceSection,
  ComputationSection,
  CrmSection,
  DocumentsSection,
  FinalCtaSection,
  PakistanPlacesSection,
  PortalSection,
  ProblemSection,
  ProofSection,
  SecuritySection,
  TaxYearSection,
  WealthSection,
  WorkflowSection,
  WorkspaceSection,
} from './LandingSections'

/**
 * Marketing landing page — main content order.
 * Nav and footer are rendered by the (marketing) route group layout.
 */
export function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <WorkspaceSection />
      <CrmSection />
      <DocumentsSection />
      <TaxYearSection />
      <ComputationSection />
      <WealthSection />
      <ComplianceSection />
      <BillingSection />
      <PortalSection />
      <PakistanPlacesSection />
      <SecuritySection />
      <WorkflowSection />
      <ProofSection />
      <FinalCtaSection />
    </>
  )
}
