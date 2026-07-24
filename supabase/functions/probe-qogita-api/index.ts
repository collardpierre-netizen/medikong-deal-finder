// Probe de cartographie de la nouvelle API Qogita.
// Effectue des appels bruts avec le bearer stocké et renvoie les réponses telles quelles
// (troncatées) pour permettre un diagnostic manuel côté admin.
//
// NE FAIT AUCUNE ÉCRITURE DANS LE CATALOGUE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";
import { maybeDecrypt } from "../_shared/qogita-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const QOGITA_API = "https://api.qogita.com";

async function getToken(sb: any, forceLogin = false): Promise<string> {
  const { data: rows } = await sb
    .from("qogita_config")
    .select("key, value")
    .in("key", ["qogita_email", "qogita_password", "bearer_token"]);
  const cfg: Record<string, string> = {};
  (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });
  if (!forceLogin && cfg.bearer_token) return cfg.bearer_token;
  const email = cfg.qogita_email;
  const password = await maybeDecrypt(cfg.qogita_password);
  if (!email || !password) throw new Error("Credentials Qogita manquants");
  const res = await fetch(`${QOGITA_API}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.accessToken) throw new Error(`Login échec: ${JSON.stringify(body)}`);
  // best-effort: persist fresh token
  try {
    await sb.from("qogita_config").upsert({ key: "bearer_token", value: body.accessToken });
  } catch { /* ignore */ }
  return body.accessToken;
}

async function probe(
  url: string,
  headers: Record<string, string>,
  init: RequestInit = {},
) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers, ...init });
    const raw = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    let parsed: any = null;
    let parseError: string | null = null;
    if (contentType.includes("application/json")) {
      try { parsed = JSON.parse(raw); } catch (e) { parseError = (e as Error).message; }
    }
    return {
      url,
      method: (init.method as string) ?? "GET",
      status: res.status,
      ok: res.ok,
      content_type: contentType,
      latency_ms: Date.now() - started,
      body_snippet: raw.slice(0, 4000),
      body_length: raw.length,
      json: parsed,
      parse_error: parseError,
      keys_top_level: parsed && typeof parsed === "object"
        ? Object.keys(parsed).slice(0, 40)
        : null,
    };
  } catch (e) {
    return {
      url,
      method: (init.method as string) ?? "GET",
      status: null,
      ok: false,
      latency_ms: Date.now() - started,
      error: (e as Error).message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let gtin = "3349668617043"; // Paco Rabanne Phantom EDT 100 ml (indicatif)
  let country = "BE";
  try {
    const body = await req.json();
    if (body?.gtin) gtin = String(body.gtin);
    if (body?.country) country = String(body.country);
  } catch { /* pas de body -> defaults */ }

  let token: string;
  let loginDebug: any = null;
  try {
    // Direct diagnostic login pour observer la réponse brute
    const { data: rows } = await sb
      .from("qogita_config")
      .select("key, value")
      .in("key", ["qogita_email", "qogita_password"]);
    const cfg: Record<string, string> = {};
    (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });
    const email = cfg.qogita_email;
    const password = await maybeDecrypt(cfg.qogita_password);
    const started = Date.now();
    const loginRes = await fetch(`${QOGITA_API}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginText = await loginRes.text();
    loginDebug = {
      status: loginRes.status,
      latency_ms: Date.now() - started,
      body_snippet: loginText.slice(0, 500),
      email_used: email ? email.replace(/(.).*(@.*)/, "$1***$2") : null,
      password_len: password?.length ?? 0,
    };
    const parsed = JSON.parse(loginText);
    token = parsed.accessToken ?? parsed.access_token ?? parsed.token;
    if (!token) throw new Error("no accessToken in login response");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, loginDebug }), { status: 500, headers: corsHeaders });
  }
  const H = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const results: Record<string, any> = {};

  // 2) variant retrieve
  results["variant_retrieve"] = await probe(
    `${QOGITA_API}/variants/${gtin}/?country=${country}`,
    H,
  );
  const retrieveJson = results["variant_retrieve"]?.json;
  const fid = retrieveJson?.fid ?? null;
  const slug = retrieveJson?.slug ?? null;
  const qid = retrieveJson?.qid ?? null;

  // 1bis) plusieurs signatures possibles pour "variants search"
  const searchVariants = [
    `${QOGITA_API}/variants/search/?query=${encodeURIComponent(gtin)}&country=${country}`,
    `${QOGITA_API}/variants/search/?gtin=${encodeURIComponent(gtin)}&country=${country}`,
    `${QOGITA_API}/search/variants/?query=${encodeURIComponent(gtin)}&country=${country}`,
    `${QOGITA_API}/variants/?query=${encodeURIComponent(gtin)}&country=${country}`,
    `${QOGITA_API}/variants/?search=${encodeURIComponent(gtin)}&country=${country}`,
  ];
  for (const url of searchVariants) {
    results[`search__${url.split("?")[0].replace(QOGITA_API, "")}__${url.split("?")[1]?.split("&")[0]}`] = await probe(url, H);
  }

  // 3) endpoints "par vendeur" plausibles
  if (fid && slug) {
    results["legacy_offers_fid_slug"] = await probe(`${QOGITA_API}/variants/${fid}/${slug}/offers/`, H);
    results["variant_sellers_fid_slug"] = await probe(`${QOGITA_API}/variants/${fid}/${slug}/sellers/`, H);
  }
  if (qid) {
    results["variant_by_qid"] = await probe(`${QOGITA_API}/variants/${qid}/?country=${country}`, H);
    results["variant_qid_offers"] = await probe(`${QOGITA_API}/variants/${qid}/offers/?country=${country}`, H);
    results["variant_qid_sellers"] = await probe(`${QOGITA_API}/variants/${qid}/sellers/?country=${country}`, H);
    results["variant_qid_prices"] = await probe(`${QOGITA_API}/variants/${qid}/prices/?country=${country}`, H);
  }
  if (gtin) {
    results["variant_gtin_offers"] = await probe(`${QOGITA_API}/variants/${gtin}/offers/?country=${country}`, H);
    results["variant_gtin_sellers"] = await probe(`${QOGITA_API}/variants/${gtin}/sellers/?country=${country}`, H);
  }

  // 4) Export CSV — plusieurs signatures
  results["csv_download_basic"] = await probe(
    `${QOGITA_API}/variants/search/download/?country=${country}`,
    { ...H, Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
  );
  results["csv_variants_download"] = await probe(
    `${QOGITA_API}/variants/download/?country=${country}`,
    { ...H, Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
  );
  results["csv_export"] = await probe(
    `${QOGITA_API}/variants/export/?country=${country}`,
    { ...H, Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
  );

  // 4bis) NOUVEAU — endpoints multi-vendeur/offres potentiels par variant
  if (qid) {
    for (const suffix of [
      "deals", "inventory", "inventories", "suppliers", "supplierOffers",
      "offers", "supplier-offers", "supplier_offers", "sellerOffers",
      "listings", "listing", "sellers", "vendors", "prices", "pricing",
      "stock", "availability",
    ]) {
      results[`variant_qid_${suffix}`] = await probe(
        `${QOGITA_API}/variants/${qid}/${suffix}/?country=${country}`,
        H,
      );
    }
    // include / expand params (REST courant : ?include=offers ou ?expand=offers)
    for (const q of [
      "include=offers", "include=sellers", "include=suppliers", "include=inventory",
      "expand=offers", "expand=sellers", "expand=suppliers",
      "fields=offers", "with=offers",
    ]) {
      results[`variant_qid_query_${q}`] = await probe(
        `${QOGITA_API}/variants/${qid}/?country=${country}&${q}`,
        H,
      );
    }
  }
  // endpoints "plats" potentiels
  for (const path of [
    "offers", "deals", "inventory", "listings", "supplier-offers",
    "suppliers", "sellers", "prices", "pricing",
  ]) {
    results[`root_${path}`] = await probe(
      `${QOGITA_API}/${path}/?country=${country}&variantQid=${qid ?? ""}`,
      H,
    );
  }

  // === NOUVEAU : cible /offers/ avec toutes les signatures de filtre plausibles ===
  if (qid) {
    for (const q of [
      `variantQid=${qid}`,
      `variant_qid=${qid}`,
      `variant=${qid}`,
      `variantId=${qid}`,
      `qid=${qid}`,
      `variantFid=${fid ?? ""}`,
      `variantSlug=${slug ?? ""}`,
      `variantGtin=${gtin}`,
      `gtin=${gtin}`,
      `search=${gtin}`,
      `query=${gtin}`,
    ]) {
      results[`offers_filter__${q.split("=")[0]}`] = await probe(
        `${QOGITA_API}/offers/?${q}&country=${country}`,
        H,
      );
    }
    // Tri par prix pour voir si /offers/ liste tout par défaut
    results["offers_no_filter"] = await probe(
      `${QOGITA_API}/offers/?country=${country}&limit=3`,
      H,
    );
  }

  // (déplacé plus bas, après carts_active_get)

  // 5) Panier — GET liste + POST création (plusieurs signatures)
  results["carts_list_get"] = await probe(`${QOGITA_API}/carts/?country=${country}`, H);
  results["carts_active_get"] = await probe(`${QOGITA_API}/carts/active/?country=${country}`, H);
  results["carts_my_get"] = await probe(`${QOGITA_API}/carts/my/?country=${country}`, H);

  // 5bis) FLOW PANIER RÉEL — ajouter la variante et inspecter la réponse
  // (le prix est probablement porté par le lineItem au sein du panier)
  const activeCart = results["carts_active_get"]?.json;
  const activeCartQid = activeCart?.qid ?? activeCart?.id ?? null;
  if (activeCartQid && qid) {
    const attempts: [string, string, any][] = [
      ["cart_active_add_item_by_variantQid",
       `${QOGITA_API}/carts/${activeCartQid}/lines/`,
       { variantQid: qid, quantity: 1 }],
      ["cart_active_add_item_by_qid_snake",
       `${QOGITA_API}/carts/${activeCartQid}/lines/`,
       { variant_qid: qid, quantity: 1 }],
      ["cart_active_add_item_items_path",
       `${QOGITA_API}/carts/${activeCartQid}/items/`,
       { variantQid: qid, quantity: 1 }],
      ["cart_active_add_item_gtin",
       `${QOGITA_API}/carts/${activeCartQid}/lines/`,
       { gtin, quantity: 1 }],
    ];
    for (const [key, url, body] of attempts) {
      results[key] = await probe(
        url,
        { ...H, "Content-Type": "application/json" },
        { method: "POST", body: JSON.stringify(body) },
      );
    }
    // Après add-item : relire le panier pour voir prix/vendeurs sur les lineItems
    results["cart_active_after_add"] = await probe(
      `${QOGITA_API}/carts/${activeCartQid}/?country=${country}`,
      H,
    );
    results["cart_active_lines"] = await probe(
      `${QOGITA_API}/carts/${activeCartQid}/lines/?country=${country}`,
      H,
    );
  }

  // 6) Watchlist (peut porter des prix ?)
  results["watchlist_list"] = await probe(`${QOGITA_API}/watchlist/?country=${country}`, H);

  // 7) Categories (sanity check)
  results["categories_root"] = await probe(`${QOGITA_API}/categories/?country=${country}`, H);

  return new Response(
    JSON.stringify({
      probed_at: new Date().toISOString(),
      inputs: { gtin, country, fid, slug, qid },
      loginDebug,
      results,
    }, null, 2),
    { headers: corsHeaders },
  );
});
