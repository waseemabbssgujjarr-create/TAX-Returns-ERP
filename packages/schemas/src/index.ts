// ── Common primitives ─────────────────────────────────────────────────────────
export {
  CNIC_MUST_BE_13_DIGITS,
  NTN_MUST_BE_7_DIGITS,
  CnicSchema,
  NtnSchema,
  PakistanPhoneSchema,
  PaisaStringSchema,
  PaisaNumberSchema,
  IsoDateSchema,
  TaxYearSchema,
  LocaleSchema,
  UuidSchema,
  PaginationQuerySchema,
  paginatedResponseSchema,
} from './common'

export type { Locale, PaginationQuery } from './common'

// ── AI Extraction schemas ─────────────────────────────────────────────────────
export {
  BankTransactionSchema,
  BankStatementExtractionSchema,
  validateBankStatement,
} from './extraction/bankStatement'

export type { BankTransaction, BankStatementExtraction } from './extraction/bankStatement'

export {
  AllowanceItemSchema,
  SalaryCertificateExtractionSchema,
  validateSalaryCertificate,
} from './extraction/salaryCertificate'

export type { AllowanceItem, SalaryCertificateExtraction } from './extraction/salaryCertificate'

// ── Client CRM ────────────────────────────────────────────────────────────────
export {
  ClientTypeSchema,
  FilerStatusSchema,
  ListClientsQuerySchema,
  CreateClientBodySchema,
  UpdateClientBodySchema,
  AddClientNoteBodySchema,
  RevealClientFieldBodySchema,
  CheckDuplicateQuerySchema,
  ClientSummarySchema,
  ClientDetailSchema,
  PaginatedClientsSchema,
  DuplicateCheckResultSchema,
  ClientActivityListSchema,
} from './clients'

export type {
  ListClientsQuery,
  CreateClientBody,
  UpdateClientBody,
  AddClientNoteBody,
  RevealClientFieldBody,
  CheckDuplicateQuery,
  ClientSummary,
  ClientDetail,
} from './clients'

// ── Document Hub ──────────────────────────────────────────────────────────────
export {
  DocumentCategorySchema,
  DocumentStatusSchema,
  DocumentProcessingStatusSchema,
  DocumentExtractionStatusSchema,
  DocumentReviewStatusSchema,
  ListDocumentsQuerySchema,
  UploadDocumentBodySchema,
  UpdateDocumentBodySchema,
  DocumentSummarySchema,
  DocumentDetailSchema,
  DocumentVersionSummarySchema,
  DocumentVersionsResponseSchema,
  PaginatedDocumentsSchema,
  SignedDownloadUrlSchema,
} from './documents'

export type { ListDocumentsQuery, UploadDocumentBody, UpdateDocumentBody } from './documents'

// ── Tax year workspace ────────────────────────────────────────────────────────
export {
  TaxYearStatusSchema,
  TaxYearSectionKeySchema,
  TaxYearSectionsSchema,
  DataProvenanceSchema,
  TaxYearSectionPayloadSchema,
  ListTaxYearsQuerySchema,
  CreateTaxYearBodySchema,
  UpdateTaxYearBodySchema,
  TaxYearSummarySchema,
  TaxYearDetailSchema,
  PaginatedTaxYearsSchema,
  TaxYearFirmSummarySchema,
  PaginatedFirmTaxYearsSchema,
  ComputationWarningSchema,
  ComputationValidationErrorSchema,
  ComputationBreakdownNodeSchema,
  ComputationSnapshotSchema,
} from './taxYears'

export type {
  TaxYearSectionKey,
  DataProvenance,
  ListTaxYearsQuery,
  CreateTaxYearBody,
  UpdateTaxYearBody,
  ComputationSnapshot,
  TaxYearDetail,
  TaxYearFirmSummary,
} from './taxYears'

export {
  WealthStatementStatusSchema,
  WealthReviewStatusSchema,
  UpsertWealthStatementBodySchema,
  WealthStatementSchema,
} from './wealthStatement'

export type { UpsertWealthStatementBody, WealthStatementDto } from './wealthStatement'

export {
  WithholdingSourceSchema,
  WithholdingReviewStatusSchema,
  WithholdingValidationStatusSchema,
  CreateWithholdingEntryBodySchema,
  UpdateWithholdingEntryBodySchema,
  WithholdingEntrySchema,
  WithholdingReconcileResultSchema,
  WithholdingChecklistSchema,
} from './withholding'

export type {
  CreateWithholdingEntryBody,
  UpdateWithholdingEntryBody,
  WithholdingValidationStatus,
  WithholdingChecklist,
} from './withholding'

