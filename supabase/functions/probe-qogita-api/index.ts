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

async function getToken(sb: any): Promise<string> {
  // On tente d'abord le bearer en cache, sinon on rejoue login.
  const { data: rows } = await sb
    .from("qogita_config")
    .select("key, value")
    .in("key", ["qogita_email", "qogita_password", "bearer_token"]);
  const cfg: Record<string, string> = {};
  (rows || []).forEach((r: any) => { cfg[r.key] = r.value; });
  if (cfg.bearer_token) return cfg.bearer_token;
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
  try {
    token = await getToken(sb);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
  const H = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const results: Record<string, any> = {};

  // 1) variants search par GTIN (est-ce que la liste porte un prix ?)
  results["variants_search_by_gtin"] = await probe(
    `${QOGITA_API}/variants/?query=${encodeURIComponent(gtin)}&country=${country}`,
    H,
  );

  // 2) variant retrieve (ancien endroit du "price")
  results["variant_retrieve"] = await probe(
    `${QOGITA_API}/variants/${gtin}/?country=${country}`,
    H,
  );

  // Extraire fid/slug pour tester l'ancien /offers/ (attendu 404) + autres sous-chemins
  const retrieveJson = results["variant_retrieve"]?.json;
  const fid = retrieveJson?.fid ?? null;
  const slug = retrieveJson?.slug ?? null;
  const qid = retrieveJson?.qid ?? null;

  // 3) ancien endpoint offres (control) + variantes plausibles de nommage
  if (fid && slug) {
    results["legacy_offers"] = await probe(`${QOGITA_API}/variants/${fid}/${slug}/offers/`, H);
    results["variant_sellers"] = await probe(`${QOGITA_API}/variants/${fid}/${slug}/sellers/`, H);
    results["variant_prices"] = await probe(`${QOGITA_API}/variants/${fid}/${slug}/prices/`, H);
  }
  if (qid) {
    results["variant_by_qid"] = await probe(`${QOGITA_API}/variants/${qid}/?country=${country}`, H);
  }

  // 4) Export CSV — tests de plusieurs signatures
  results["csv_download_basic"] = await probe(
    `${QOGITA_API}/variants/search/download/?country=${country}`,
    { ...H, Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
  );
  results["csv_download_format_csv"] = await probe(
    `${QOGITA_API}/variants/search/download/?country=${country}&format=csv`,
    { ...H, Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
  );
  results["csv_download_post"] = await probe(
    `${QOGITA_API}/variants/search/download/`,
    { ...H, "Content-Type": "application/json" },
    { method: "POST", body: JSON.stringify({ country, format: "csv" }) },
  );

  // 5) Prix via panier ? — on tente une création de cart puis add item pour voir la structure prix.
  //    On ne finalise JAMAIS un checkout ; on lit juste la réponse.
  const cartCreate = await probe(
    `${QOGITA_API}/carts/`,
    { ...H, "Content-Type": "application/json" },
    { method: "POST", body: JSON.stringify({ country }) },
  );
  results["cart_create"] = cartCreate;
  const cartId = cartCreate?.json?.qid ?? cartCreate?.json?.id ?? cartCreate?.json?.uuid ?? null;
  if (cartId && qid) {
    results["cart_add_item"] = await probe(
      `${QOGITA_API}/carts/${cartId}/items/`,
      { ...H, "Content-Type": "application/json" },
      { method: "POST", body: JSON.stringify({ variantQid: qid, quantity: 1 }) },
    );
    results["cart_retrieve"] = await probe(`${QOGITA_API}/carts/${cartId}/`, H);
  }

  // 6) Catégories root (pour recouper les surfaces de l'API)
  results["categories_root"] = await probe(`${QOGITA_API}/categories/?country=${country}`, H);

  return new Response(
    JSON.stringify({
      probed_at: new Date().toISOString(),
      inputs: { gtin, country, fid, slug, qid },
      results,
    }, null, 2),
    { headers: corsHeaders },
  );
});
