// Scrape the AUTHENTICATED Qogita storefront (www.qogita.com) to recover
// multi-vendor offers (`allOffers`) + `priceHistory` in a single request.
//
// Data flow per product:
//   1. Log in once (session cookies cached at module scope, refreshed on 401)
//   2. GET https://www.qogita.com/products/{qogita_fid}/{qogita_slug}/
//   3. Parse RSC HTML → extract `allOffers` + `priceHistory` + gtin (ld+json)
//   4. Upsert vendor (by seller code) → offer (per product+vendor+country)
//      → offer_price_tiers (tier_index=0 base + degressive tiers) → price_history
//   5. Re-source best-price on the product (lift price_stale,
//      price_source='qogita_storefront')
//
// See prompt "Récupérer les offres multi-vendeurs via le storefront authentifié".
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STOREFRONT_ORIGIN = "https://www.qogita.com";
const API_ORIGIN = "https://api.qogita.com";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const REQUEST_DELAY_MS = 1200; // ~0.8 req/s pacing on www.qogita.com
const MAX_WALLTIME_MS = 55_000;
const FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_BATCH = 20;

// ─────────────────────────────── Session cache ──────────────────────────────
// Module-scope cookie jar so consecutive product fetches within one invocation
// reuse the login. Cookies are refreshed on 401 / signed-out signals.
type Session = {
  cookieHeader: string;
  accessToken: string | null;
  loggedInAt: number;
  strategy: string;
};

let sessionCache: Session | null = null;

