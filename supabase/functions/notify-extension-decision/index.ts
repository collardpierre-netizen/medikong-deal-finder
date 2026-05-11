// Sends a transactional email to a pharmacist after their subscription extension
// request was decided (approved/rejected). Resolves the buyer's auth email server-side
// and invokes send-transactional-email. Admin-only (verified via auth + is_admin RPC).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface Body {
  request_id: string
  decision: 'approved' | 'rejected'
  granted_months?: number | null
  internal_notes?: string | null
  rejection_reason?: string | null
}

const SITE_URL = 'https://medikong.pro'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Auth: caller must be an admin
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const callerId = userData?.user?.id
    if (!callerId) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: isAdmin, error: adminErr } = await admin.rpc('is_admin', { _user_id: callerId })
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as Body
    if (!body?.request_id || !['approved', 'rejected'].includes(body.decision)) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load request + subscription (for new end date) + buyer info
    const { data: reqRow, error: reqErr } = await admin
      .from('subscription_extension_requests')
      .select('id, buyer_id, subscription_id, granted_months, rejection_reason')
      .eq('id', body.request_id)
      .maybeSingle()
    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: 'request_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, company_name')
      .eq('user_id', reqRow.buyer_id)
      .maybeSingle()

    const { data: authUser } = await admin.auth.admin.getUserById(reqRow.buyer_id)
    const recipientEmail = authUser?.user?.email
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'no_recipient_email' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pharmacyName = profile?.company_name || profile?.full_name || undefined
    const ctaUrl = `${SITE_URL}/espace-pharmacie/abonnement`

    let templateName: string
    let templateData: Record<string, unknown>

    if (body.decision === 'approved') {
      // Fetch subscription end dates to compute the new end date
      const { data: sub } = await admin
        .from('v_buyer_subscription_overview')
        .select('current_free_ends_at')
        .eq('subscription_id', reqRow.subscription_id)
        .maybeSingle()
      templateName = 'subscription-extension-approved'
      templateData = {
        pharmacyName,
        grantedMonths: body.granted_months ?? reqRow.granted_months ?? 3,
        newEndDate: sub?.current_free_ends_at ?? null,
        internalNotes: body.internal_notes ?? null,
        ctaUrl,
      }
    } else {
      const { data: sub } = await admin
        .from('v_buyer_subscription_overview')
        .select('current_free_ends_at')
        .eq('subscription_id', reqRow.subscription_id)
        .maybeSingle()
      templateName = 'subscription-extension-rejected'
      templateData = {
        pharmacyName,
        rejectionReason: body.rejection_reason ?? reqRow.rejection_reason ?? null,
        switchDate: sub?.current_free_ends_at ?? null,
        ctaUrl,
      }
    }

    const { data: sendRes, error: sendErr } = await admin.functions.invoke(
      'send-transactional-email',
      {
        body: {
          templateName,
          recipientEmail,
          idempotencyKey: `subscription-extension-${body.decision}-${body.request_id}`,
          templateData,
        },
      },
    )
    if (sendErr) {
      console.error('send-transactional-email failed', sendErr)
      return new Response(JSON.stringify({ error: 'email_send_failed', detail: String(sendErr.message ?? sendErr) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, send: sendRes ?? null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'unexpected', detail: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
