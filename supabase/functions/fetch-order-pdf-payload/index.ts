// @ts-nocheck — Deno runtime
// Vérifie le token HS256 émis par `issue-order-pdf-token` et retourne le
// payload JSON minimal nécessaire à la génération PDF côté navigateur.
// Non bloquante : pas de rendu PDF ici, uniquement lecture DB.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHS256(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secret = Deno.env.get("ORDER_PDF_TOKEN_SECRET");
    if (!secret) return json({ error: "server_misconfigured" }, 500);

    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    if (!token || typeof token !== "string") return json({ error: "token_required" }, 400);

    const claims = await verifyHS256(token, secret);
    if (!claims?.order_id) return json({ error: "invalid_token" }, 401);

    const orderId = claims.order_id as string;
    const scope = claims.scope as "admin" | "vendor";
    const admin = createClient(url, service);

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, order_number, status, subtotal_excl_vat, vat_amount, total_incl_vat, created_at, notes, draft_payload, fulfillment_mode, shipping_address, customer:customers(company_name, email, country_code, vat_number)")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) {
      console.error("fetch-order-pdf-payload order fetch failed", oErr);
      return json({ error: "order_not_found" }, 404);
    }

    let { data: lines } = await admin
      .from("order_lines")
      .select("quantity, unit_price_excl_vat, vat_rate, line_total_excl_vat, manual_label, cnk_code, vendor_id, products(name, cnk_code, gtin)")
      .eq("order_id", orderId);

    // Fallback draft
    let computedHt = Number(order.subtotal_excl_vat) || 0;
    let computedTva = Number(order.vat_amount) || 0;
    let computedTtc = Number(order.total_incl_vat) || 0;

    if ((!lines || lines.length === 0) && Array.isArray((order as any).draft_payload?.lines)) {
      const draftLines = (order as any).draft_payload.lines as any[];
      const productIds = Array.from(new Set(draftLines.map((l) => l.product_id).filter(Boolean)));
      const { data: prods } = productIds.length
        ? await admin.from("products").select("id, name, cnk_code, gtin").in("id", productIds)
        : { data: [] as any[] };
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
      lines = draftLines.map((l: any) => {
        const qty = Number(l.quantity) || 0;
        const unit = Number(l.unit_price_excl_vat) || 0;
        const vatR = Number(l.vat_rate) || 0;
        const ht = qty * unit;
        return {
          quantity: qty,
          unit_price_excl_vat: unit,
          vat_rate: vatR,
          line_total_excl_vat: ht,
          manual_label: l.manual_label || l.offer_label,
          cnk_code: l.cnk_code ?? null,
          vendor_id: l.vendor_id ?? null,
          products: prodMap.get(l.product_id) || null,
        };
      });
      computedHt = lines.reduce((a, l) => a + (l.line_total_excl_vat || 0), 0);
      computedTva = lines.reduce((a, l) => a + ((l.line_total_excl_vat || 0) * (l.vat_rate || 0)) / 100, 0);
      computedTtc = computedHt + computedTva;
    }

    // Filtrage vendeur : ne retourner que ses lignes
    let filteredLines = lines || [];
    if (scope === "vendor") {
      const { data: myVendors } = await admin
        .from("vendors")
        .select("id")
        .eq("auth_user_id", claims.sub);
      const vids = new Set((myVendors ?? []).map((v: any) => v.id));
      filteredLines = filteredLines.filter((l: any) => vids.has(l.vendor_id));
      // Recalcul des totaux dans ce scope
      computedHt = filteredLines.reduce((a, l) => a + (Number(l.line_total_excl_vat) || 0), 0);
      computedTva = filteredLines.reduce(
        (a, l) => a + ((Number(l.line_total_excl_vat) || 0) * (Number(l.vat_rate) || 0)) / 100,
        0,
      );
      computedTtc = computedHt + computedTva;
    }

    return json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        currency: "EUR",
        created_at: order.created_at,
        notes: (order as any).notes ?? (order as any).draft_payload?.customer_notes ?? null,
        fulfillment_mode: (order as any).fulfillment_mode ?? null,
        shipping_address: (order as any).shipping_address ?? null,
        customer: order.customer || null,
      },
      lines: filteredLines,
      totals: { ht: computedHt, tva: computedTva, ttc: computedTtc },
      scope,
    });
  } catch (e) {
    console.error("fetch-order-pdf-payload error", e);
    return json({ error: "internal" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
