// supabase/functions/send-contract-reminders/index.ts
// Cron job: détecte les vendeurs validés qui n'ont pas signé la convention
// de mandat de facturation et envoie des relances graduées (J+3, J+7, J+14).
// Idempotent par jour grâce à idempotencyKey = `contract-reminder-{vendor}-L{N}-{YYYY-MM-DD}`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { requireCronOrService } from '../_shared/cron-or-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://medikong.pro'
const CONTRACT_URL = `${SITE_URL}/vendor/contract`
const VENDOR_SETTINGS_URL = `${SITE_URL}/vendor/settings`
const BUYER_ACTIVATION_URL = `${SITE_URL}/compte/activer-acheteur`

interface VendorRow {
  id: string
  company_name: string | null
  email: string | null
  contact_name: string | null
  validated_at: string | null
  created_at: string
  validation_status: string | null
  commissionnaire_agreement_accepted_at: string | null
}

interface ReminderPlan {
  level: 1 | 2 | 3
  minDays: number
  maxDays: number
}

const PLANS: ReminderPlan[] = [
  { level: 1, minDays: 3, maxDays: 6 }, // J+3
  { level: 2, minDays: 7, maxDays: 13 }, // J+7
  { level: 3, minDays: 14, maxDays: 365 }, // J+14 (et au-delà, max 1x/jour)
]

function pickLevel(daysSince: number): ReminderPlan | null {
  return PLANS.slice().reverse().find((p) => daysSince >= p.minDays) ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const guard = await requireCronOrService(req, { allowAdmin: true })
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), {
      status: guard.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const summary = {
    scanned: 0,
    skipped_no_email: 0,
    skipped_already_signed: 0,
    skipped_not_approved: 0,
    skipped_too_early: 0,
    sent: { level1: 0, level2: 0, level3: 0 },
    errors: [] as string[],
  }

  try {
    // Vendeurs strictement APPROUVÉS et n'ayant pas encore accepté le mandat
    // commissionnaire. Exclut explicitement pending/rejected/suspended.
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('id, company_name, email, contact_name, validated_at, created_at, validation_status, commissionnaire_agreement_accepted_at')
      .eq('is_active', true)
      .eq('validation_status', 'approved')
      .is('commissionnaire_agreement_accepted_at', null)
      .returns<VendorRow[]>()

    if (error) throw error

    summary.scanned = vendors?.length ?? 0

    // Récupère les IDs déjà signés en une requête
    const vendorIds = (vendors ?? []).map((v) => v.id)
    const { data: signed } = await supabase
      .from('seller_contracts')
      .select('vendor_id')
      .eq('contract_type', 'mandat_facturation')
      .in('vendor_id', vendorIds.length ? vendorIds : ['00000000-0000-0000-0000-000000000000'])

    const signedSet = new Set((signed ?? []).map((r: any) => r.vendor_id))

    for (const v of vendors ?? []) {
      // Double garde : statut strictement approved et mandat non accepté
      if (v.validation_status !== 'approved' || v.commissionnaire_agreement_accepted_at !== null) {
        summary.skipped_not_approved++
        continue
      }
      if (signedSet.has(v.id)) {
        summary.skipped_already_signed++
        continue
      }
      if (!v.email) {
        summary.skipped_no_email++
        continue
      }

      const reference = v.validated_at ?? v.created_at
      const daysSince = Math.floor(
        (Date.now() - new Date(reference).getTime()) / 86_400_000,
      )
      const plan = pickLevel(daysSince)
      if (!plan) {
        summary.skipped_too_early++
        continue
      }

      const idempotencyKey = `contract-reminder-${v.id}-L${plan.level}-${today}`

      const { error: invokeError } = await supabase.functions.invoke(
        'send-app-email',
        {
          body: {
            templateName: 'vendor-contract-reminder',
            recipientEmail: v.email,
            idempotencyKey,
            templateData: {
              vendorCompanyName: v.company_name ?? '',
              signerName: v.contact_name ?? '',
              daysSinceInvitation: daysSince,
              reminderLevel: plan.level,
              contractVersion: 'v1.0',
              contractUrl: CONTRACT_URL,
              vendorSettingsUrl: VENDOR_SETTINGS_URL,
              buyerActivationUrl: BUYER_ACTIVATION_URL,
            },
          },
        },
      )

      if (invokeError) {
        summary.errors.push(`vendor=${v.id} L${plan.level}: ${invokeError.message}`)
      } else {
        summary.sent[`level${plan.level}` as 'level1' | 'level2' | 'level3']++
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('send-contract-reminders fatal:', message)
    return new Response(
      JSON.stringify({ ok: false, error: message, summary }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
