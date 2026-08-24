// supabase/functions/send-peppol-id-reminders/index.ts
// Cron: détecte les vendeurs belges (country_code='BE') dont peppol_id est null
// depuis plus de 7 jours (basé sur validated_at ou created_at) et envoie un
// rappel email idempotent par jour: `peppol-id-reminder-{vendor}-{YYYY-MM-DD}`.
//
// Auth: cron secret, service role, or admin JWT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { requireCronOrService } from '../_shared/cron-or-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const SITE_URL = 'https://medikong.pro'
const VENDOR_SETTINGS_URL = `${SITE_URL}/vendor/settings`
const MIN_DAYS = 7

interface VendorRow {
  id: string
  company_name: string | null
  email: string | null
  contact_name: string | null
  validated_at: string | null
  created_at: string
  country_code: string | null
  peppol_id: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const guard = await requireCronOrService(req, { allowAdmin: true })
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().slice(0, 10)
  const summary = {
    scanned: 0,
    skipped_no_email: 0,
    skipped_too_early: 0,
    sent: 0,
    errors: [] as string[],
  }

  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('id, company_name, email, contact_name, validated_at, created_at, country_code, peppol_id')
      .eq('country_code', 'BE')
      .is('peppol_id', null)
      .returns<VendorRow[]>()

    if (error) throw error
    summary.scanned = vendors?.length ?? 0

    for (const v of vendors ?? []) {
      if (!v.email) {
        summary.skipped_no_email++
        continue
      }
      const reference = v.validated_at ?? v.created_at
      const daysSince = Math.floor((Date.now() - new Date(reference).getTime()) / 86_400_000)
      if (daysSince < MIN_DAYS) {
        summary.skipped_too_early++
        continue
      }

      const idempotencyKey = `peppol-id-reminder-${v.id}-${today}`
      const { error: invokeError } = await supabase.functions.invoke('send-app-email', {
        body: {
          templateName: 'vendor-peppol-id-reminder',
          recipientEmail: v.email,
          idempotencyKey,
          templateData: {
            vendorCompanyName: v.company_name ?? '',
            contactName: v.contact_name ?? '',
            vendorSettingsUrl: VENDOR_SETTINGS_URL,
            peppolExample: '0208:BE0404014205',
          },
        },
      })
      if (invokeError) {
        summary.errors.push(`vendor=${v.id}: ${invokeError.message}`)
      } else {
        summary.sent++
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('send-peppol-id-reminders fatal:', message)
    return new Response(JSON.stringify({ ok: false, error: message, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
