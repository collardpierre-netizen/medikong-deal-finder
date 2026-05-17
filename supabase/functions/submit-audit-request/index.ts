// Edge function: submit-audit-request
// Public endpoint (verify_jwt = false). Receives multipart FormData from the
// /audit-achats landing page, uploads PDFs to the private 'audit-pdfs' bucket,
// inserts a row in audit_requests (service role, bypasses RLS), and enqueues
// two transactional emails (audit-confirmation + audit-new-lead).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_FILES = 5
const MIN_FILES = 1
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = 'application/pdf'
const RATE_LIMIT_PER_HOUR = 3
const INTERNAL_NOTIFICATION_EMAIL = 'pit@medikong.pro'

// In-memory IP throttle (best-effort; per-instance only)
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

function slugify(input: string): string {
  return (input || 'pharmacie')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'pharmacie'
}

function sanitizeFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, '')
  return slugify(base).slice(0, 80) || 'facture'
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit per IP (best-effort)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  if (!rateLimitOk(ip)) {
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        message: 'Trop de demandes. Réessayez dans 1 heure.',
      }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return new Response(
      JSON.stringify({ error: 'invalid_form_data' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const pharmacyName = String(form.get('pharmacy_name') ?? '').trim()
  const firstName = String(form.get('contact_first_name') ?? '').trim()
  const lastName = String(form.get('contact_last_name') ?? '').trim()
  const email = String(form.get('contact_email') ?? '').trim().toLowerCase()
  const consent =
    String(form.get('consent') ?? '').toLowerCase() === 'true' ||
    form.get('consent') === 'on' ||
    form.get('consent') === '1'

  const issues: string[] = []
  if (!pharmacyName) issues.push('pharmacy_name')
  if (!firstName) issues.push('contact_first_name')
  if (!lastName) issues.push('contact_last_name')
  if (!email || !isEmail(email)) issues.push('contact_email')
  if (!consent) issues.push('consent')

  const files = form.getAll('pdfs').filter((f): f is File => f instanceof File)
  if (files.length < MIN_FILES) issues.push('pdfs_min')
  if (files.length > MAX_FILES) issues.push('pdfs_max')
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) issues.push(`file_too_large:${f.name}`)
    if (f.type !== ALLOWED_MIME) issues.push(`file_mime:${f.name}`)
  }

  if (issues.length > 0) {
    return new Response(
      JSON.stringify({ error: 'validation_failed', issues }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Reserve an id up-front so we can use it in the storage path
  const auditId = crypto.randomUUID()
  const pharmacySlug = slugify(pharmacyName)
  const storagePaths: string[] = []

  for (const file of files) {
    const safeName = sanitizeFileName(file.name)
    const ts = Date.now()
    const path = `${pharmacySlug}/${auditId}/${safeName}-${ts}.pdf`
    const buffer = await file.arrayBuffer()
    const { error: upErr } = await supabase.storage
      .from('audit-pdfs')
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })
    if (upErr) {
      console.error('Upload failed', { path, error: upErr })
      return new Response(
        JSON.stringify({
          error: 'upload_failed',
          message: 'Échec de l\'upload d\'un fichier. Réessayez.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
    storagePaths.push(path)
  }

  const insertPayload = {
    id: auditId,
    pharmacy_name: pharmacyName,
    pharmacy_apb_number: String(form.get('pharmacy_apb_number') ?? '').trim() || null,
    pharmacy_address: String(form.get('pharmacy_address') ?? '').trim() || null,
    pharmacy_city: String(form.get('pharmacy_city') ?? '').trim() || null,
    pharmacy_postal_code: String(form.get('pharmacy_postal_code') ?? '').trim() || null,
    pharmacy_country: String(form.get('pharmacy_country') ?? 'BE').trim() || 'BE',
    contact_first_name: firstName,
    contact_last_name: lastName,
    contact_email: email,
    contact_phone: String(form.get('contact_phone') ?? '').trim() || null,
    additional_notes: String(form.get('additional_notes') ?? '').trim() || null,
    pdf_storage_paths: storagePaths,
    status: 'pending',
    consented_at: new Date().toISOString(),
    consent_text_version: 'v1-2026-05',
  }

  const { error: insertErr } = await supabase
    .from('audit_requests')
    .insert(insertPayload)

  if (insertErr) {
    console.error('Insert audit_requests failed', insertErr)
    // best-effort cleanup of uploaded files
    if (storagePaths.length > 0) {
      await supabase.storage.from('audit-pdfs').remove(storagePaths)
    }
    return new Response(
      JSON.stringify({ error: 'db_insert_failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  // Generate signed URLs (24h) for internal notification email
  const signedFiles: { name: string; url: string }[] = []
  for (const p of storagePaths) {
    const { data: signed } = await supabase.storage
      .from('audit-pdfs')
      .createSignedUrl(p, 60 * 60 * 24)
    if (signed?.signedUrl) {
      signedFiles.push({ name: p.split('/').pop() ?? p, url: signed.signedUrl })
    }
  }

  // Enqueue the two transactional emails — best-effort, do not block success
  const invokeEmail = async (
    templateName: string,
    recipientEmail: string,
    templateData: Record<string, unknown>,
    idemSuffix: string,
  ) => {
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName,
          recipientEmail,
          idempotencyKey: `audit-${auditId}-${idemSuffix}`,
          templateData,
        },
      })
    } catch (e) {
      console.error('Email enqueue failed', { templateName, error: e })
    }
  }

  await Promise.all([
    invokeEmail(
      'audit-confirmation',
      email,
      {
        firstName,
        lastName,
        pharmacyName,
        filesCount: storagePaths.length,
      },
      'confirm',
    ),
    invokeEmail(
      'audit-new-lead',
      INTERNAL_NOTIFICATION_EMAIL,
      {
        auditId,
        pharmacyName,
        contactName: `${firstName} ${lastName}`,
        contactEmail: email,
        contactPhone: insertPayload.contact_phone ?? '',
        city: insertPayload.pharmacy_city ?? '',
        country: insertPayload.pharmacy_country,
        filesCount: storagePaths.length,
        files: signedFiles,
        notes: insertPayload.additional_notes ?? '',
      },
      'lead',
    ),
  ])

  return new Response(
    JSON.stringify({
      success: true,
      audit_request_id: auditId,
      message: 'Demande reçue, rapport sous 48h.',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
