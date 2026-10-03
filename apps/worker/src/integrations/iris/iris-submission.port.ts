/**
 * IrisSubmissionPort — adapter boundary for FBR's IRIS e-filing system.
 *
 * Reality check (see docs/pakistan-tax-automation-roadmap.md):
 * FBR does not currently publish a stable, generally-available public API for
 * individual/AOP/company return submission. IRIS is a web portal driven by
 * username/password (+ PIN) credentials that the firm holds on the client's
 * behalf. Until FBR exposes (or a licensed middleware vendor exposes) a
 * supported API, this port has exactly one safe implementation: a stub that
 * fails closed so the product never claims a filing that did not happen.
 *
 * When real integration becomes available it will be one of:
 *   1. An official FBR/PRAL API (ApiIrisAdapter) — preferred, once published.
 *   2. A licensed RPA/middleware vendor that automates the IRIS portal
 *      (RpaIrisAdapter) — a pragmatic bridge while (1) does not exist.
 *   3. Continued manual filing — the firm exports the prepared return
 *      (RETURN_WORKSHEET / TAX_SUMMARY_PDF) and files it by hand on IRIS,
 *      then records the FBR acknowledgment/reference number here for
 *      tracking (ManualIrisAdapter — still useful as an audit trail).
 *
 * Swap the DI binding in IrisModule when a real adapter is ready. No other
 * code should import a vendor SDK directly — only this interface.
 */
export const IRIS_SUBMISSION_PORT = Symbol('IRIS_SUBMISSION_PORT')

export interface IrisCredentialRef {
  firmId: string
  clientId: string
}

export interface IrisSubmitReturnInput {
  firmId: string
  clientId: string
  taxYearFileId: string
  taxYear: number
  /** Opaque, already-assembled return payload — never invented tax figures. */
  payload: Record<string, unknown>
}

export interface IrisSubmitReturnResult {
  /** 'submitted' only when the adapter actually handed the return to IRIS. */
  outcome: 'submitted' | 'not_configured'
  irisReferenceNo?: string
  raw?: unknown
}

export interface IrisFetchStatusInput {
  firmId: string
  clientId: string
  irisReferenceNo: string
}

export interface IrisFetchStatusResult {
  outcome: 'accepted' | 'rejected' | 'pending' | 'not_configured'
  raw?: unknown
}

export interface IrisSyncCredentialsResult {
  outcome: 'synced' | 'not_configured'
}

/** Thrown by stub/unconfigured adapters — callers must treat this as a non-fatal, honest state. */
export class IrisNotConfiguredError extends Error {
  constructor(operation: string) {
    super(
      `IrisSubmissionPort.${operation} is not configured — no real IRIS integration is wired up yet.`,
    )
    this.name = 'IrisNotConfiguredError'
  }
}

/** Submits/queries a client's return against FBR's IRIS system, or syncs portal credentials. */
export interface IrisSubmissionPort {
  submitReturn(input: IrisSubmitReturnInput): Promise<IrisSubmitReturnResult>
  fetchStatus(input: IrisFetchStatusInput): Promise<IrisFetchStatusResult>
  syncCredentials(input: IrisCredentialRef): Promise<IrisSyncCredentialsResult>
}

/**
 * Default binding. Always resolves to an honest "not configured" outcome
 * rather than throwing, so the service layer can set PENDING_INTEGRATION
 * without treating every attempt as an application error.
 */
export class StubIrisAdapter implements IrisSubmissionPort {
  submitReturn(): Promise<IrisSubmitReturnResult> {
    return Promise.resolve({ outcome: 'not_configured' })
  }

  fetchStatus(): Promise<IrisFetchStatusResult> {
    return Promise.resolve({ outcome: 'not_configured' })
  }

  syncCredentials(): Promise<IrisSyncCredentialsResult> {
    return Promise.resolve({ outcome: 'not_configured' })
  }
}
