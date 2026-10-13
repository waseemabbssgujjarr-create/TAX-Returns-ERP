/**
 * Local E2E: register → MailHog → verify → login
 * Usage: node scripts/e2e-registration-mailhog.mjs
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const MH = 'http://localhost:8025/api/v2'

const stamp = Date.now()
const email = `e2e-reg-${stamp}@mailhog.local`
const password = 'E2e-Test-Passw0rd!'
const firmName = `E2E Firm ${stamp}`

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

function extractTokenFromMessage(msg) {
  const bodies = [
    msg.Content?.Body,
    ...(msg.MIME?.Parts ?? []).map((p) => p.Body),
  ].filter(Boolean)
  for (const body of bodies) {
    const decoded = decodeQuotedPrintable(body)
    const m = decoded.match(/verify-email\?token=([^\s"<>]+)/)
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
  console.log('API:', API)
  console.log('Test email:', email)

  await mhDeleteAll()

  const reg = await post('/auth/register', {
    firmName,
    contactName: 'E2E Owner',
    email,
    password,
    confirmPassword: password,
    phone: '+923001234567',
    city: 'Lahore',
    firmSize: 'solo',
    acceptTerms: true,
  })
  console.log('register:', reg.status, JSON.stringify(reg.json))

  if (reg.status !== 201 && reg.status !== 200) {
    process.exit(1)
  }

  const firmSlug = reg.json.firmSlug
  if (reg.json.emailDeliveryFailed) {
    console.error('FAIL: emailDeliveryFailed=true')
    process.exit(1)
  }

  const msg = await mhWaitForTo(email)
  if (!msg) {
    console.error('FAIL: no MailHog message for', email)
    process.exit(1)
  }
  console.log('MailHog: received message subject:', msg.Content?.Headers?.Subject?.[0])

  const token = extractTokenFromMessage(msg)
  if (!token) {
    console.error('FAIL: could not parse verification token from email')
    process.exit(1)
  }
  console.log('Token extracted (length):', token.length)

  const loginBefore = await post('/auth/login', {
    firmSlug,
    email,
    password,
  })
  console.log('login before verify:', loginBefore.status, JSON.stringify(loginBefore.json))
  if (loginBefore.json.reason !== 'email_not_verified') {
    console.error('FAIL: expected reason email_not_verified before verify')
    process.exit(1)
  }

  const verify = await post('/auth/register/verify', { token })
  console.log('verify:', verify.status, JSON.stringify(verify.json))

  const verifyAgain = await post('/auth/register/verify', { token })
  console.log('verify again (used token):', verifyAgain.status, JSON.stringify(verifyAgain.json))

  const loginAfter = await post('/auth/login', {
    firmSlug,
    email,
    password,
  })
  console.log('login after verify:', loginAfter.status, JSON.stringify(loginAfter.json))

  const dupReg = await post('/auth/register', {
    firmName,
    contactName: 'E2E Owner',
    email,
    password,
    confirmPassword: password,
    phone: '+923001234567',
    city: 'Lahore',
    firmSize: 'solo',
    acceptTerms: true,
  })
  console.log('duplicate register (verified user):', dupReg.status, JSON.stringify(dupReg.json))

  const countBefore = (await (await fetch(`${MH}/messages?limit=50`)).json()).total
  const resend = await post('/auth/register/resend', { firmSlug, email: 'wrong@example.com' })
  console.log('resend wrong email:', resend.status, JSON.stringify(resend.json))

  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
