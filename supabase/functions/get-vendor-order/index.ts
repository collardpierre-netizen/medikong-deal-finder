// Fetch vendor order data using a one-time-shared token (no JWT required).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Returns a short, non-reversible fingerprint of the token for log correlation.
// We hash the full token with SHA-256 and keep only the first 8 hex chars so
// logs never contain the secret itself.
async function tokenFingerprint(token: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex.slice(0, 8);
  } catch {
    return "unhashable";
  }
}

// Masks order_number for logs (keeps the last 4 chars, e.g. "****1234").
function maskOrderNumber(orderNumber: string): string {
  const s = String(orderNumber ?? "");
  if (s.length <= 4) return "****";
  return `****${s.slice(-4)}`;
}

function logEvent(event: string, fields: Record<string, unknown>) {
  // Single-line structured log — no token, no addresses, no PII.
  try {
    console.log(`[get-vendor-order] ${event} ${JSON.stringify(fields)}`);
  } catch {
    console.log(`[get-vendor-order] ${event}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { order_number, token } = await req.json().catch(() => ({}));
    if (!order_number || !token) {
      logEvent("missing_params", { has_order_number: !!order_number, has_token: !!token });
      return json(400, { error: "missing_params" });
    }

    const tokenFp = await tokenFingerprint(String(token));
    const orderMasked = maskOrderNumber(String(order_number));
    logEvent("token_lookup_start", { token_fp: tokenFp, order: orderMasked });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Token + order + vendor
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("vendor_order_tokens")
      .select(`
        sub_order_id, order_id, vendor_id, order_number, expires_at, used_at,
        orders:order_id ( id, order_number, created_at, shipping_address, billing_address, payment_status, status, subtotal_excl_vat, vat_amount, total_incl_vat ),
        vendors:vendor_id ( id, name, slug, commission_rate )
      `)
      .eq("token", token)
      .eq("order_number", order_number)
      .maybeSingle();

    if (tokenErr) {
      logEvent("token_lookup_db_error", { token_fp: tokenFp, order: orderMasked, code: (tokenErr as any).code ?? null });
      return json(500, { error: "server_error", message: tokenErr.message });
    }
    if (!tokenRow) {
      logEvent("token_not_found", { token_fp: tokenFp, order: orderMasked });
      return json(404, {
        error: "token_not_found",
        message: "Ce lien de commande est invalide ou n'existe pas.",
      });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
      logEvent("token_expired", { token_fp: tokenFp, order: orderMasked, expired_at: tokenRow.expires_at });
      return json(410, {
        error: "token_expired",
        message: "Ce lien a expiré. Demandez un nouveau lien d'accès à la commande.",
        expired_at: tokenRow.expires_at,
      });
    }

    if (tokenRow.used_at) {
      logEvent("token_used", { token_fp: tokenFp, order: orderMasked, used_at: tokenRow.used_at });
      return json(410, {
        error: "token_used",
        message: "Ce lien a déjà été utilisé. Pour des raisons de sécurité, chaque lien n'est valable qu'une seule fois.",
        used_at: tokenRow.used_at,
      });
    }

    const order = (tokenRow as any).orders;
    const vendor = (tokenRow as any).vendors;
    if (!order || !vendor) {
      logEvent("order_or_vendor_missing", {
        token_fp: tokenFp,
        order: orderMasked,
        has_order: !!order,
        has_vendor: !!vendor,
      });
      return json(404, {
        error: "order_not_found",
        message: "La commande associée à ce lien est introuvable.",
      });
    }

    if (String(order.payment_status) !== "paid") {
      logEvent("order_not_paid", { token_fp: tokenFp, order: orderMasked, payment_status: String(order.payment_status) });
      return json(409, { error: "order_not_paid" });
    }

    logEvent("token_valid", { token_fp: tokenFp, order: orderMasked, vendor_id: vendor.id });

    // 2. Mark token first-used
    if (!tokenRow.used_at) {
      const { error: markErr } = await supabase
        .from("vendor_order_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token)
        .is("used_at", null);
      if (markErr) {
        logEvent("token_mark_used_error", { token_fp: tokenFp, order: orderMasked, code: (markErr as any).code ?? null });
      } else {
        logEvent("token_marked_used", { token_fp: tokenFp, order: orderMasked });
      }
    }

    // 3. Mark sub_order first viewed
    if (tokenRow.sub_order_id) {
      await supabase
        .from("sub_orders")
        .update({ vendor_first_viewed_at: new Date().toISOString() })
        .eq("id", tokenRow.sub_order_id)
        .is("vendor_first_viewed_at", null);
    }

    // 4. Vendor order lines
    const { data: lines, error: linesErr } = await supabase
      .from("order_lines")
      .select(`
        id, quantity, unit_price_excl_vat, unit_price_incl_vat,
        line_total_excl_vat, line_total_incl_vat,
        fulfillment_status, tracking_number, tracking_url,
        products:product_id ( name, gtin, sku, image_urls )
      `)
      .eq("order_id", tokenRow.order_id)
      .eq("vendor_id", tokenRow.vendor_id);

    if (linesErr) {
      logEvent("order_lines_error", { token_fp: tokenFp, order: orderMasked });
      return json(500, { error: linesErr.message });
    }
    logEvent("order_lines_loaded", { token_fp: tokenFp, order: orderMasked, line_count: (lines || []).length });

    const normalizedLines = (lines || []).map((l: any) => ({
      id: l.id,
      quantity: Number(l.quantity || 0),
      unit_price_excl_vat: Number(l.unit_price_excl_vat || 0),
      unit_price_incl_vat: Number(l.unit_price_incl_vat || 0),
      line_total_excl_vat: Number(l.line_total_excl_vat || 0),
      line_total_incl_vat: Number(l.line_total_incl_vat || 0),
      fulfillment_status: String(l.fulfillment_status || "pending"),
      tracking_number: l.tracking_number,
      tracking_url: l.tracking_url,
      product_name: l.products?.name ?? "",
      gtin: l.products?.gtin ?? null,
      sku: l.products?.sku ?? null,
      image_url: Array.isArray(l.products?.image_urls) ? l.products.image_urls[0] ?? null : null,
    })).sort((a, b) => a.product_name.localeCompare(b.product_name));

    // 5. Totals
    const subtotal_excl_vat = normalizedLines.reduce((s, l) => s + l.line_total_excl_vat, 0);
    const subtotal_incl_vat = normalizedLines.reduce((s, l) => s + l.line_total_incl_vat, 0);
    const commission_rate = Number(vendor.commission_rate || 0);
    const commission_amount = +(subtotal_excl_vat * (commission_rate / 100)).toFixed(2);
    const vendor_net_excl_vat = +(subtotal_excl_vat - commission_amount).toFixed(2);

    return json(200, {
      order_number: order.order_number,
      order_date: order.created_at,
      order_status: String(order.status),
      payment_status: String(order.payment_status),
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      commission_rate,
      shipping_address: order.shipping_address,
      billing_address: order.billing_address,
      totals: {
        subtotal_excl_vat: +subtotal_excl_vat.toFixed(2),
        subtotal_incl_vat: +subtotal_incl_vat.toFixed(2),
        commission_amount,
        vendor_net_excl_vat,
      },
      lines: normalizedLines,
      sub_order_id: tokenRow.sub_order_id,
    });
  } catch (e) {
    return json(500, { error: String((e as Error).message ?? e) });
  }
});
