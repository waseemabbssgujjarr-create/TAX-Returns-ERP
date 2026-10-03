export function otpEmail(otp: string): { subject: string; text: string; html: string } {
  const subject = 'Your TaxDesk PK verification code'
  const text = `Your verification code is ${otp}. It expires in 10 minutes. Do not share this code.`
  const html = `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. Do not share this code.</p>`
  return { subject, text, html }
}
