// MEDIKONG — Quick Order · supabase/functions/quick-order/_shared.ts
// Environnement, client Supabase, CORS et utilitaires de calcul.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
export const IP_SALT = Deno.env.get("IP_SALT") ?? "change-me";
export const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL") ?? "";
export const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";

export const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(IP_SALT + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Prix unitaire effectif : le palier le plus avantageux atteint par la quantité. */
export function effectiveUnitPrice(item: OfferItem, qty: number): number {
  let price = item.unit_price_cents;
  const tiers = Array.isArray(item.tiers) ? item.tiers : [];
  for (const t of tiers) {
    if (typeof t?.min_qty === "number" && qty >= t.min_qty &&
        typeof t?.unit_price_cents === "number") {
      price = Math.min(price, t.unit_price_cents);
    }
  }
  return price;
}

/** Unités gratuites : "12+2" → 2 offertes par tranche de 12 commandées. */
export function freeUnits(item: OfferItem, qty: number): number {
  const m = /^(\d+)\s*\+\s*(\d+)$/.exec(item.free_units_offer ?? "");
  if (!m) return 0;
  const base = parseInt(m[1], 10);
  const bonus = parseInt(m[2], 10);
  if (!base || !bonus) return 0;
  return Math.floor(qty / base) * bonus;
}

export const HOLIDAYS = new Set<string>([
  // "2026-11-11", "2026-12-25", ...
]);

export function estimatedDelivery(cutoffHour: number, leadDays: number) {
  const nowBrussels = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Brussels" }),
  );
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const isWorkday = (d: Date) =>
    d.getDay() !== 0 && d.getDay() !== 6 && !HOLIDAYS.has(iso(d));

  const d = new Date(nowBrussels);
  const afterCutoff = nowBrussels.getHours() >= cutoffHour;

  if (afterCutoff || !isWorkday(d)) {
    do { d.setDate(d.getDate() + 1); } while (!isWorkday(d));
  }
  for (let i = 0; i < leadDays; i++) {
    do { d.setDate(d.getDate() + 1); } while (!isWorkday(d));
  }

  return {
    date: iso(d),
    label: d.toLocaleDateString("fr-BE", {
      weekday: "long", day: "numeric", month: "long",
    }),
    ships_today: !afterCutoff && isWorkday(nowBrussels),
    cutoff_hour: cutoffHour,
  };
}

export function reference(campaignCode: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  const suffix = [...rnd].map((b) => alphabet[b % alphabet.length]).join("");
  const short = campaignCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return `QO-${short}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Parcours groupement (Dynaphar) — utilitaires additifs.
// Rien ici n'est utilisé par le parcours par token existant.
// ---------------------------------------------------------------------------

/** Comparaison à temps constant de deux chaînes (code d'accès). */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  // Longueurs différentes : on compare quand même pour ne pas fuir la longueur.
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length, 1);
  for (let i = 0; i < n; i++) {
    diff |= (ea[i % (ea.length || 1)] ?? 0) ^ (eb[i % (eb.length || 1)] ?? 0);
  }
  return diff === 0;
}

export const normalizeEmail = (v: unknown): string =>
  typeof v === "string" ? v.trim().toLowerCase() : "";

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v) && v.length <= 190;
}

/** BCE belge : 10 chiffres, commence par 0 ou 1, modulo 97 sur les 8 premiers. */
export function isValidBce(v: string): boolean {
  const d = (v ?? "").replace(/[^0-9]/g, "");
  if (!/^[01]\d{9}$/.test(d)) return false;
  const base = Number(d.slice(0, 8));
  const check = Number(d.slice(8));
  return 97 - (base % 97) === check;
}

export const digitsOnly = (v: unknown): string =>
  typeof v === "string" ? v.replace(/[^0-9]/g, "") : "";

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Clé anti-course : destinataire + lignes normalisées triées + compartiment
 * de 10 minutes. L'index UNIQUE sur qo_orders.dedupe_key fait l'arbitrage.
 */
export async function dedupeKey(
  recipientId: string,
  lines: Array<{ item_id: string; qty: number }>,
): Promise<string> {
  const normalized = lines
    .map((l) => `${l.item_id}:${l.qty}`)
    .sort()
    .join("|");
  const bucket = Math.floor(Date.now() / 1000 / 600);
  return await sha256Hex(`${recipientId}#${normalized}#${bucket}`);
}

export type OfferItem = {
  id: string;
  position: number;
  cnk: string | null;
  ean: string | null;
  name: string;
  brand: string | null;
  pack_size: string | null;
  category: string | null;
  image_url: string | null;
  vat_rate: number;
  unit_price_cents: number;
  market_price_cents: number | null;
  public_price_cents: number | null;
  free_units_offer: string | null;
  min_qty: number;
  step_qty: number;
  max_qty: number | null;
  stock_qty: number | null;
  availability: "in_stock" | "prospecting" | "incoming";
  eta_label: string | null;
  packaging_languages: string[];
  min_expiry_date: string | null;
  origin_country: string | null;
  supply_type: string | null;
  batch_doc_available: boolean;
  short_expiry_date: string | null;
  tiers: Array<{ min_qty: number; unit_price_cents: number }>;
  active: boolean;
};
