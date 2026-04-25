// Edge function: import-external-offers
// Endpoint API pour qu'un partenaire externe (concurrent référencé) pousse ses offres
// Auth: header `X-API-Key: ext_xxxxxxxxxxxx` (clé générée dans /admin/external-vendors)
// Body: { offers: [{ gtin, unit_price, mov?, product_url?, stock_status?, delivery_days?, notes? }, ...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Hash a key with SHA-256 → hex
async function hashKey(key: string): Promise<string> {
  const buf = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ALLOWED_STOCK = new Set([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "on_request",
  "unknown",
]);

interface OfferInput {
  gtin?: string;
  unit_price?: number | string;
  mov?: number | string;
  product_url?: string;
  stock_status?: string;
  delivery_days?: number | string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // 1) Extract API key
  const apiKey = req.headers.get("x-api-key") || "";
  if (!apiKey || !apiKey.startsWith("ext_") || apiKey.length < 20) {
    return json(401, { error: "Missing or invalid X-API-Key header" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // 2) Validate key
  const keyHash = await hashKey(apiKey);
  const { data: keyRow, error: keyErr } = await supabase
    .from("external_vendor_api_keys")
    .select("id, external_vendor_id, is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (keyErr) return json(500, { error: "Auth lookup failed" });
  if (!keyRow) return json(401, { error: "Invalid API key" });

  // Touch last_used_at (best-effort)
  supabase
    .from("external_vendor_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  // 3) Parse body
  let body: { offers?: OfferInput[] };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const offers = Array.isArray(body.offers) ? body.offers : null;
  if (!offers || offers.length === 0) {
    return json(400, { error: "Body must contain a non-empty 'offers' array" });
  }
  if (offers.length > 5000) {
    return json(400, { error: "Max 5000 offers per call" });
  }

  // 4) Normalize + validate
  const errors: { index: number; reason: string }[] = [];
  const normalized: {
    gtin: string;
    unit_price: number;
    mov: number;
    product_url: string;
    stock_status: string;
    delivery_days: number | null;
    notes: string | null;
  }[] = [];

  offers.forEach((o, i) => {
    const gtin = String(o.gtin ?? "").trim();
    if (!gtin || !/^\d{8,14}$/.test(gtin)) {
      errors.push({ index: i, reason: "Invalid or missing gtin (8-14 digits)" });
      return;
    }
    const price = Number(o.unit_price);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      errors.push({ index: i, reason: "Invalid unit_price" });
      return;
    }
    const mov = o.mov == null ? 0 : Number(o.mov);
    if (!Number.isFinite(mov) || mov < 0) {
      errors.push({ index: i, reason: "Invalid mov" });
      return;
    }
    const stock = String(o.stock_status ?? "unknown").toLowerCase();
    if (!ALLOWED_STOCK.has(stock)) {
      errors.push({ index: i, reason: `Invalid stock_status (allowed: ${[...ALLOWED_STOCK].join(", ")})` });
      return;
    }
    const days = o.delivery_days == null || o.delivery_days === ""
      ? null
      : Number(o.delivery_days);
    if (days !== null && (!Number.isFinite(days) || days < 0 || days > 365)) {
      errors.push({ index: i, reason: "Invalid delivery_days" });
      return;
    }
    const url = String(o.product_url ?? "").trim().slice(0, 2048);
    const notes = o.notes ? String(o.notes).slice(0, 500) : null;

    normalized.push({
      gtin,
      unit_price: price,
      mov,
      product_url: url,
      stock_status: stock,
      delivery_days: days,
      notes,
    });
  });

  // 5) Match GTINs against products
  const gtins = [...new Set(normalized.map((n) => n.gtin))];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, gtin")
    .in("gtin", gtins);

  if (prodErr) return json(500, { error: "Product lookup failed" });

  const gtinToProductId = new Map<string, string>();
  (products || []).forEach((p) => {
    if (p.gtin) gtinToProductId.set(p.gtin, p.id);
  });

  const matched: typeof normalized = [];
  const unmatchedGtins: string[] = [];
  normalized.forEach((n) => {
    if (gtinToProductId.has(n.gtin)) matched.push(n);
    else unmatchedGtins.push(n.gtin);
  });

  // 6) Upsert offers (one per gtin)
  let upserted = 0;
  if (matched.length > 0) {
    const payloads = matched.map((m) => ({
      external_vendor_id: keyRow.external_vendor_id,
      product_id: gtinToProductId.get(m.gtin)!,
      unit_price: m.unit_price,
      mov_amount: m.mov,
      product_url: m.product_url,
      stock_status: m.stock_status,
      delivery_days: m.delivery_days,
      notes: m.notes,
      currency: "EUR",
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error: upErr, count } = await supabase
      .from("external_offers")
      .upsert(payloads, {
        onConflict: "external_vendor_id,product_id",
        count: "exact",
      });

    if (upErr) {
      return json(500, { error: "Upsert failed", details: upErr.message });
    }
    upserted = count ?? matched.length;
  }

  // 7) Log
  await supabase.from("external_offers_import_logs").insert({
    external_vendor_id: keyRow.external_vendor_id,
    api_key_id: keyRow.id,
    rows_received: offers.length,
    rows_matched: matched.length,
    rows_unmatched: unmatchedGtins.length,
    rows_upserted: upserted,
    rows_failed: errors.length,
    unmatched_gtins: unmatchedGtins.slice(0, 200),
    errors: errors.slice(0, 100),
    source: "api",
  });

  return json(200, {
    success: true,
    received: offers.length,
    matched: matched.length,
    upserted,
    unmatched: unmatchedGtins.length,
    failed: errors.length,
    unmatched_gtins_sample: unmatchedGtins.slice(0, 20),
    errors_sample: errors.slice(0, 20),
  });
});
