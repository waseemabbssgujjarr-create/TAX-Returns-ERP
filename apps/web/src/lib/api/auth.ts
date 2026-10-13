import { apiFetch, ApiError } from './base'

export type StaffRole = 'OWNER' | 'MANAGER' | 'ASSOCIATE' | 'REVIEWER' | 'ADMIN' | 'PREPARER'

export interface LoginRequest {
  firmSlug: string
  email: string
  password: string
}

export type LoginResponse =
  | { accessToken: string; requiresTotpSetup: true }
  | { accessToken: string; requiresTotp: true }

export interface TotpVerifyRequest {
  code?: string
  recoveryCode?: string
}

export interface TotpVerifyResponse {
  accessToken: string
}

export interface TotpSetupInitiateResponse {
  otpAuthUrl: string
  qrCodeDataUrl: string
  secretDisplayText: string
}

export interface TotpSetupConfirmResponse {
  recoveryCodes: string[]
}

export interface RefreshResponse {
  accessToken: string
}

export interface AuthMeResponse {
  user: {
    id: string
    name: string
    role: StaffRole
    firmId: string
    totpEnabled: boolean
  }
  firm: {
    name: string
    idleTimeoutMinutes: number
  }
}

export interface OtpSendRequest {
  firmSlug: string
  contact: string
  channel: 'email'
}

export interface OtpSendResponse {
  message: string
}

export interface OtpVerifyRequest {
  firmSlug: string
  contact: string
  code: string
}

export interface OtpVerifyResponse {
  accessToken: string
}

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  reason?: string
}

export function getProblemReason(error: unknown): string | undefined {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const reason = (error.body as ProblemDetails).reason
    return typeof reason === 'string' ? reason : undefined
  }
  return undefined
}

function authHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {}
  return { Authorization: `Bearer ${accessToken}` }
}

export async function postLogin(body: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postTotpVerify(
  body: TotpVerifyRequest,
  accessToken: string,
): Promise<TotpVerifyResponse> {
  return apiFetch<TotpVerifyResponse>('/auth/totp/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: authHeaders(accessToken),
  })
}

export async function postTotpSetupInitiate(
  accessToken: string,
): Promise<TotpSetupInitiateResponse> {
  return apiFetch<TotpSetupInitiateResponse>('/auth/totp/setup/initiate', {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function postTotpSetupConfirm(
  code: string,
  accessToken: string,
): Promise<TotpSetupConfirmResponse> {
  return apiFetch<TotpSetupConfirmResponse>('/auth/totp/setup/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
    headers: authHeaders(accessToken),
  })
}

export async function postTotpSetupComplete(accessToken: string): Promise<TotpVerifyResponse> {
  return apiFetch<TotpVerifyResponse>('/auth/totp/setup/complete', {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function postRefresh(): Promise<RefreshResponse> {
  return apiFetch<RefreshResponse>('/auth/refresh', { method: 'POST' })
}

export async function postLogout(accessToken?: string | null): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    headers: authHeaders(accessToken),
  })
}

export async function postOtpSend(body: OtpSendRequest): Promise<OtpSendResponse> {
  return apiFetch<OtpSendResponse>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postOtpVerify(body: OtpVerifyRequest): Promise<OtpVerifyResponse> {
  return apiFetch<OtpVerifyResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getAuthMe(accessToken: string): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me', {
    headers: authHeaders(accessToken),
  })
}

export interface RegisterRequest {
  firmName: string
  contactName: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  city: string
  firmSize: 'solo' | 'small' | 'medium' | 'large'
  notes?: string
  acceptTerms: true
}

export type RegisterResponse =
  | { status: 'verification_sent'; firmSlug: string }
  | { status: 'verification_pending'; firmSlug: string; emailDeliveryFailed: true }

export async function postRegister(body: RegisterRequest): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type VerifyEmailResponse =
  | { status: 'verified'; firmSlug: string }
  | { status: 'already_verified'; firmSlug: string }
  | { status: 'invalid_token' }
  | { status: 'expired_token' }
  | { status: 'used_token' }

export async function postVerifyEmail(body: { token: string }): Promise<VerifyEmailResponse> {
  return apiFetch<VerifyEmailResponse>('/auth/register/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postResendVerification(body: {
  firmSlug: string
  email: string
}): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register/resend', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
