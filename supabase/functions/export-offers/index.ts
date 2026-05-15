// Edge Function: export-offers
// Export CSV (UTF-8 + BOM) streamé en réponse HTTP : on pagine la table offers
// et on pousse chaque page dans un ReadableStream renvoyé directement au
// navigateur. Aucun buffer global → mémoire ~constante quel que soit le volume,
// pas d'upload Storage, pas de 400 dû à un payload géant.
// Réservé aux admins.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "content-disposition, x-total-rows",
};

// PostgREST plafonne par défaut à db.max_rows = 1000, donc inutile de demander plus :
// la pagination keyset (gt(id, lastId)) reste correcte page après page.
const PAGE = 1000;
// 100 UUIDs ≈ 3.9 ko d'URL, sous la limite 8 ko du gateway PostgREST.
// 500 provoquait des "error sending request" intermittents.
const ENRICH_BATCH = 100;

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

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function jsonError(body: unknown, status = 500) {
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
  if (!authHeader) return jsonError({ error: "Missing Authorization" }, 401);

  // 1) Auth
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return jsonError({ error: "Invalid auth" }, 401);
  const userId = userData.user.id;

  // 2) Admin check
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin", {
    _user_id: userId,
  });
  if (adminErr || !isAdmin) return jsonError({ error: "Admin only" }, 403);

  // 3) Body / params
  let activeOnly = true;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.activeOnly === "boolean") activeOnly = body.activeOnly;
    } catch { /* default */ }
  } else {
    const url = new URL(req.url);
    if (url.searchParams.get("activeOnly") === "false") activeOnly = false;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
  const filename = `medikong-offres${activeOnly ? "-actives" : ""}-${ts}.csv`;

  // Caches d'enrichissement (réutilisés entre pages, bornés en pratique par
  // les valeurs distinctes du dataset filtré)
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

  const encoder = new TextEncoder();
  let totalRows = 0;
  let pages = 0;
  let lastId: string | null = null;
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // BOM + en-tête
        controller.enqueue(encoder.encode("\uFEFF" + HEADERS.join(",") + "\n"));

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

          // Construit la chunk CSV de la page et l'enqueue d'un coup
          let chunk = "";
          for (const o of offers) {
            const p = (o.product_id ? productMap.get(o.product_id) : null) ?? {};
            const v = (o.vendor_id ? vendorMap.get(o.vendor_id) : null) ?? {};
            chunk += [
              o.id,
              p.gtin ?? "",
              p.cnk_code ?? "",
              p.name ?? "",
              p.brand_name ?? "",
              p.category_name ?? "",
              v.company_name ?? v.name ?? v.display_code ?? "",
              o.country_code ?? "",
              o.price_excl_vat ?? "",
              o.price_incl_vat ?? "",
              o.vat_rate ?? "",
              o.purchase_price ?? "",
              o.qogita_base_price ?? "",
              o.applied_margin_percentage ?? "",
              o.margin_amount ?? "",
              o.stock_quantity ?? "",
              o.stock_status ?? "",
              o.moq ?? "",
              o.mov_amount ?? o.mov ?? "",
              o.mov_currency ?? "",
              o.delivery_days ?? "",
              o.is_qogita_backed ? "Oui" : "Non",
              o.is_active ? "Oui" : "Non",
            ].map(csvEscape).join(",") + "\n";
          }
          controller.enqueue(encoder.encode(chunk));

          totalRows += offers.length;
          lastId = offers[offers.length - 1].id;
          pages += 1;

          // Ne PAS sortir sur `offers.length < PAGE` : si PostgREST applique un
          // plafond `db.max_rows` inférieur à PAGE, on stopperait après la 1re page.
          // On boucle tant que la page suivante renvoie au moins 1 ligne.

        console.log("[export-offers] OK", {
          totalRows, pages, duration_ms: Date.now() - startedAt,
        });
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[export-offers] FAIL", { totalRows, pages, lastId, error: msg });
        // Marqueur d'erreur en queue (visible à la fin du fichier)
        controller.enqueue(encoder.encode(`\n# ERROR: ${msg}\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Filename": filename,
    },
  });
});
