// ─────────────────────────────────────────────────────────────────────────────
// LOT 3 — Helpers Catalog Download Qogita (webhook + CSV).
//
// Volontairement modulaire et tolérant aux changements de schéma : les
// endpoints /public/webhooks/ et /public/buyers/catalog-downloads/ sont
// internes chez Qogita et peuvent bouger sans préavis.
// ─────────────────────────────────────────────────────────────────────────────
import { encryptSecret, decryptSecret } from "./secret-crypto.ts";
import { maybeDecrypt } from "./qogita-creds.ts";

export const QOGITA_API = "https://api.qogita.com";

export const CFG_WEBHOOK_QID = "qogita_webhook_qid";
export const CFG_WEBHOOK_SECRET = "qogita_webhook_signing_secret";
export const CFG_WEBHOOK_URL = "qogita_webhook_url";

// deno-lint-ignore no-explicit-any
type Sb = any;

/** Login JWT Qogita (mêmes credentials que Lot 1, stockés dans qogita_config). */
export async function qogitaLogin(sb: Sb): Promise<string> {
  const { data: rows } = await sb
    .from("qogita_config")
    .select("key, value")
    .in("key", ["qogita_email", "qogita_password"]);
  const cfg: Record<string, string> = {};
  (rows || []).forEach((r: { key: string; value: string }) => { cfg[r.key] = r.value; });
  const email = cfg.qogita_email;
  const password = await maybeDecrypt(cfg.qogita_password);
  if (!email || !password) throw new Error("Credentials Qogita manquants (qogita_config)");

  const res = await fetch(`${QOGITA_API}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login Qogita ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const token = json.accessToken ?? json.access ?? json.token;
  if (!token) throw new Error("Login Qogita : token absent de la réponse");
  return token as string;
}

export async function readConfig(sb: Sb, key: string): Promise<string | null> {
  const { data } = await sb.from("qogita_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function writeConfig(sb: Sb, key: string, value: string): Promise<void> {
  await sb.from("qogita_config").upsert({ key, value }, { onConflict: "key" });
}

/** Le signing secret n'est renvoyé qu'une fois → chiffré au repos comme le mot de passe. */
export async function storeSigningSecret(sb: Sb, secret: string): Promise<void> {
  const key = Deno.env.get("QOGITA_ENC_KEY") ?? "";
  const value = key ? await encryptSecret(secret, key) : secret;
  await writeConfig(sb, CFG_WEBHOOK_SECRET, value);
}

export async function loadSigningSecret(sb: Sb): Promise<string | null> {
  const raw = await readConfig(sb, CFG_WEBHOOK_SECRET);
  if (!raw) return null;
  if (raw.startsWith("v1.")) {
    const key = Deno.env.get("QOGITA_ENC_KEY") ?? "";
    if (!key) throw new Error("QOGITA_ENC_KEY absent : impossible de déchiffrer le signing secret");
    return await decryptSecret(raw, key);
  }
  return raw;
}

// ── Vérification de signature ───────────────────────────────────────────────
const enc = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<{ hex: string; b64: string }> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  const b64 = btoa(String.fromCharCode(...sig));
  return { hex, b64 };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SIGNATURE_HEADERS = [
  "qogita-signature", "x-qogita-signature", "webhook-signature", "x-webhook-signature", "x-signature",
];
const TIMESTAMP_HEADERS = [
  "qogita-timestamp", "x-qogita-timestamp", "webhook-timestamp", "x-webhook-timestamp", "x-timestamp",
];
const ID_HEADERS = ["qogita-id", "x-qogita-id", "webhook-id", "x-webhook-id"];

function pickHeader(req: Request, names: string[]): string | null {
  for (const n of names) {
    const v = req.headers.get(n);
    if (v) return v;
  }
  return null;
}

/**
 * Vérifie la signature HMAC-SHA256 d'un événement entrant.
 * Tolérant au format exact (hex ou base64, préfixes `v1=` / `t=…,v1=…`,
 * payload signé = body seul, `timestamp.body` ou `id.timestamp.body`) :
 * une seule de ces combinaisons doit matcher. Toute requête sans signature
 * valide est rejetée.
 */
export async function verifyWebhookSignature(
  req: Request,
  rawBody: string,
  secret: string,
): Promise<{ ok: boolean; reason?: string }> {
  const header = pickHeader(req, SIGNATURE_HEADERS);
  if (!header) return { ok: false, reason: "missing_signature_header" };

  // Extrait les candidats : "abc", "v1=abc", "t=123,v1=abc", "v1,abc"
  const candidates: string[] = [];
  let headerTimestamp: string | null = null;
  for (const part of header.split(/[,\s]+/).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      const k = part.slice(0, eq);
      const v = part.slice(eq + 1);
      if (k === "t") headerTimestamp = v;
      else candidates.push(v);
    } else {
      candidates.push(part);
    }
  }
  if (candidates.length === 0) return { ok: false, reason: "no_signature_value" };

  const ts = headerTimestamp ?? pickHeader(req, TIMESTAMP_HEADERS);
  const id = pickHeader(req, ID_HEADERS);

  const payloads = [rawBody];
  if (ts) payloads.push(`${ts}.${rawBody}`);
  if (id && ts) payloads.push(`${id}.${ts}.${rawBody}`);

  for (const payload of payloads) {
    const { hex, b64 } = await hmac(secret, payload);
    for (const cand of candidates) {
      if (timingSafeEqual(cand.toLowerCase(), hex) || timingSafeEqual(cand, b64)) return { ok: true };
    }
  }
  return { ok: false, reason: "signature_mismatch" };
}

// ── Parsing CSV (RFC4180 : guillemets, virgules et retours ligne échappés) ──
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { record.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { record.push(field); records.push(record); record = []; field = ""; continue; }
    field += c;
  }
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }

  if (records.length === 0) return { columns: [], rows: [] };
  const columns = records[0].map((c) => c.trim());
  const rows = records.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      columns.forEach((col, idx) => { obj[col] = (r[idx] ?? "").trim(); });
      return obj;
    });
  return { columns, rows };
}

// ── Normalisation d'une ligne CSV → référentiel ─────────────────────────────
// Tolérante aux renommages de colonnes : on essaie plusieurs alias.
function pick(row: Record<string, string>, aliases: string[]): string | null {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const k = keys.find((kk) => norm(kk) === norm(alias));
    if (k && row[k] !== "") return row[k];
  }
  return null;
}

function toNumber(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface CatalogItemNormalized {
  gtin: string;
  qogita_fid: string | null;
  name: string | null;
  brand_name: string | null;
  category_slug: string | null;
  category_name: string | null;
  /** ⚠️ Prix PLANCHER indicatif (gros volume, shipping inclus) — jamais un coût d'achat. */
  indicative_price: number | null;
  indicative_price_currency: string;
  inventory: number | null;
  supplier_alias: string | null;
  supplier_url: string | null;
  unit_size: number | null;
  raw: Record<string, string>;
}

export function normalizeCatalogRow(row: Record<string, string>): CatalogItemNormalized | null {
  const gtin = pick(row, ["gtin", "ean", "barcode", "productgtin"]);
  if (!gtin) return null;
  return {
    gtin,
    qogita_fid: pick(row, ["fid", "variantfid", "qogitafid", "qid"]),
    name: pick(row, ["name", "productname", "title"]),
    brand_name: pick(row, ["brand", "brandname"]),
    category_slug: pick(row, ["categoryslug", "category_slug"]),
    category_name: pick(row, ["category", "categoryname"]),
    indicative_price: toNumber(pick(row, [
      "€ Lowest Price inc. shipping", "lowestpriceincshipping", "lowestpriceinclshipping",
      "lowestprice", "priceinclshipping", "price",
    ])),
    indicative_price_currency: pick(row, ["currency", "currencycode"]) ?? "EUR",
    inventory: toNumber(pick(row, [
      "inventory", "Total Inventory of All Offers", "Lowest Priced Offer Inventory",
      "stock", "quantity", "availablequantity",
    ])) ?? null,
    supplier_alias: pick(row, ["supplieralias", "selleralias", "supplier"]),
    supplier_url: pick(row, ["Product Link", "supplierlink", "supplierurl", "link", "url"]),
    unit_size: toNumber(pick(row, ["unitsize", "unit"])) ?? null,
    raw: row,
  };
}