export {
  ReturnPrepReviewStatusSchema,
  ReturnPrepRulesStateSchema,
  ReturnPrepFieldStateSchema,
  ReturnPrepDraftV1Schema,
  UpsertReturnPreparationBodySchema,
  ApproveReturnPrepBodySchema,
  DemoteReturnPrepBodySchema,
  ReturnPreparationSchema,
  ReturnPrepActivityItemSchema,
} from './returnPrep'

export type {
  UpsertReturnPreparationBody,
  ApproveReturnPrepBody,
  DemoteReturnPrepBody,
  ReturnPrepDraftV1,
  ReturnPrepFieldState,
  ReturnPrepValidation,
  ReturnPreparationDto,
  ReturnPrepActivityItem,
} from './returnPrep'

export {
  IrisFilingStatusSchema,
  IrisFilingChannelSchema,
  FilingChecklistItemSchema,
  FilingReadinessSchema,
  IrisFilingSchema,
  SubmitIrisFilingBodySchema,
  RecordManualIrisReferenceBodySchema,
  FilingActivityItemSchema,
} from './filing'

export type {
  FilingReadiness,
  IrisFilingDto,
  SubmitIrisFilingBody,
  RecordManualIrisReferenceBody,
  FilingActivityItem,
} from './filing'

export {
  TaxPlanAssumptionSchema,
  CreateTaxPlanScenarioBodySchema,
  TaxPlanScenarioSchema,
  TaxPlanRejectionSchema,
} from './taxPlanning'

export type { CreateTaxPlanScenarioBody } from './taxPlanning'

export {
  NoticeStatusSchema,
  ListNoticesQuerySchema,
  CreateNoticeBodySchema,
  UpdateNoticeBodySchema,
  NoticeSummarySchema,
  ComplianceEventKindSchema,
  ListComplianceEventsQuerySchema,
  CreateComplianceEventBodySchema,
  ComplianceEventSchema,
  PenaltyFilingKindSchema,
  PenaltyClientTypeSchema,
  PenaltyEstimateBodySchema,
  PenaltyEstimateResultSchema,
} from './complianceOps'

export type {
  ListNoticesQuery,
  CreateNoticeBody,
  UpdateNoticeBody,
  ListComplianceEventsQuery,
  CreateComplianceEventBody,
  PenaltyEstimateBody,
  PenaltyEstimateResult,
} from './complianceOps'

export {
  InvoiceStatusSchema,
  ListInvoicesQuerySchema,
  CreateInvoiceBodySchema,
  RecordPaymentBodySchema,
  InvoiceSummarySchema,
} from './billing'

export type { ListInvoicesQuery, CreateInvoiceBody, RecordPaymentBody } from './billing'

export { PortalHomeSchema } from './portalHome'

export type { PortalHome } from './portalHome'

export {
  AnalyticsOverviewSchema,
  AnalyticsStaffWorkloadSchema,
  AnalyticsUpcomingDeadlineSchema,
} from './analytics'

export type {
  AnalyticsOverview,
  AnalyticsStaffWorkload,
  AnalyticsUpcomingDeadline,
} from './analytics'

export {
  UserRoleSchema,
  AdminUserSummarySchema,
  AdminUsersListSchema,
  PatchUserRoleBodySchema,
  AdminSessionSummarySchema,
  AdminSessionsListSchema,
  RevokeSessionBodySchema,
  ListAuditLogsQuerySchema,
  AuditLogEntrySchema,
  PaginatedAuditLogsSchema,
  FirmSettingsSchema,
  PatchFirmSettingsBodySchema,
} from './admin'

export type {
  AdminUserSummary,
  PatchUserRoleBody,
  AdminSessionSummary,
  RevokeSessionBody,
  ListAuditLogsQuery,
  AuditLogEntry,
  FirmSettings,
  PatchFirmSettingsBody,
} from './admin'

export { resolveExtractionKind, getExtractionSchemaBundle } from './extraction/registry'

export type { ExtractionDocumentKind } from './extraction/registry'

export {
  ExportArtifactTypeSchema,
  ExportArtifactStatusSchema,
  CreateExportBodySchema,
  ExportArtifactSchema,
  SignedExportDownloadSchema,
} from './exports'

export type { CreateExportBody } from './exports'

// ── Google Drive per-user storage ─────────────────────────────────────────────
export {
  GoogleDriveConnectionStatusSchema,
  GoogleDriveStatusSchema,
  GoogleDriveConnectStartResponseSchema,
  GoogleDriveDisconnectResponseSchema,
  DisconnectGoogleDriveBodySchema,
  GoogleDriveConnectionSummarySchema,
  GoogleDriveConnectionsListSchema,
} from './googleDrive'

export type {
  GoogleDriveConnectionStatus,
  GoogleDriveStatus,
  GoogleDriveConnectStartResponse,
  DisconnectGoogleDriveBody,
  GoogleDriveConnectionSummary,
  GoogleDriveConnectionsList,
} from './googleDrive'