function extractSetCookies(res: Response): string[] {
  // Deno's Response supports getSetCookie() (WHATWG). Fallback to raw header.
  // deno-lint-ignore no-explicit-any
  const anyHeaders = res.headers as any;
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie() as string[];
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const jar = new Map<string, string>();
  if (existing) {
    for (const kv of existing.split("; ")) {
      const i = kv.indexOf("=");
      if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
  }
  for (const sc of setCookies) {
    const first = sc.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) {
      const name = first.slice(0, i).trim();
      const value = first.slice(i + 1).trim();
      // Skip cookie deletions
      if (value === "" || /Max-Age=0/i.test(sc) || /Expires=Thu, 01 Jan 1970/i.test(sc)) {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    }
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Cache the discovered Next.js Server Action ID across invocations of the same
// isolate. If Qogita redeploys the buyer app the ID rotates; we auto-refresh
// by re-scanning /login on the next login attempt.
let cachedLoginActionId: string | null = null;

async function discoverLoginActionId(cookieHeader: string): Promise<{ id: string; cookies: string } | null> {
  const res = await fetchWithTimeout(`${STOREFRONT_ORIGIN}/login/`, {
    method: "GET",
    headers: { "User-Agent": UA, Accept: "text/html", Cookie: cookieHeader },
    redirect: "manual",
  });
  const nextCookies = mergeCookies(cookieHeader, extractSetCookies(res));
  const html = await res.text();
  const chunkRe = /\/_next\/static\/chunks\/[a-z0-9_-]+\.js\?dpl=[A-Za-z0-9]+/g;
  const chunks = Array.from(new Set(html.match(chunkRe) ?? []));
  // Heuristic: login action lives in a chunk that also contains the string
  // "loginAction" registered via createServerReference. Scan chunks in
  // parallel (limit concurrency) and short-circuit on first match.
  for (let i = 0; i < chunks.length; i += 6) {
    const batch = chunks.slice(i, i + 6);
    const results = await Promise.all(batch.map(async (path) => {
      try {
        const r = await fetchWithTimeout(`${STOREFRONT_ORIGIN}${path}`, {
          method: "GET",
          headers: { "User-Agent": UA },
        });
        if (!r.ok) return null;
        const txt = await r.text();
        const m = txt.match(/createServerReference\("([0-9a-f]{40})",[^)]*?"loginAction"/);
        return m ? m[1] : null;
      } catch (_) {
        return null;
      }
    }));
    const hit = results.find((x) => !!x);
    if (hit) return { id: hit, cookies: nextCookies };
  }
  return null;
}

async function loginStorefront(): Promise<Session> {
  const email = Deno.env.get("QOGITA_STOREFRONT_EMAIL");
  const password = Deno.env.get("QOGITA_STOREFRONT_PASSWORD");
  if (!email || !password) {
    throw new Error("storefront_credentials_missing");
  }

  // Bootstrap cookies (Cloudflare `__cf_bm`, consent, etc.) via a home GET.
  let cookieHeader = "";
  try {
    const initRes = await fetchWithTimeout(`${STOREFRONT_ORIGIN}/`, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "manual",
    });
    cookieHeader = mergeCookies(cookieHeader, extractSetCookies(initRes));
  } catch (_) { /* ignore */ }

  // ── Strategy 0 — Next.js Server Action against /login/ ───────────────
  // Real login flow observed in the buyer app: POST /login/ with
  //   Next-Action: <40-hex id>  Content-Type: text/plain;charset=UTF-8
  //   body = [{"email","password","redirectTo":"/categories"}]
  // Sets the `qsession` cookie (httpOnly) which authorises product pages.
  try {
    if (!cachedLoginActionId) {
      const disc = await discoverLoginActionId(cookieHeader);
      if (disc) { cachedLoginActionId = disc.id; cookieHeader = disc.cookies; }
    }
    if (cachedLoginActionId) {
      const res = await fetchWithTimeout(`${STOREFRONT_ORIGIN}/login/`, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "text/plain;charset=UTF-8",
          Accept: "text/x-component,*/*;q=0.9",
          Origin: STOREFRONT_ORIGIN,
          Referer: `${STOREFRONT_ORIGIN}/login/`,
          "Next-Action": cachedLoginActionId,
          "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22(auth)%22%2C%7B%22children%22%3A%5B%22login%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
          Cookie: cookieHeader,
        },
        body: JSON.stringify([{ email, password, redirectTo: "/categories" }]),
        redirect: "manual",
      });
      const merged = mergeCookies(cookieHeader, extractSetCookies(res));
      const hasSession = /(?:^|; )qsession=/.test(merged);
      console.log(JSON.stringify({ tag: "storefront_login", strategy: "server_action_login", status: res.status, qsession: hasSession }));
      if (hasSession) {
        return { cookieHeader: merged, accessToken: null, loggedInAt: Date.now(), strategy: "server_action_login" };
      }
      // ID may have rotated after a Qogita redeploy — bust cache and try once more.
      cachedLoginActionId = null;
      const disc2 = await discoverLoginActionId(cookieHeader);
      if (disc2) {
        cachedLoginActionId = disc2.id;
        const res2 = await fetchWithTimeout(`${STOREFRONT_ORIGIN}/login/`, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Content-Type": "text/plain;charset=UTF-8",
            Accept: "text/x-component,*/*;q=0.9",
            Origin: STOREFRONT_ORIGIN,
            Referer: `${STOREFRONT_ORIGIN}/login/`,
            "Next-Action": cachedLoginActionId,
            "Next-Router-State-Tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22(auth)%22%2C%7B%22children%22%3A%5B%22login%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2Ctrue%5D",
            Cookie: disc2.cookies,
          },
          body: JSON.stringify([{ email, password, redirectTo: "/categories" }]),
          redirect: "manual",
        });
        const merged2 = mergeCookies(disc2.cookies, extractSetCookies(res2));
        if (/(?:^|; )qsession=/.test(merged2)) {
          console.log(JSON.stringify({ tag: "storefront_login", strategy: "server_action_login_refreshed", status: res2.status, qsession: true }));
          return { cookieHeader: merged2, accessToken: null, loggedInAt: Date.now(), strategy: "server_action_login" };
        }
      }
    }
  } catch (e) {
    console.log(JSON.stringify({ tag: "storefront_login_error", strategy: "server_action_login", error: (e as Error).message }));
  }


  const strategies: Array<{
    name: string;
    url: string;
    body: string | FormData;
    contentType: string;
  }> = [
    {
      name: "storefront_api_login_json",
      url: `${STOREFRONT_ORIGIN}/api/auth/login`,
      body: JSON.stringify({ email, password }),
      contentType: "application/json",
    },
    {
      name: "storefront_api_signin_json",
      url: `${STOREFRONT_ORIGIN}/api/auth/sign-in`,
      body: JSON.stringify({ email, password }),
      contentType: "application/json",
    },
  ];

  for (const s of strategies) {
    try {
      const before = cookieHeader;
      const res = await fetchWithTimeout(s.url, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": s.contentType,
          Accept: "application/json, text/plain, */*",
          Origin: STOREFRONT_ORIGIN,
          Referer: `${STOREFRONT_ORIGIN}/login`,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: s.body,
        redirect: "manual",
      });
      if (res.status >= 200 && res.status < 400) {
        const merged = mergeCookies(cookieHeader, extractSetCookies(res));
        // Only accept if the response actually issued a new cookie AND the
        // response body isn't an { error: ... } payload. Otherwise fall through.
        let bodyLooksOk = true;
        try {
          const txt = await res.clone().text();
          if (txt && /"(error|errors|message)"\s*:/i.test(txt) && !/"user"|"accessToken"|"session"/i.test(txt)) {
            bodyLooksOk = false;
          }
        } catch (_) { /* ignore */ }
        if (merged !== before && bodyLooksOk) {
          cookieHeader = merged;
          console.log(JSON.stringify({ tag: "storefront_login", strategy: s.name, status: res.status, cookie_added: true }));
          return {
            cookieHeader,
            accessToken: null,
            loggedInAt: Date.now(),
            strategy: s.name,
          };
        }
        console.log(JSON.stringify({ tag: "storefront_login_skipped", strategy: s.name, status: res.status, cookie_added: merged !== before, body_ok: bodyLooksOk }));
      } else {
        console.log(JSON.stringify({ tag: "storefront_login_failed", strategy: s.name, status: res.status }));
      }
    } catch (e) {
      console.log(JSON.stringify({ tag: "storefront_login_error", strategy: s.name, error: (e as Error).message }));
    }
  }

  // Strategy C — fallback via api.qogita.com/auth/login/ (returns access +
  // refresh tokens). We then hit the storefront with the access token cookie
  // that the SSR layer expects. Cookie name is inferred from Set-Cookie if the
  // API also sets one, otherwise we probe a couple of common names.
  const apiRes = await fetchWithTimeout(`${API_ORIGIN}/auth/login/`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: STOREFRONT_ORIGIN,
      Referer: `${STOREFRONT_ORIGIN}/`,
    },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  if (!apiRes.ok) {
    throw new Error(`api_login_failed_${apiRes.status}`);
  }
  cookieHeader = mergeCookies(cookieHeader, extractSetCookies(apiRes));
  let accessToken: string | null = null;
  try {
    const j = await apiRes.json();
    accessToken = j?.accessToken ?? j?.access_token ?? null;
  } catch (_) { /* ignore */ }

  if (accessToken) {
    // Common storefront cookie names — cheap to include, harmless if unused.
    const jar = new Map<string, string>();
    if (cookieHeader) {
      for (const kv of cookieHeader.split("; ")) {
        const i = kv.indexOf("=");
        if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1));
      }
    }
    if (!jar.has("access_token")) jar.set("access_token", accessToken);
    if (!jar.has("qogita_access_token")) jar.set("qogita_access_token", accessToken);
    cookieHeader = Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  return {
    cookieHeader,
    accessToken,
    loggedInAt: Date.now(),
    strategy: "api_login_bridge",
  };
}

