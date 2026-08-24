// Edge function: notifie l'acheteur qu'une commande a été expédiée (niveau commande),
// avec URL de tracking externe optionnelle. Admin uniquement.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer) return json({ error: 'Unauthorized' }, 401)

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(bearer)
  if (claimsErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401)
  const userId = claims.claims.sub as string

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userId })
  if (isAdmin !== true) return json({ error: 'Forbidden' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const orderId = String(body.orderId ?? '')
  if (!orderId) return json({ error: 'orderId required' }, 400)

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, order_number, customer_id, tracking_url, tracking_carrier, tracking_number, updated_at')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr || !order) return json({ error: 'Order not found' }, 404)

  const { data: customer } = await admin
    .from('customers')
    .select('email, company_name')
    .eq('id', order.customer_id)
    .maybeSingle()
  const recipientEmail = customer?.email
  if (!recipientEmail) return json({ error: 'Customer email missing' }, 422)

  const appOrigin = String(body.appOrigin || 'https://medikong.pro').replace(/\/+$/, '')
  const orderUrl = `${appOrigin}/commande/${order.id}`

  const templateData = {
    orderNumber: order.order_number,
    customerName: customer?.company_name || undefined,
    trackingUrl: order.tracking_url ?? undefined,
    trackingCarrier: order.tracking_carrier ?? undefined,
    trackingNumber: order.tracking_number ?? undefined,
    orderUrl,
  }

  const stamp = order.updated_at ? new Date(order.updated_at).getTime() : Date.now()
  const idempotencyKey = `order-shipped-${order.id}-${stamp}`

  // Recherche des envois déjà loggés pour cette clé d'idempotence (dedup par message_id)
  const { data: existingLogs } = await admin
    .from('email_send_log')
    .select('id, status, created_at, error_message')
    .eq('message_id', idempotencyKey)
    .order('created_at', { ascending: false })
  const alreadySent = (existingLogs ?? []).some((r: any) =>
    ['sent', 'pending'].includes(String(r.status))
  )

  // Mode test : ne rien envoyer, retourner ce qui serait fait + traces existantes
  const dryRun = body?.dryRun === true
  if (dryRun) {
    return json({
      success: true,
      dryRun: true,
      idempotencyKey,
      recipient: recipientEmail,
      templateName: 'order-shipped',
      templateData,
      alreadySent,
      wouldSend: !alreadySent,
      existingLogs: existingLogs ?? [],
      note: alreadySent
        ? "Un envoi existe déjà pour cette clé — un vrai appel ne créerait PAS un doublon (idempotency)."
        : "Aucun envoi existant — un vrai appel enverrait exactement 1 email.",
    })
  }

  const { data: sendData, error: sendErr } = await admin.functions.invoke('send-app-email', {
    body: {
      templateName: 'order-shipped',
      recipientEmail,
      idempotencyKey,
      templateData,
    },
  })
  if (sendErr) {
    let detail: any = sendErr?.message || String(sendErr)
    try {
      const ctx: any = (sendErr as any).context
      if (ctx?.response) {
        const txt = await ctx.response.clone().text()
        detail = `${detail} | body=${txt.slice(0, 600)}`
      }
    } catch {}
    return json({ error: 'email_invoke_failed', detail }, 502)
  }

  // Post-check : relire les logs pour confirmer un seul envoi actif
  const { data: postLogs } = await admin
    .from('email_send_log')
    .select('id, status, created_at')
    .eq('message_id', idempotencyKey)
    .order('created_at', { ascending: false })

  return json({
    success: true,
    queued: true,
    recipient: recipientEmail,
    idempotencyKey,
    alreadySentBefore: alreadySent,
    logsAfter: postLogs ?? [],
    sendData,
  })
})
