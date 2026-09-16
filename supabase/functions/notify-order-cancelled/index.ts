// Edge function: notifie l'acheteur qu'une commande a été annulée (action admin).
// Récupère l'email client côté serveur, envoi idempotent via send-app-email.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer) return json({ error: 'Non autorisé', reason: 'missing_bearer' }, 401)

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(bearer)
  if (claimsErr || !claims?.claims?.sub) {
    return json({ error: 'Non autorisé', reason: 'invalid_claims' }, 401)
  }
  const userId = claims.claims.sub as string

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userId })
  if (isAdmin !== true) return json({ error: 'Interdit', reason: 'not_admin' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'JSON invalide' }, 400) }
  const orderId = String(body.order_id ?? '')
  const reason = body.reason ? String(body.reason).slice(0, 300) : undefined
  if (!orderId) return json({ error: 'order_id requis' }, 400)

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, order_number, status, payment_status, total_incl_vat, is_test, customer:customers!orders_customer_id_fkey(email, company_name)')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr) return json({ error: 'Lecture commande impossible', detail: orderErr.message }, 500)
  if (!order) return json({ error: 'Commande introuvable' }, 404)
  if (order.status !== 'cancelled') {
    return json({ success: false, skipped: 'not_cancelled', status: order.status })
  }
  if ((order as any).is_test) {
    return json({ success: false, skipped: 'test_order' })
  }

  const customer: any = (order as any).customer
  const recipientEmail = customer?.email
  if (!recipientEmail) return json({ success: false, skipped: 'no_customer_email' }, 200)

  const total = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' })
    .format(Number(order.total_incl_vat || 0))

  const { data: sendData, error: sendErr } = await admin.functions.invoke('send-app-email', {
    body: {
      templateName: 'order-cancelled-customer',
      recipientEmail,
      idempotencyKey: `order-cancelled-${orderId}`,
      templateData: {
        orderNumber: order.order_number,
        customerName: customer?.company_name,
        total,
        cancelledAt: new Date().toLocaleDateString('fr-BE'),
        reason,
        wasPaid: order.payment_status === 'paid',
      },
    },
  })
  if (sendErr) {
    console.error('[notify-order-cancelled] send-app-email error', sendErr, sendData)
    return json({ error: "Échec de l'envoi", detail: String(sendErr.message ?? sendErr) }, 502)
  }

  return json({ success: true, recipient: recipientEmail })
})