async function ensureSession(force = false): Promise<Session> {
  if (!force && sessionCache && Date.now() - sessionCache.loggedInAt < 20 * 60 * 1000) {
    return sessionCache;
  }
  sessionCache = await loginStorefront();
  return sessionCache;
}

function isLoggedOutHtml(html: string): boolean {
  // Authoritative signal: authenticated product pages ship the RSC payload
  // containing `allOffers`. If it is missing, the SSR layer served the
  // public/masked variant — treat as logged out and refresh session.
  if (!html.includes("allOffers")) return true;
  if (html.includes("Sign up to unlock")) return true;
  if (html.includes("Log in to see") && html.includes("offers")) return true;
  return false;
}

// ─────────────────────────── RSC payload extraction ─────────────────────────
/** Extract a JSON array whose values are wrapped in RSC escape sequences. */
function extractEscapedJsonArray(html: string, key: string): unknown[] | null {
  const idx = html.indexOf(key);
  if (idx < 0) return null;
  const start = html.indexOf("[", idx);
  if (start < 0) return null;
  let depth = 0;
  let end = -1;
  let inStr = false;
  let esc = false;
  const cap = Math.min(html.length, start + 400_000);
  for (let i = start; i < cap; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) return null;
  let raw = html.substring(start, end);
  raw = raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch (_) { /* fall through */ }
  return null;
}

