// Edge function: submit-investor-inquiry
// Public endpoint (verify_jwt = false). Receives the investor information
// request from the /invest/contact page, validates + rate-limits input, and
// sends two emails: confirmation to the prospect, notification to MediKong.
// No database write.

import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { INVESTOR_NOTIFICATION_EMAIL } from '../_shared/investor-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_PER_HOUR = 5
const ipHits = new Map<string, number[]>()

function rateLimitOk(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - 60 * 60 * 1000
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > windowStart)
  if (hits.length >= RATE_LIMIT_PER_HOUR) {
    ipHits.set(ip, hits)
    return false
  }
  hits.push(now)
  ipHits.set(ip, hits)
  return true
}

const isEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255

const clean = (v: unknown, max: number) =>
  String(v ?? '').trim().slice(0, max)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  if (!rateLimitOk(ip)) {
    return json(
      {
        error: 'rate_limited',
        message: 'Trop de demandes. Réessayez dans une heure.',
      },
      429,
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const firstName = clean(body.firstName, 80)
  const lastName = clean(body.lastName, 80)
  const email = clean(body.email, 255).toLowerCase()
  const phone = clean(body.phone, 40)
  const company = clean(body.company, 160)
  const investorType = clean(body.investorType, 60)
  const amountRange = clean(body.amountRange, 60)
  const message = clean(body.message, 2000)
  const consent = body.consent === true

  const issues: string[] = []
  if (!firstName) issues.push('firstName')
  if (!lastName) issues.push('lastName')
  if (!email || !isEmail(email)) issues.push('email')
  if (!consent) issues.push('consent')

  if (issues.length > 0) {
    return json({ error: 'validation_failed', issues }, 400)
  }

  const submittedAt = new Date().toISOString()
  const idemBase = `investor-inquiry-${email}-${submittedAt}`

  try {
    await sendTemplateEmail('investor-inquiry-admin', INVESTOR_NOTIFICATION_EMAIL, {
      templateData: {
        firstName,
        lastName,
        email,
        phone,
        company,
        investorType,
        amountRange,
        message,
        submittedAt: new Date(submittedAt).toLocaleString('fr-BE', {
          timeZone: 'Europe/Brussels',
        }),
      },
      idempotencyKey: `${idemBase}-admin`,
    })
  } catch (e) {
    console.error('Investor inquiry admin email failed', e)
    return json(
      {
        error: 'email_failed',
        message:
          "L'envoi a échoué. Réessayez ou écrivez-nous directement à " +
          INVESTOR_NOTIFICATION_EMAIL,
      },
      502,
    )
  }

  // Confirmation to the prospect — best effort, never blocks success.
  try {
    await sendTemplateEmail('investor-inquiry-confirmation', email, {
      templateData: { firstName, amountRange, message },
      idempotencyKey: `${idemBase}-confirm`,
    })
  } catch (e) {
    console.error('Investor inquiry confirmation email failed', e)
  }

  return json({
    success: true,
    message: 'Demande envoyée. Nous vous recontactons sous 2 jours ouvrables.',
  })
})
