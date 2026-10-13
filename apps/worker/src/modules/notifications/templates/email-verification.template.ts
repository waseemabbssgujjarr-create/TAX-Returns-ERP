export function emailVerificationEmail(params: {
  firmName: string
  verifyUrl: string
  expiresHours: number
}): { subject: string; text: string; html: string } {
  const subject = 'Verify your TaxDesk PK email address'
  const text = [
    `Welcome to TaxDesk PK for ${params.firmName}.`,
    '',
    'Confirm your work email to finish setting up your firm workspace:',
    params.verifyUrl,
    '',
    `This link expires in ${params.expiresHours} hours and can only be used once.`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n')

  const html = [
    `<p>Welcome to <strong>TaxDesk PK</strong> for ${escapeHtml(params.firmName)}.</p>`,
    `<p><a href="${escapeHtml(params.verifyUrl)}">Verify your email address</a> to finish setting up your firm workspace.</p>`,
    `<p>This link expires in ${params.expiresHours} hours and can only be used once.</p>`,
    `<p>If you did not request this, you can ignore this email.</p>`,
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