function extractGtinFromLdJson(html: string): string | null {
  // Look for `"gtin13":"..."` occurrences inside ld+json Product blocks.
  const re = /"gtin(?:13|14|8|)"\s*:\s*"(\d{8,14})"/;
  const m = html.match(re);
  return m ? m[1] : null;
}

type StorefrontOffer = {
  qid: string;
  seller: string;
  inventory: number;
  unit: number;
  isInStock: boolean;
  isPreOrder: boolean;
  isTopSeller: boolean;
  isTraceable: boolean;
  tieredPrices: Array<{
    isActive: boolean;
    tierMov: { amount: string; currency: string };
    tierPrice: { amount: string; currency: string };
  }>;
};

type StorefrontPayload = {
  allOffers: StorefrontOffer[];
  priceHistory: Array<{ date: number; price: string }>;
  gtin: string | null;
};

function parseStorefront(html: string): StorefrontPayload {
  const rawOffers = extractEscapedJsonArray(html, "allOffers");
  const rawHistory = extractEscapedJsonArray(html, "priceHistory");
  const gtin = extractGtinFromLdJson(html);

  const allOffers: StorefrontOffer[] = [];
  if (Array.isArray(rawOffers)) {
    for (const o of rawOffers) {
      // deno-lint-ignore no-explicit-any
      const off = o as any;
      if (!off || typeof off.qid !== "string" || typeof off.seller !== "string") continue;
      allOffers.push({
        qid: off.qid,
        seller: off.seller,
        inventory: Number(off.inventory ?? 0) || 0,
        unit: Number(off.unit ?? 1) || 1,
        isInStock: Boolean(off.isInStock),
        isPreOrder: Boolean(off.isPreOrder),
        isTopSeller: Boolean(off.isTopSeller),
        isTraceable: Boolean(off.isTraceable),
        tieredPrices: Array.isArray(off.tieredPrices) ? off.tieredPrices : [],
      });
    }
  }

  const priceHistory: Array<{ date: number; price: string }> = [];
  if (Array.isArray(rawHistory)) {
    for (const p of rawHistory) {
      // deno-lint-ignore no-explicit-any
      const ph = p as any;
      if (ph && typeof ph.date === "number" && typeof ph.price === "string") {
        priceHistory.push({ date: ph.date, price: ph.price });
      }
    }
  }

  return { allOffers, priceHistory, gtin };
}

