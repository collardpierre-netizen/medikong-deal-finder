import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import {
  isContractTemplate,
  validateContractTemplateData,
} from '../_shared/contract-validation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Auth: verify_jwt = false in config.toml. The function authenticates
// callers via the Authorization header — service-role key (internal Edge
// Functions) or an active admin JWT. Public callers cannot trigger
// MediKong-branded emails.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Require caller authentication to prevent abuse:
  // - A valid user JWT (from the app/client), OR
  // - The service-role key (from internal Edge Functions calling via supabase.functions.invoke).
  // Public/unauthenticated callers cannot trigger MediKong-branded emails.
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (bearer !== supabaseServiceKey) {
    // Non-service-role callers must be an active admin.
    // End-user-triggered emails MUST go through dedicated wrapper edge
    // functions/RPCs that hard-code the template and recipient — never
    // through this generic endpoint directly.
    try {
      const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? supabaseServiceKey)
      const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(bearer)
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
      const { data: adminRow } = await adminClient
        .from('admin_users')
        .select('role, is_active')
        .eq('user_id', claimsData.claims.sub)
        .maybeSingle()
      if (!adminRow?.is_active || !['super_admin', 'admin'].includes(adminRow.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden: admin or service role required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Validation côté serveur des templates contractuels : refuser tout envoi
  // si les coordonnées MediKong/vendeur sont manquantes ou contiennent un
  // placeholder. Cela protège la valeur juridique du mandat de facturation.
  if (isContractTemplate(templateName)) {
    const validation = validateContractTemplateData(templateData ?? {})
    if (!validation.valid) {
      console.error('Contract template data invalid — refusing to send', {
        templateName,
        issues: validation.issues,
      })
      return new Response(
        JSON.stringify({
          error: 'contract_data_invalid',
          message:
            'Coordonnées contractuelles incomplètes ou contenant un placeholder. Envoi bloqué.',
          issues: validation.issues,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 2. Admin override (admin → Email templates). If enabled, replace subject
  // and/or HTML body. Supports {{key}} placeholders interpolated against templateData,
  // and {{linesHtml}} as a convenience for rendering the lines array as a <ul>.
  let subjectOverride: string | undefined
  let htmlOverride: string | undefined
  try {
    const { data: override } = await supabase
      .from('email_template_overrides')
      .select('enabled, custom_subject, custom_body_html')
      .eq('template_name', templateName)
      .maybeSingle()
    if (override?.enabled) {
      const escape = (s: string) =>
        s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!))
      const linesArr: any[] = Array.isArray((templateData as any).lines) ? (templateData as any).lines : []
      const linesHtml = linesArr.length
        ? `<ul style="padding-left:18px;margin:8px 0">${linesArr.map((l) =>
            `<li>${escape(String(l.quantity ?? ''))}× ${escape(String(l.name ?? ''))}${
              typeof l.lineTotalTtc === 'number' ? ` — ${l.lineTotalTtc.toFixed(2)} ${escape(String((templateData as any).currency ?? 'EUR'))}` : ''
            }</li>`).join('')}</ul>`
        : ''
      const interp = (tpl: string) =>
        tpl
          .replace(/\{\{\s*linesHtml\s*\}\}/g, linesHtml)
          .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
            const v = (templateData as any)[k]
            if (v === undefined || v === null) return ''
            if (typeof v === 'object') return ''
            return escape(String(v))
          })
      if (override.custom_subject && override.custom_subject.trim()) {
        subjectOverride = interp(override.custom_subject)
      }
      if (override.custom_body_html && override.custom_body_html.trim()) {
        htmlOverride = interp(override.custom_body_html)
      }
    }
  } catch (overrideErr) {
    console.warn('email override lookup failed (using default template)', overrideErr)
  }

  // 3. Send synchronously through the managed email API. Delivery, retries,
  // suppression, and unsubscribe are Lovable's responsibility; a suppressed
  // recipient resolves { sent: false, reason: 'recipient_suppressed' }.
  try {
    const result = await sendTemplateEmail(templateName, effectiveRecipient, {
      templateData,
      idempotencyKey,
      subjectOverride,
      htmlOverride,
    })

    if (!result.sent) {
      // Suppression is enforced server-side by the managed delivery; keep a
      // local audit row for the kept email_send_log table.
      const { error: logError } = await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'suppressed',
      })
      if (logError) {
        console.error('Failed to log suppressed email', { code: logError.code, message: logError.message })
      }

      console.log('Email suppressed', { templateName })
      return new Response(
        JSON.stringify({ success: false, reason: 'email_suppressed' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { error: logError } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'sent',
    })
    if (logError) {
      console.error('Failed to log sent email', { code: logError.code, message: logError.message })
    }

    console.log('App email sent', { templateName })

    return new Response(
      JSON.stringify({ success: true, sent: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Failed to send app email', { templateName, error: errorMessage })

    const { error: logError } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: errorMessage.slice(0, 1000),
    })
    if (logError) {
      console.error('Failed to log failed email', { code: logError.code, message: logError.message })
    }

    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
