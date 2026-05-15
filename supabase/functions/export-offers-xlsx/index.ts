// Edge Function: export-offers-xlsx
// Génère un export XLSX (multi-feuilles si > 100k lignes) de toutes les offres,
// uploade dans le bucket privé `db-backups` sous `exports/offers/...` et
// renvoie une URL signée (1h). Réservé aux admins.
//
// Stratégie mémoire : on collecte les lignes en arrays denses (pas d'objets) et
// on découpe en feuilles de 100k pour rester sous la limite 256 Mo de l'edge.
// SheetJS sérialise en zip compressé à la fin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "db-backups";
const PAGE = 5000;
const ENRICH_BATCH = 500;
const ROWS_PER_SHEET = 100_000;

type Offer = {
  id: string;
  product_id: string | null;
  vendor_id: string | null;
  country_code: string | null;
  price_excl_vat: number | null;
  price_incl_vat: number | null;
  vat_rate: number | null;
  stock_quantity: number | null;
  stock_status: string | null;
  moq: number | null;
  mov: number | null;
  mov_amount: number | null;
  mov_currency: string | null;
  delivery_days: number | null;
  is_active: boolean | null;
  purchase_price: number | null;
  qogita_base_price: number | null;
  applied_margin_percentage: number | null;
  margin_amount: number | null;
  is_qogita_backed: boolean | null;
};

const HEADERS = [
  "offer_id", "gtin", "cnk_code", "product_name", "brand_name", "category_name",
  "vendor", "country", "prix_ht", "prix_ttc", "tva", "prix_achat_ht",
  "prix_base_qogita", "marge_pct", "marge_eur", "stock", "stock_status",
  "moq", "mov", "mov_currency", "delai_jours", "qogita", "actif",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Invalid auth" }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin", {
    _user_id: userId,
  });
  if (adminErr || !isAdmin) return json({ error: "Admin only" }, 403);

  let activeOnly = true;
  try {
    const body = await req.json();
    if (typeof body?.activeOnly === "boolean") activeOnly = body.activeOnly;
  } catch { /* default */ }

  const startedAt = Date.now();
  let totalRows = 0;
  let lastId: string | null = null;
  let pages = 0;

  // Buffers : un tableau par feuille, chaque ligne est un array brut
  const sheets: unknown[][][] = [[HEADERS]];
  let currentSheet = sheets[0];

  const productMap = new Map<string, { gtin?: string; name?: string; cnk_code?: string; brand_name?: string; category_name?: string }>();
  const vendorMap = new Map<string, { company_name?: string; name?: string; display_code?: string }>();

  async function enrichMissing(offers: Offer[]) {
    const missingProducts = [...new Set(offers.map(o => o.product_id).filter((x): x is string => !!x && !productMap.has(x)))];
    for (let i = 0; i < missingProducts.length; i += ENRICH_BATCH) {
      const slice = missingProducts.slice(i, i + ENRICH_BATCH);
      const { data, error } = await admin
        .from("products")
        .select("id, gtin, name, cnk_code, brand_name, category_name")
        .in("id", slice);
      if (error) throw new Error(`products batch: ${error.message}`);
      (data ?? []).forEach((p: any) => productMap.set(p.id, p));
    }
    const missingVendors = [...new Set(offers.map(o => o.vendor_id).filter((x): x is string => !!x && !vendorMap.has(x)))];
    for (let i = 0; i < missingVendors.length; i += ENRICH_BATCH) {
      const slice = missingVendors.slice(i, i + ENRICH_BATCH);
      const { data, error } = await admin
        .from("vendors")
        .select("id, company_name, display_code, name")
        .in("id", slice);
      if (error) throw new Error(`vendors batch: ${error.message}`);
      (data ?? []).forEach((v: any) => vendorMap.set(v.id, v));
    }
  }

  try {
    while (true) {
      let q = admin
        .from("offers")
        .select("id, product_id, vendor_id, country_code, price_excl_vat, price_incl_vat, vat_rate, stock_quantity, stock_status, moq, mov, mov_amount, mov_currency, delivery_days, is_active, purchase_price, qogita_base_price, applied_margin_percentage, margin_amount, is_qogita_backed")
        .order("id", { ascending: true })
        .limit(PAGE);
      if (activeOnly) q = q.eq("is_active", true);
      if (lastId) q = q.gt("id", lastId);
      const { data, error } = await q;
      if (error) throw new Error(`offers page ${pages + 1}: ${error.message}`);
      if (!data || data.length === 0) break;

      const offers = data as Offer[];
      await enrichMissing(offers);

      for (const o of offers) {
        const p = (o.product_id ? productMap.get(o.product_id) : null) ?? {};
        const v = (o.vendor_id ? vendorMap.get(o.vendor_id) : null) ?? {};
        currentSheet.push([
          o.id,
          p.gtin ?? "",
          p.cnk_code ?? "",
          p.name ?? "",
          p.brand_name ?? "",
          p.category_name ?? "",
          v.company_name ?? v.name ?? v.display_code ?? "",
          o.country_code ?? "",
          o.price_excl_vat,
          o.price_incl_vat,
          o.vat_rate,
          o.purchase_price,
          o.qogita_base_price,
          o.applied_margin_percentage,
          o.margin_amount,
          o.stock_quantity,
          o.stock_status ?? "",
          o.moq,
          o.mov_amount ?? o.mov,
          o.mov_currency ?? "",
          o.delivery_days,
          o.is_qogita_backed ? "Oui" : "Non",
          o.is_active ? "Oui" : "Non",
        ]);

        // Rotation de feuille
        if (currentSheet.length - 1 >= ROWS_PER_SHEET) {
          currentSheet = [HEADERS];
          sheets.push(currentSheet);
        }
      }

      totalRows += offers.length;
      lastId = offers[offers.length - 1].id;
      pages += 1;

      if (offers.length < PAGE) break;
    }

    // Construction du workbook
    const wb = XLSX.utils.book_new();
    sheets.forEach((rows, idx) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const name = sheets.length === 1 ? "Offres" : `Offres_${idx + 1}`;
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    const xlsxBytes: Uint8Array = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
      compression: true,
    });

    const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
    const path = `exports/offers/${ts}_${activeOnly ? "actives" : "all"}_${totalRows}.xlsx`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, new Blob([xlsxBytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }), {
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) throw new Error(`Upload: ${upErr.message}`);

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    if (signErr) throw new Error(`Signed URL: ${signErr.message}`);

    return json({
      success: true,
      total_rows: totalRows,
      pages,
      sheets: sheets.length,
      size_bytes: xlsxBytes.length,
      storage_path: path,
      signed_url: signed?.signedUrl ?? null,
      filename: `medikong-offres${activeOnly ? "-actives" : ""}-${ts}.xlsx`,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[export-offers-xlsx] FAIL", { totalRows, pages, lastId, error: msg });
    return json({
      error: msg,
      partial: { total_rows: totalRows, pages, last_id: lastId, sheets: sheets.length },
    }, 500);
  }
});