// ─────────────────────────── DB helpers ─────────────────────────
async function resolveVendorId(
  // deno-lint-ignore no-explicit-any
  sb: any,
  sellerCode: string,
  country: string,
  stats: { vendors_created: number },
): Promise<string | null> {
  if (!sellerCode) return null;

  const { data: existing } = await sb
    .from("vendors")
    .select("id")
    .eq("qogita_seller_alias", sellerCode)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const slug = `qogita-seller-${sellerCode.toLowerCase()}`;
  const { data: bySlug } = await sb
    .from("vendors")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (bySlug?.id) {
    await sb
      .from("vendors")
      .update({ qogita_seller_alias: sellerCode })
      .eq("id", bySlug.id);
    return bySlug.id;
  }

  const { data: inserted, error } = await sb
    .from("vendors")
    .insert({
      name: `Vendeur ${sellerCode}`,
      slug,
      type: "qogita_virtual",
      is_active: true,
      is_verified: false,
      auto_forward_to_qogita: true,
      can_manage_offers: false,
      country_code: country,
      commission_rate: 0,
      qogita_seller_alias: sellerCode,
      display_code: sellerCode,
    })
    .select("id")
    .single();
  if (error || !inserted?.id) {
    console.error("vendor_insert_failed", sellerCode, error?.message);
    return null;
  }
  stats.vendors_created += 1;
  return inserted.id;
}

async function upsertOffer(
  // deno-lint-ignore no-explicit-any
  sb: any,
  productId: string,
  vendorId: string,
  country: string,
  offer: StorefrontOffer,
  basePriceExcl: number,
  baseMov: number,
  vatRate: number,
): Promise<string | null> {
  const now = new Date().toISOString();
  const payload = {
    product_id: productId,
    vendor_id: vendorId,
    country_code: country,
    qogita_offer_qid: offer.qid,
    qogita_base_price: basePriceExcl,
    is_qogita_backed: true,
    price_excl_vat: basePriceExcl,
    price_incl_vat: Math.round(basePriceExcl * (1 + vatRate) * 100) / 100,
    vat_rate: vatRate,
    stock_quantity: offer.inventory,
    stock_status: offer.isInStock ? "in_stock" : "out_of_stock",
    mov_amount: baseMov,
    mov_currency: "EUR",
    is_traceable: offer.isTraceable,
    is_top_seller: offer.isTopSeller,
    is_active: true,
    price_stale: false,
    price_stale_since: null,
    price_source: "qogita_storefront",
    price_source_updated_at: now,
    synced_at: now,
    // Dernière VÉRIFICATION RÉELLE du prix/dispo (distincte de synced_at qui
    // trace la dernière tentative). Consommée par le guard checkout et par
    // le futur flip de qogita_config.offers_source_healthy.
    // TODO(rebuild) : quand un cycle complet du scraper a stampé
    // last_verified_at sur tout le périmètre attendu, flipper la clé
    // qogita_config.offers_source_healthy à true — ALORS SEULEMENT les
    // sweeps A/B/C peuvent désactiver les offres réellement absentes.
    last_verified_at: now,
  };

  // Match existing offer by product+vendor+country first, fallback to qid.
  const { data: byCombo } = await sb
    .from("offers")
    .select("id")
    .eq("product_id", productId)
    .eq("vendor_id", vendorId)
    .eq("country_code", country)
    .maybeSingle();
  if (byCombo?.id) {
    // Free old qid if held elsewhere
    await sb.from("offers")
      .update({ qogita_offer_qid: null })
      .eq("qogita_offer_qid", offer.qid)
      .neq("id", byCombo.id);
    const { error } = await sb.from("offers").update(payload).eq("id", byCombo.id);
    if (error) { console.error("offer_update_failed", error.message); return null; }
    return byCombo.id;
  }

  const { data: byQid } = await sb
    .from("offers")
    .select("id")
    .eq("qogita_offer_qid", offer.qid)
    .maybeSingle();
  if (byQid?.id) {
    const { error } = await sb.from("offers").update(payload).eq("id", byQid.id);
    if (error) { console.error("offer_update_failed", error.message); return null; }
    return byQid.id;
  }

  const { data: inserted, error } = await sb
    .from("offers")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (error) { console.error("offer_insert_failed", error.message); return null; }
  return inserted?.id ?? null;
}

