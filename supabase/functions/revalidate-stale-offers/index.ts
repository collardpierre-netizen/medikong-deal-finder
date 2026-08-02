// ─────────────────────────────────────────────────────────────────────────────
// Revalidation à la demande des offres marquées `price_stale`.
//
// Appelée par le panier JUSTE AVANT la tentative de commande : au lieu de
// laisser l'acheteur bloqué par le garde-fou `price_stale` de `validate-cart`,
// on relance une vérification ciblée du prix fournisseur sur les seules offres
// concernées, puis le client rejoue la validation serveur.
//
// Garde-fous :
//  - JWT acheteur obligatoire (verify_jwt = true)
//  - max 25 offres par appel
//  - cooldown 5 min par produit (`products.mv_last_probed_at`) pour ne pas
//    marteler l'API fournisseur depuis le navigateur
//  - aucune écriture directe sur les prix ici : c'est `sync-qogita-offers-api`
//    (service role) qui reste la seule source d'écriture.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Doit rester aligné sur QOGITA_STALE_THRESHOLD_DAYS de _shared/validate-cart.ts
const STALE_THRESHOLD_DAYS = 7;
const MAX_OFFERS = 25;
const PRODUCT_COOLDOWN_MS = 5 * 60 * 1000;

type OfferRow = {
  id: string;
  product_id: string | null;
  price_stale: boolean | null;
  last_verified_at: string | null;
  is_qogita_backed: boolean | null;
};

const isStale = (o: OfferRow, cutoffMs: number) => {
  if (o.price_stale === true) return true;
  if (o.is_qogita_backed !== true) return false;
  const ms = o.last_verified_at ? Date.parse(o.last_verified_at) : null;
  return ms == null || Number.isNaN(ms) || ms < cutoffMs;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth acheteur ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const offerIds = Array.isArray(body.offer_ids)
    ? [...new Set((body.offer_ids as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0))].slice(0, MAX_OFFERS)
    : [];

  if (offerIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, triggered: false, reason: "no_offer_ids", revalidated: [], still_stale: [] }), { headers: corsHeaders });
  }

  const admin = createClient(url, serviceKey);
  const cutoffMs = Date.now() - STALE_THRESHOLD_DAYS * 24 * 3600 * 1000;

  const { data: offersBefore, error: offErr } = await admin
    .from("offers")
    .select("id, product_id, price_stale, last_verified_at, is_qogita_backed")
    .in("id", offerIds);
  if (offErr) {
    return new Response(JSON.stringify({ error: "offers_fetch_failed", details: offErr.message }), { status: 500, headers: corsHeaders });
  }

  const staleOffers = ((offersBefore || []) as OfferRow[]).filter((o) => isStale(o, cutoffMs));
  if (staleOffers.length === 0) {
    return new Response(JSON.stringify({ ok: true, triggered: false, reason: "nothing_stale", revalidated: [], still_stale: [] }), { headers: corsHeaders });
  }

  const productIds = [...new Set(staleOffers.map((o) => o.product_id).filter((v): v is string => !!v))];
  if (productIds.length === 0) {
    return new Response(JSON.stringify({
      ok: true, triggered: false, reason: "no_product_link",
      revalidated: [], still_stale: staleOffers.map((o) => o.id),
    }), { headers: corsHeaders });
  }

  // ── Cooldown : on ne resonde pas un produit probé il y a moins de 5 min ──
  const { data: prodRows } = await admin
    .from("products")
    .select("id, mv_last_probed_at, qogita_fid")
    .in("id", productIds);

  const coolMs = Date.now() - PRODUCT_COOLDOWN_MS;
  const targets = ((prodRows || []) as any[])
    .filter((p) => {
      if (!p.qogita_fid) return false;
      const ms = p.mv_last_probed_at ? Date.parse(p.mv_last_probed_at) : null;
      return ms == null || Number.isNaN(ms) || ms < coolMs;
    })
    .map((p) => p.id as string);

  let syncResult: Record<string, unknown> | null = null;
  let syncError: string | null = null;

  if (targets.length > 0) {
    try {
      const res = await fetch(`${url}/functions/v1/sync-qogita-offers-api`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: targets,
          limit: targets.length,
          concurrency: 2,
          rps: 2,
          walltimeMs: 25_000,
          fallback: true,
        }),
      });
      const txt = await res.text();
      syncResult = { status: res.status, body: txt.slice(0, 800) };
      if (!res.ok) syncError = `sync_http_${res.status}`;
    } catch (e) {
      syncError = (e as Error).message;
    }
  }

  // ── État après revalidation ──────────────────────────────────────────────
  const { data: offersAfter } = await admin
    .from("offers")
    .select("id, product_id, price_stale, last_verified_at, is_qogita_backed")
    .in("id", staleOffers.map((o) => o.id));

  const afterMap = new Map<string, OfferRow>(((offersAfter || []) as OfferRow[]).map((o) => [o.id, o]));
  const revalidated: string[] = [];
  const stillStale: string[] = [];
  for (const o of staleOffers) {
    const now = afterMap.get(o.id);
    if (now && !isStale(now, Date.now() - STALE_THRESHOLD_DAYS * 24 * 3600 * 1000)) revalidated.push(o.id);
    else stillStale.push(o.id);
  }

  return new Response(JSON.stringify({
    ok: true,
    triggered: targets.length > 0,
    products_targeted: targets.length,
    products_on_cooldown: productIds.length - targets.length,
    revalidated,
    still_stale: stillStale,
    should_revalidate_cart: revalidated.length > 0,
    sync: syncResult,
    sync_error: syncError,
  }), { headers: corsHeaders });
});
