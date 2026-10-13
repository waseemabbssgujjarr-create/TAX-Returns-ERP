export function passwordResetEmail(params: {
  firmName: string
  resetUrl: string
  expiresMinutes: number
}): { subject: string; text: string; html: string } {
  const subject = 'Reset your TaxDesk PK password'
  const text = [
    `A password reset was requested for your ${params.firmName} workspace on TaxDesk PK.`,
    '',
    'Choose a new password using this link:',
    params.resetUrl,
    '',
    `This link expires in ${params.expiresMinutes} minutes and can only be used once.`,
    '',
    'If you did not request this, you can ignore this email. Your password will not change.',
  ].join('\n')

  const html = [
    `<p>A password reset was requested for your <strong>${escapeHtml(params.firmName)}</strong> workspace on TaxDesk PK.</p>`,
    `<p><a href="${escapeHtml(params.resetUrl)}">Reset your password</a></p>`,
    `<p>This link expires in ${params.expiresMinutes} minutes and can only be used once.</p>`,
    `<p>If you did not request this, you can ignore this email. Your password will not change.</p>`,
  ].join('')

  return { subject, text, html }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