async function syncTiers(
  // deno-lint-ignore no-explicit-any
  sb: any,
  offerId: string,
  basePriceExcl: number,
  baseMov: number,
  vatRate: number,
  tiers: StorefrontOffer["tieredPrices"],
): Promise<number> {
  const vm = 1 + vatRate;
  const normalized = tiers
    .map((t) => ({
      unit: parseFloat(t?.tierPrice?.amount ?? "0") || 0,
      mov: parseFloat(t?.tierMov?.amount ?? "0") || 0,
      isActive: Boolean(t?.isActive),
    }))
    .filter((t) => t.unit > 0)
    .sort((a, b) => a.mov - b.mov);

  const rows: Array<Record<string, unknown>> = [];
  rows.push({
    offer_id: offerId,
    tier_index: 0,
    mov_threshold: baseMov > 0 ? baseMov : 0,
    mov_currency: "EUR",
    qogita_unit_price: basePriceExcl,
    price_excl_vat: basePriceExcl,
    price_incl_vat: Math.round(basePriceExcl * vm * 100) / 100,
    is_active: true,
  });
  let idx = 1;
  for (const t of normalized) {
    if (Math.abs(t.unit - basePriceExcl) < 0.005 && Math.abs(t.mov - baseMov) < 0.005) continue;
    rows.push({
      offer_id: offerId,
      tier_index: idx++,
      mov_threshold: t.mov > 0 ? t.mov : 0,
      mov_currency: "EUR",
      qogita_unit_price: t.unit,
      price_excl_vat: t.unit,
      price_incl_vat: Math.round(t.unit * vm * 100) / 100,
      is_active: t.isActive,
    });
  }
  await sb.from("offer_price_tiers").delete().eq("offer_id", offerId);
  if (rows.length === 0) return 0;
  const { error } = await sb.from("offer_price_tiers").insert(rows);
  if (error) { console.error("tiers_insert_failed", error.message); return 0; }
  return rows.length;
}

// ─────────────────────────── Product-level orchestrator ─────────────────────
type ProductResult = {
  status: "ok" | "not_found" | "logged_out" | "error";
  offersWritten: number;
  tiersWritten: number;
  historyPoints: number;
  error?: string;
};

