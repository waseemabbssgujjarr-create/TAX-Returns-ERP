/**
 * AiExtractionProvider interface — all AI adapters must implement this.
 * The OpenAI implementation is one adapter; swap via DI without changing callers.
 */
export interface ClassifyResult {
  documentType: string
  confidence: number
  suggestedClientId?: string
  suggestedTaxYear?: number
}

export interface ExtractionUsage {
  inputTokens: number
  outputTokens: number
  costPaisaEst: number
}

export interface ExtractionResult {
  fields: Record<string, unknown>
  fieldConfidence: Record<string, number>
  overallConfidence: number
  pageReferences: Record<string, number>
  sourceSnippets: Record<string, string>
  model?: string
  usage?: ExtractionUsage
}

export interface ColumnMappingResult {
  mappings: Array<{ sourceColumn: string; targetField: string; confidence: number }>
}

export interface AiExtractionProvider {
  classify(input: {
    fileId: string
    mimeType: string
    firmId: string
    loadFileBytes?: () => Promise<Buffer>
  }): Promise<ClassifyResult>

  extract(input: {
    fileId: string
    documentType: string
    jsonSchema: Record<string, unknown>
    firmId: string
    documentId: string
    mimeType?: string
    loadFileBytes?: () => Promise<Buffer>
  }): Promise<ExtractionResult>

  mapColumns(input: {
    headers: string[]
    sampleRows: string[][]
    targetSchema: Record<string, unknown>
    firmId: string
  }): Promise<ColumnMappingResult>
}
