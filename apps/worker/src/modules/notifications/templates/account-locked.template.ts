export function accountLockedEmail(
  firmName: string,
  lockedAt: Date,
): {
  subject: string
  text: string
  html: string
} {
  const timestamp = lockedAt.toISOString()
  const subject = 'TaxDesk PK — Account Locked'
  const text = `Your TaxDesk PK account for ${firmName} was locked due to repeated failed sign-in attempts at ${timestamp}. If this was not you, contact your firm administrator.`
  const html = `<p>Your TaxDesk PK account for <strong>${firmName}</strong> was locked due to repeated failed sign-in attempts at ${timestamp}.</p><p>If this was not you, contact your firm administrator.</p>`
  return { subject, text, html }
}