async function scrapeProduct(
  // deno-lint-ignore no-explicit-any
  sb: any,
  product: { id: string; gtin: string | null; qogita_fid: string | null; qogita_slug: string | null; country_code?: string | null },
  stats: { vendors_created: number; retries: number },
  opts: { dryRun: boolean; resourceOffers: boolean },
): Promise<ProductResult> {
  if (!product.qogita_fid || !product.qogita_slug) {
    return { status: "error", offersWritten: 0, tiersWritten: 0, historyPoints: 0, error: "missing_qogita_ids" };
  }
  const url = `${STOREFRONT_ORIGIN}/products/${product.qogita_fid}/${product.qogita_slug}/`;

  let session = await ensureSession();
  let html = "";
  let attempt = 0;
  while (attempt < 2) {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        Cookie: session.cookieHeader,
        ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        Referer: `${STOREFRONT_ORIGIN}/`,
      },
      redirect: "follow",
    });
    if (res.status === 404) return { status: "not_found", offersWritten: 0, tiersWritten: 0, historyPoints: 0 };
    if (res.status === 401 || res.status === 403) {
      session = await ensureSession(true);
      stats.retries += 1;
      attempt++;
      continue;
    }
    if (!res.ok) return { status: "error", offersWritten: 0, tiersWritten: 0, historyPoints: 0, error: `http_${res.status}` };
    html = await res.text();
    if (isLoggedOutHtml(html)) {
      session = await ensureSession(true);
      stats.retries += 1;
      attempt++;
      continue;
    }
    break;
  }
  if (!html) {
    return { status: "logged_out", offersWritten: 0, tiersWritten: 0, historyPoints: 0, error: "no_session" };
  }

  const { allOffers, priceHistory } = parseStorefront(html);

  if (opts.dryRun) {
    return {
      status: "ok",
      offersWritten: allOffers.length,
      tiersWritten: allOffers.reduce((n, o) => n + (o.tieredPrices?.length || 0) + 1, 0),
      historyPoints: priceHistory.length,
    };
  }

  // ── Resolve VAT rate ──────────────────────────────────────────────
  const country = product.country_code || "BE";
  let vatRate = 0.06;
  try {
    const { data: vat } = await sb.rpc("resolve_product_vat_rate", {
      _product_id: product.id,
      _country_code: country,
    });
    if (typeof vat === "number" && vat >= 0) vatRate = vat;
  } catch (_) { /* fallback */ }

  // ── Upsert offers + tiers ─────────────────────────────────────────
  let offersWritten = 0;
  let tiersWritten = 0;
  let bestExcl = Number.POSITIVE_INFINITY;
  for (const offer of allOffers) {
    if (!offer.seller || !offer.qid) continue;
    const tiers = (offer.tieredPrices ?? [])
      .map((t) => ({ unit: parseFloat(t?.tierPrice?.amount ?? "0") || 0, mov: parseFloat(t?.tierMov?.amount ?? "0") || 0 }))
      .filter((t) => t.unit > 0)
      .sort((a, b) => a.mov - b.mov);
    if (tiers.length === 0) continue;
    const basePriceExcl = tiers[0].unit;
    const baseMov = tiers[0].mov;
    if (basePriceExcl < bestExcl) bestExcl = basePriceExcl;

    const vendorId = await resolveVendorId(sb, offer.seller, country, stats);
    if (!vendorId) continue;
    const offerId = await upsertOffer(sb, product.id, vendorId, country, offer, basePriceExcl, baseMov, vatRate);
    if (!offerId) continue;
    offersWritten += 1;
    tiersWritten += await syncTiers(sb, offerId, basePriceExcl, baseMov, vatRate, offer.tieredPrices ?? []);
  }

  // ── Re-source best-price on stale Qogita-backed offers ────────────
  if (opts.resourceOffers && Number.isFinite(bestExcl) && bestExcl > 0) {
    await sb
      .from("offers")
      .update({
        price_stale: false,
        price_stale_since: null,
        price_source: "qogita_storefront",
        price_source_updated_at: new Date().toISOString(),
      })
      .eq("product_id", product.id)
      .eq("is_qogita_backed", true)
      .eq("price_stale", true);
  }

  // ── Persist priceHistory (Tendances) ──────────────────────────────
  let historyPoints = 0;
  const gtin = product.gtin;
  if (gtin && priceHistory.length > 0) {
    const byDate = new Map<string, number>();
    for (const p of priceHistory) {
      const priceEur = Number(p.price);
      if (!Number.isFinite(priceEur) || priceEur <= 0) continue;
      const d = new Date(p.date * 1000).toISOString().slice(0, 10);
      byDate.set(d, priceEur);
    }
    if (byDate.size > 0) {
      const rows = Array.from(byDate.entries()).map(([price_date, price_eur]) => ({
        gtin,
        price_date,
        price_eur,
        source: "qogita_storefront",
        scraped_at: new Date().toISOString(),
      }));
      const { error: histErr } = await sb
        .from("qogita_price_history")
        .upsert(rows, { onConflict: "gtin,price_date" });
      if (!histErr) historyPoints = rows.length;
    }
  }

  return { status: "ok", offersWritten, tiersWritten, historyPoints };
}

