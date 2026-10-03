import { z } from 'zod'

export const LoginSchema = z.object({
  firmSlug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  password: z.string().min(1),
})

export const TotpVerifySchema = z
  .object({
    code: z
      .string()
      .length(6)
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z
      .string()
      .length(10)
      .regex(/^[A-F0-9]{10}$/i)
      .optional(),
  })
  .refine((v) => Boolean(v.code ?? v.recoveryCode), {
    message: 'code or recoveryCode is required',
  })

export const TotpSetupConfirmSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
})

export const OtpSendSchema = z.object({
  firmSlug: z.string().min(2).max(60),
  contact: z.string().email(),
  channel: z.enum(['email', 'sms']).default('email'),
})

export const OtpVerifySchema = z.object({
  firmSlug: z.string().min(2).max(60),
  contact: z.string().email(),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
})

export type LoginBody = z.infer<typeof LoginSchema>
export type TotpVerifyBody = z.infer<typeof TotpVerifySchema>
export type TotpSetupConfirmBody = z.infer<typeof TotpSetupConfirmSchema>
export type OtpSendBody = z.infer<typeof OtpSendSchema>
export type OtpVerifyBody = z.infer<typeof OtpVerifySchema>
