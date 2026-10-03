export const FILING_EXPORT_PROVIDER = Symbol('FILING_EXPORT_PROVIDER')

export type FilingExportFormat = 'IRIS_XML' | 'PDF_SUMMARY'

/** Stub contract for regulator / IRIS filing export adapters. */
export interface FilingExportProvider {
  exportReturn(input: {
    firmId: string
    taxYearFileId: string
    format: FilingExportFormat
    locale: 'en' | 'ur'
  }): Promise<{ artifactRef: string; mimeType: string }>
}

export class StubFilingExportProvider implements FilingExportProvider {
  exportReturn(): Promise<{ artifactRef: string; mimeType: string }> {
    return Promise.reject(new Error('FilingExportProvider is not configured'))
  }
}