// ─────────────────────────────── HTTP handler ───────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: {
    productIds?: string[];
    gtins?: string[];
    limit?: number;
    dryRun?: boolean;
    resourceOffers?: boolean;
    forceLogin?: boolean;
  } = {};
  try { body = await req.json(); } catch (_) { /* cron */ }

  const limit = Math.min(Math.max(body.limit ?? DEFAULT_BATCH, 1), 100);
  const resourceOffers = body.resourceOffers ?? true;

  if (body.forceLogin) sessionCache = null;

  // Preflight: verify login before touching DB.
  try {
    await ensureSession(false);
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: "storefront_login_failed",
      detail: (e as Error).message,
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Resolve targets
  let query = sb
    .from("products")
    .select("id, gtin, qogita_fid, qogita_slug")
    .not("qogita_fid", "is", null)
    .not("qogita_slug", "is", null);
  if (body.productIds?.length) {
    query = query.in("id", body.productIds).limit(limit);
  } else if (body.gtins?.length) {
    query = query.in("gtin", body.gtins).limit(limit);
  } else {
    // Cron mode: pick from tendances_index_basket, oldest first.
    const { data: basket } = await sb
      .from("tendances_index_basket")
      .select("product_id")
      .eq("is_active", true)
      .order("last_scraped_at", { ascending: true, nullsFirst: true })
      .order("priority", { ascending: true })
      .limit(limit);
    const ids = (basket ?? []).map((b: { product_id: string }) => b.product_id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "basket_empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    query = query.in("id", ids);
  }

  const { data: products, error: prodErr } = await query;
  if (prodErr) {
    return new Response(JSON.stringify({ error: prodErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Open log row (reuse existing table)
  const { data: logRow } = await sb
    .from("qogita_price_scrape_logs")
    .insert({
      products_targeted: products?.length ?? 0,
      notes: `storefront strategy=${sessionCache?.strategy ?? "unknown"}`,
    })
    .select("id")
    .single();

  const stats = { vendors_created: 0, retries: 0 };
  let ok = 0, notFound = 0, loggedOut = 0, errors = 0;
  let totalOffers = 0, totalTiers = 0, totalHistory = 0, resourced = 0;
  const errorSamples: unknown[] = [];

  for (const p of products ?? []) {
    if (Date.now() - startedAt > MAX_WALLTIME_MS) {
      errorSamples.push({ reason: "walltime_exceeded" });
      break;
    }
    let res: ProductResult;
    try {
      res = await scrapeProduct(sb, p as never, stats, { dryRun: !!body.dryRun, resourceOffers });
    } catch (e) {
      res = { status: "error", offersWritten: 0, tiersWritten: 0, historyPoints: 0, error: (e as Error).message };
    }
    if (res.status === "ok") {
      ok++;
      totalOffers += res.offersWritten;
      totalTiers += res.tiersWritten;
      totalHistory += res.historyPoints;
      if (resourceOffers) resourced++;
    } else if (res.status === "not_found") notFound++;
    else if (res.status === "logged_out") loggedOut++;
    else {
      errors++;
      if (errorSamples.length < 10) errorSamples.push({ id: (p as { id: string }).id, error: res.error });
    }
    await sb
      .from("tendances_index_basket")
      .update({
        last_scraped_at: new Date().toISOString(),
        last_scrape_status: res.status,
        last_scrape_error: res.error ?? null,
      })
      .eq("product_id", (p as { id: string }).id);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  if (logRow?.id) {
    await sb
      .from("qogita_price_scrape_logs")
      .update({
        ended_at: new Date().toISOString(),
        products_ok: ok,
        products_404: notFound,
        products_error: errors + loggedOut,
        points_upserted: totalHistory,
        offers_resourced: resourced,
        errors: errorSamples,
        notes:
          `storefront strategy=${sessionCache?.strategy ?? "unknown"} ` +
          `vendors_created=${stats.vendors_created} offers=${totalOffers} tiers=${totalTiers} ` +
          `retries=${stats.retries} logged_out=${loggedOut}`,
      })
      .eq("id", logRow.id);
  }

  return new Response(JSON.stringify({
    ok: true,
    strategy: sessionCache?.strategy ?? null,
    targeted: products?.length ?? 0,
    products_ok: ok,
    products_404: notFound,
    products_logged_out: loggedOut,
    products_error: errors,
    offers_written: totalOffers,
    tiers_written: totalTiers,
    vendors_created: stats.vendors_created,
    history_points: totalHistory,
    session_retries: stats.retries,
    elapsedMs: Date.now() - startedAt,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
