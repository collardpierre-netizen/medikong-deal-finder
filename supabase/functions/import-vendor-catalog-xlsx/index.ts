// Edge Function: import-vendor-catalog-xlsx
// Parses an XLSX file uploaded by a vendor and:
//  - upserts offers for known products (matched via GTIN or CNK)
//  - creates product_submissions for unknown SKUs
//
// Auth: requires a logged-in vendor (auth.uid mapped to vendors.auth_user_id)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

type RawRow = Record<string, unknown>;

// Header normalization: lower-cased, trimmed, accents stripped, non-alpha removed
function normHeader(h: string): string {
  return h
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const HEADER_MAP: Record<string, string> = {
  // identifiers
  gtin: "gtin", ean: "gtin", ean13: "gtin", barcode: "gtin", codebarre: "gtin", codebarres: "gtin",
  cnk: "cnk", cnkcode: "cnk", codecnk: "cnk",
  sku: "sku", reference: "sku", ref: "sku",
  // descriptive
  name: "name", nom: "name", productname: "name", libelle: "name", designation: "name", description: "name",
  brand: "brand", marque: "brand", brandname: "brand",
  manufacturer: "manufacturer", fabricant: "manufacturer", manufacturername: "manufacturer",
  // commercial
  price: "price", prix: "price", priceht: "price", prixht: "price", priceexclvat: "price", prixhtva: "price",
  pricettc: "price_ttc", pricetva: "price_ttc", priceinclvat: "price_ttc", prixttc: "price_ttc", prixtvac: "price_ttc",
  vat: "vat", tva: "vat", vatrate: "vat", tauxtva: "vat",
  stock: "stock", quantity: "stock", qty: "stock", quantite: "stock", stockquantity: "stock",
  moq: "moq", minorder: "moq", quantitemin: "moq",
  mov: "mov", minordervalue: "mov",
  delivery: "delivery_days", deliverydays: "delivery_days", delai: "delivery_days", delailivraison: "delivery_days",
  notes: "notes", note: "notes", commentaire: "notes",
};

function pickField(row: RawRow, normalizedKeys: Record<string, string>, target: string): unknown {
  for (const [origKey, normKey] of Object.entries(normalizedKeys)) {
    if (HEADER_MAP[normKey] === target) {
      const v = row[origKey];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }
  return undefined;
}

function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n == null ? null : Math.max(0, Math.floor(n));
}

function cleanGtin(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const digits = String(v).trim().replace(/\s/g, "").replace(/^0+/, "");
  return /^\d{6,14}$/.test(digits) ? digits : null;
}

function cleanCnk(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s|-/g, "");
  return s.length > 0 ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // Auth: validate JWT and resolve vendor
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, country_code, name")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!vendor?.id) return json({ error: "Vendor profile not found" }, 403);

    // Body: multipart with `file` field, OR JSON { fileBase64, fileName, dryRun, countryCode }
    const ct = req.headers.get("content-type") ?? "";
    let buffer: Uint8Array | null = null;
    let fileName = "catalog.xlsx";
    let dryRun = false;
    let countryCode = vendor.country_code ?? "BE";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "Missing file" }, 400);
      if (file.size > 10 * 1024 * 1024) return json({ error: "File too large (max 10MB)" }, 413);
      fileName = file.name || fileName;
      buffer = new Uint8Array(await file.arrayBuffer());
      dryRun = String(form.get("dryRun") ?? "") === "true";
      const cc = String(form.get("countryCode") ?? "").trim().toUpperCase();
      if (cc) countryCode = cc;
    } else if (ct.includes("application/json")) {
      const body = await req.json();
      if (!body?.fileBase64) return json({ error: "Missing fileBase64" }, 400);
      const bin = atob(String(body.fileBase64));
      buffer = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
      if (buffer.length > 10 * 1024 * 1024) return json({ error: "File too large (max 10MB)" }, 413);
      fileName = body.fileName ?? fileName;
      dryRun = !!body.dryRun;
      if (body.countryCode) countryCode = String(body.countryCode).toUpperCase();
    } else {
      return json({ error: "Unsupported content-type" }, 415);
    }

    // Parse XLSX
    let rows: RawRow[];
    try {
      const wb = XLSX.read(buffer!, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: true });
    } catch (e) {
      return json({ error: "Invalid XLSX file", detail: String(e) }, 400);
    }
    if (!rows.length) return json({ error: "Empty sheet" }, 400);
    if (rows.length > 5000) return json({ error: "Too many rows (max 5000)" }, 413);

    // Build normalized header map from first row keys
    const normalizedKeys: Record<string, string> = {};
    for (const k of Object.keys(rows[0])) normalizedKeys[k] = normHeader(k);

    // Pre-collect identifiers for batch lookup
    type ParsedRow = {
      idx: number;
      gtin: string | null;
      cnk: string | null;
      sku: string | null;
      name: string | null;
      brand: string | null;
      manufacturer: string | null;
      price: number | null;
      priceTtc: number | null;
      vat: number | null;
      stock: number | null;
      moq: number | null;
      mov: number | null;
      deliveryDays: number | null;
      notes: string | null;
    };

    const parsed: ParsedRow[] = rows.map((r, i) => ({
      idx: i + 2, // +2 to account for header row + 1-based
      gtin: cleanGtin(pickField(r, normalizedKeys, "gtin")),
      cnk: cleanCnk(pickField(r, normalizedKeys, "cnk")),
      sku: (pickField(r, normalizedKeys, "sku") as string | undefined)?.toString().trim() || null,
      name: (pickField(r, normalizedKeys, "name") as string | undefined)?.toString().trim() || null,
      brand: (pickField(r, normalizedKeys, "brand") as string | undefined)?.toString().trim() || null,
      manufacturer:
        (pickField(r, normalizedKeys, "manufacturer") as string | undefined)?.toString().trim() || null,
      price: toNum(pickField(r, normalizedKeys, "price")),
      priceTtc: toNum(pickField(r, normalizedKeys, "price_ttc")),
      vat: toNum(pickField(r, normalizedKeys, "vat")),
      stock: toInt(pickField(r, normalizedKeys, "stock")),
      moq: toInt(pickField(r, normalizedKeys, "moq")),
      mov: toNum(pickField(r, normalizedKeys, "mov")),
      deliveryDays: toInt(pickField(r, normalizedKeys, "delivery_days")),
      notes: (pickField(r, normalizedKeys, "notes") as string | undefined)?.toString().trim() || null,
    }));

    const gtins = [...new Set(parsed.map((p) => p.gtin).filter(Boolean) as string[])];
    const cnks = [...new Set(parsed.map((p) => p.cnk).filter(Boolean) as string[])];

    // Batch lookup products
    const productByGtin = new Map<string, { id: string; vat_rate_be: number | null }>();
    const productByCnk = new Map<string, { id: string; vat_rate_be: number | null }>();
    if (gtins.length) {
      const { data, error } = await admin
        .from("products")
        .select("id, gtin, vat_rate_be")
        .in("gtin", gtins);
      if (error) throw error;
      (data ?? []).forEach((p) => p.gtin && productByGtin.set(p.gtin, p));
    }
    if (cnks.length) {
      const { data, error } = await admin
        .from("products")
        .select("id, cnk_code, vat_rate_be")
        .in("cnk_code", cnks);
      if (error) throw error;
      (data ?? []).forEach((p: any) => p.cnk_code && productByCnk.set(p.cnk_code, p));
    }

    // Categorize
    const offerRows: any[] = [];
    const submissionRows: any[] = [];
    const errors: { line: number; reason: string }[] = [];
    let matched = 0;
    let unmatched = 0;
    let skipped = 0;

    for (const r of parsed) {
      // need at least one identifier
      if (!r.gtin && !r.cnk && !r.sku && !r.name) {
        skipped++;
        errors.push({ line: r.idx, reason: "Aucun identifiant ni nom" });
        continue;
      }

      const product = (r.gtin && productByGtin.get(r.gtin)) || (r.cnk && productByCnk.get(r.cnk)) || null;

      if (product) {
        // Need at least a price to upsert offer
        const vatRate = r.vat ?? Number(product.vat_rate_be ?? 21);
        let priceExcl = r.price;
        let priceIncl = r.priceTtc;
        if (priceExcl == null && priceIncl != null) {
          priceExcl = +(priceIncl / (1 + vatRate / 100)).toFixed(4);
        }
        if (priceIncl == null && priceExcl != null) {
          priceIncl = +(priceExcl * (1 + vatRate / 100)).toFixed(2);
        }
        if (priceExcl == null || priceExcl <= 0) {
          skipped++;
          errors.push({ line: r.idx, reason: "Prix HT manquant ou invalide" });
          continue;
        }

        const stock = r.stock ?? 0;
        offerRows.push({
          product_id: product.id,
          vendor_id: vendor.id,
          country_code: countryCode,
          price_excl_vat: priceExcl,
          price_incl_vat: priceIncl ?? +(priceExcl * (1 + vatRate / 100)).toFixed(2),
          vat_rate: vatRate,
          stock_quantity: stock,
          stock_status: stock > 0 ? "in_stock" : "out_of_stock",
          moq: r.moq ?? 1,
          mov: r.mov,
          delivery_days: r.deliveryDays ?? undefined,
          is_active: true,
          synced_at: new Date().toISOString(),
        });
        matched++;
      } else {
        // No match: queue submission (require at least name OR gtin)
        if (!r.name && !r.gtin && !r.cnk) {
          skipped++;
          continue;
        }
        submissionRows.push({
          vendor_id: vendor.id,
          status: "submitted",
          proposed_payload: {
            line: r.idx,
            source: "xlsx_import",
            file_name: fileName,
            product_name: r.name ?? `Produit GTIN ${r.gtin ?? r.cnk ?? r.sku}`,
            brand_name: r.brand,
            manufacturer_name: r.manufacturer,
            gtin: r.gtin,
            cnk_code: r.cnk,
            sku: r.sku,
            price_excl_vat: r.price,
            price_incl_vat: r.priceTtc,
            vat_rate: r.vat,
            stock_quantity: r.stock,
            moq: r.moq,
            mov: r.mov,
            delivery_days: r.deliveryDays,
            notes: r.notes,
          },
        });
        unmatched++;
      }
    }

    let offersUpserted = 0;
    let submissionsCreated = 0;

    if (!dryRun) {
      // Upsert offers in chunks
      const CHUNK = 200;
      for (let i = 0; i < offerRows.length; i += CHUNK) {
        const slice = offerRows.slice(i, i + CHUNK);
        const { error } = await admin
          .from("offers")
          .upsert(slice, { onConflict: "product_id,vendor_id,country_code" });
        if (error) {
          errors.push({ line: 0, reason: `Upsert offers: ${error.message}` });
        } else {
          offersUpserted += slice.length;
        }
      }

      // Insert submissions in chunks
      for (let i = 0; i < submissionRows.length; i += CHUNK) {
        const slice = submissionRows.slice(i, i + CHUNK);
        const { error } = await admin.from("product_submissions").insert(slice);
        if (error) {
          errors.push({ line: 0, reason: `Insert submissions: ${error.message}` });
        } else {
          submissionsCreated += slice.length;
        }
      }
    }

    return json({
      ok: true,
      dryRun,
      vendor_id: vendor.id,
      file_name: fileName,
      country_code: countryCode,
      totals: {
        rows_total: parsed.length,
        matched,
        unmatched,
        skipped,
      },
      offers_upserted: offersUpserted,
      submissions_created: submissionsCreated,
      errors: errors.slice(0, 200),
    });
  } catch (e) {
    console.error("import-vendor-catalog-xlsx error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
