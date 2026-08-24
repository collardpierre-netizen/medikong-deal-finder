// Edge function: notifie l'acheteur d'un changement de statut sur une ligne de commande.
// Appelé depuis la page vendeur après un changement de statut réussi.
// Récupère l'email client côté serveur (les RLS empêchent le vendeur de le lire côté client).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EventName = 'accepted' | 'shipped' | 'delivered'

const TEMPLATE_MAP: Record<EventName, string> = {
  accepted: 'order-line-accepted',
  shipped: 'order-line-shipped',
  delivered: 'order-line-delivered',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  console.log('[notify-order-status] request received')

  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer) {
    console.warn('[notify-order-status] missing bearer')
    return json({ error: 'Unauthorized', reason: 'missing_bearer' }, 401)
  }

  // Validate user
  const authClient = createClient(supabaseUrl, anonKey)
  const { data: claims, error: claimsErr } = await authClient.auth.getClaims(bearer)
  if (claimsErr || !claims?.claims?.sub) {
    console.warn('[notify-order-status] invalid claims', claimsErr?.message)
    return json({ error: 'Unauthorized', reason: 'invalid_claims' }, 401)
  }
  const userId = claims.claims.sub as string

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const lineId = String(body.lineId ?? '')
  const event = String(body.event ?? '') as EventName
  console.log('[notify-order-status] payload', { userId, lineId, event })
  if (!lineId || !TEMPLATE_MAP[event]) {
    return json({ error: 'lineId and valid event required' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Fetch line + order + customer + vendor
  const { data: line, error: lineErr } = await admin
    .from('order_lines')
    .select('id, order_id, vendor_id, quantity, quantity_shipped, tracking_number, tracking_url, product_id, fulfillment_status, updated_at')
    .eq('id', lineId)
    .maybeSingle()
  if (lineErr || !line) {
    console.warn('[notify-order-status] line not found', lineId, lineErr?.message)
    return json({ error: 'Line not found', reason: 'line_missing' }, 404)
  }

  // Authorize: user must be owner of vendor OR member of vendor account
  const { data: vendor } = await admin
    .from('vendors')
    .select('id, auth_user_id, display_code, name')
    .eq('id', line.vendor_id)
    .maybeSingle()
  if (!vendor) {
    console.warn('[notify-order-status] vendor not found', line.vendor_id)
    return json({ error: 'Vendor not found', reason: 'vendor_missing' }, 404)
  }

  let authorized = vendor.auth_user_id === userId
  if (!authorized) {
    const { data: memberships } = await admin
      .from('account_memberships')
      .select('account_id')
      .eq('user_id', userId)
      .eq('account_kind', 'vendor')
      .eq('status', 'active')
    authorized = !!memberships?.some((m: any) => m.account_id === line.vendor_id)
  }
  // Admins also allowed
  if (!authorized) {
    const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userId })
    if (isAdmin === true) authorized = true
  }
  if (!authorized) {
    console.warn('[notify-order-status] forbidden', { userId, vendorId: line.vendor_id, vendorOwner: vendor.auth_user_id })
    return json({ error: 'Forbidden', reason: 'not_vendor_owner_or_member' }, 403)
  }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, order_number, customer_id, total_incl_vat')
    .eq('id', line.order_id)
    .maybeSingle()
  if (orderErr) {
    console.error('[notify-order-status] order lookup failed', orderErr)
    return json({ error: 'Order lookup failed', reason: 'order_lookup_failed', detail: orderErr.message }, 500)
  }
  if (!order) return json({ error: 'Order not found', reason: 'order_missing' }, 404)

  const { data: customer } = await admin
    .from('customers')
    .select('email')
    .eq('id', order.customer_id)
    .maybeSingle()
  const recipientEmail = customer?.email
  if (!recipientEmail) return json({ error: 'Customer email missing' }, 422)

  // Vendor lines for this order
  const { data: vLines } = await admin
    .from('order_lines')
    .select('product_id, quantity, unit_price_incl_vat, line_total_incl_vat')
    .eq('order_id', order.id)
    .eq('vendor_id', line.vendor_id)

  const productIds = [...new Set((vLines ?? []).map((l: any) => l.product_id))]
  let productMap = new Map<string, string>()
  if (productIds.length) {
    const { data: prods } = await admin.from('products').select('id, name').in('id', productIds)
    productMap = new Map((prods ?? []).map((p: any) => [p.id, p.name]))
  }
  const lines = (vLines ?? []).map((l: any) => ({
    name: productMap.get(l.product_id) || 'Produit',
    quantity: l.quantity,
    unitPriceTtc: Number(l.unit_price_incl_vat),
    lineTotalTtc: Number(l.line_total_incl_vat),
  }))
  const productName = productMap.get(line.product_id) || 'un produit'
  const totalIncl = (order as any).total_incl_vat ?? lines.reduce((s, l) => s + (l.lineTotalTtc || 0), 0)
  const currency = 'EUR'

  const vendorLabel = vendor.display_code
    ? `Fournisseur ${vendor.display_code}`
    : (vendor.name || 'Le fournisseur')

  const appOrigin = String(body.appOrigin || 'https://medikong.pro').replace(/\/+$/, '')
  const orderUrl = `${appOrigin}/commande/${order.id}`

  const templateData: Record<string, any> = {
    orderNumber: order.order_number,
    vendorLabel,
    productName,
    quantity: line.quantity,
    orderUrl,
    lines,
    totalIncl,
    currency,
  }
  if (event === 'shipped') {
    templateData.quantityShipped = line.quantity_shipped ?? line.quantity
    templateData.quantityOrdered = line.quantity
    templateData.trackingNumber = body.trackingNumber ?? line.tracking_number ?? null
    templateData.trackingUrl = body.trackingUrl ?? line.tracking_url ?? null
    templateData.carrierName = body.carrierName ?? null
    templateData.isPartial = !!body.isPartial
  }

  // Idempotency key includes updated_at so a revert + re-trigger sends a fresh email,
  // while a true duplicate call (double-click, retry) collapses into one.
  const updatedAtStamp = line.updated_at ? new Date(line.updated_at).getTime() : Date.now()
  const idemSuffix = event === 'shipped' ? `-${line.quantity_shipped ?? 0}` : ''
  const idempotencyKey = `order-line-${event}-${line.id}${idemSuffix}-${updatedAtStamp}`

  console.log('[notify-order-status] invoking send-app-email', {
    templateName: TEMPLATE_MAP[event],
    recipientEmail,
    idempotencyKey,
  })

  const { data: sendData, error: sendErr } = await admin.functions.invoke('send-app-email', {
    body: {
      templateName: TEMPLATE_MAP[event],
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
    console.error('[notify-order-status] send-app-email error', detail, sendData)
    return json({ error: 'email_invoke_failed', detail }, 502)
  }
  console.log('[notify-order-status] send-app-email ok', sendData)

  return json({ success: true, queued: true, recipient: recipientEmail })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
