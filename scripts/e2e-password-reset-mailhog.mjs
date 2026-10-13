/**
 * E2E: register+verify → password reset email → confirm → login
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const MH = 'http://localhost:8025/api/v2'

const stamp = Date.now()
const email = `e2e-pwreset-${stamp}@mailhog.local`
const password = 'E2e-Test-Passw0rd!'
const newPassword = 'E2e-New-Passw0rd!'

async function mhDeleteAll() {
  await fetch(`${MH}/messages`, { method: 'DELETE' })
}

async function mhWaitForTo(recipient, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${MH}/messages?limit=5`)
    const data = await res.json()
    const items = data.items ?? []
    const hit = items.find((m) =>
      (m.To ?? []).some(
        (t) => `${t.Mailbox}@${t.Domain}`.toLowerCase() === recipient.toLowerCase(),
      ),
    )
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

function decodeQuotedPrintable(raw) {
  const soft = raw.replace(/=\r?\n/g, '')
  return soft.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
}

function extractLinkToken(msg, pathSegment) {
  const bodies = [
    msg.Content?.Body,
    ...(msg.MIME?.Parts ?? []).map((p) => p.Body),
  ].filter(Boolean)
  for (const body of bodies) {
    const decoded = decodeQuotedPrintable(body)
    const re = new RegExp(`${pathSegment}\\?token=([^\\s"<>]+)`)
    const m = decoded.match(re)
    if (m) return decodeURIComponent(m[1])
  }
  return null
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

async function main() {
  await mhDeleteAll()

  const reg = await post('/auth/register', {
    firmName: `PW Reset Firm ${stamp}`,
    contactName: 'Reset Owner',
    email,
    password,
    confirmPassword: password,
    phone: '+923001234567',
    city: 'Lahore',
    firmSize: 'solo',
    acceptTerms: true,
  })
  console.log('register:', reg.status, JSON.stringify(reg.json))
  const firmSlug = reg.json.firmSlug

  const regMsg = await mhWaitForTo(email)
  const verifyToken = extractLinkToken(regMsg, 'verify-email')
  const verify = await post('/auth/register/verify', { token: verifyToken })
  console.log('verify:', verify.status, JSON.stringify(verify.json))

  await mhDeleteAll()

  const req = await post('/auth/password-reset/request', { firmSlug, email })
  console.log('reset request:', req.status, JSON.stringify(req.json))

  const resetMsg = await mhWaitForTo(email)
  console.log('MailHog reset subject:', resetMsg.Content?.Headers?.Subject?.[0])
  const resetToken = extractLinkToken(resetMsg, 'reset-password')
  if (!resetToken) throw new Error('no reset token in email')

  const confirm = await post('/auth/password-reset/confirm', {
    token: resetToken,
    password: newPassword,
    confirmPassword: newPassword,
  })
  console.log('reset confirm:', confirm.status, JSON.stringify(confirm.json))

  const loginOld = await post('/auth/login', { firmSlug, email, password })
  console.log('login old password:', loginOld.status, JSON.stringify(loginOld.json))

  const loginNew = await post('/auth/login', { firmSlug, email, password: newPassword })
  console.log(
    'login new password:',
    loginNew.status,
    loginNew.json.accessToken ? 'accessToken received' : JSON.stringify(loginNew.json),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
