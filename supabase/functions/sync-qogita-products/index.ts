import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK = 100;

async function getToken(sb: any) {
  const { data: c } = await sb.from("qogita_config").select("*").eq("id", 1).single();
  if (!c?.qogita_email || !c?.qogita_password) throw new Error("Qogita credentials missing");
  const base = c.base_url || "https://api.qogita.com";
  const r = await fetch(`${base}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: c.qogita_email, password: c.qogita_password }),
  });
  if (!r.ok) throw new Error(`Auth failed (${r.status})`);
  const { accessToken } = await r.json();
  if (!accessToken) throw new Error("No accessToken");
  await sb.from("qogita_config").update({ bearer_token: accessToken }).eq("id", 1);
  return { token: accessToken, baseUrl: base };
}

function sl(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function extractQid(url: string) { const m = url?.match(/\/products\/([a-f0-9]+)\//); return m?.[1] || null; }

function parseLine(line: string, headers: string[]): Record<string, string> {
  const vals: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  vals.push(cur.trim());
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) obj[headers[i]] = vals[i] || "";
  return obj;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let reqCountries: string[] | null = null;
  let single = false;
  try {
    const b = await req.json();
    if (b?.countries && Array.isArray(b.countries)) reqCountries = b.countries;
    if (b?.country) { reqCountries = [b.country]; single = true; }
  } catch { /* */ }

  const { data: sc } = await sb.from("countries").select("code, name, default_vat_rate")
    .eq("is_active", true).eq("qogita_sync_enabled", true).order("display_order");
  let countries = sc || [{ code: "BE", name: "Belgique", default_vat_rate: 21 }];
  if (reqCountries) countries = countries.filter((c: any) => reqCountries!.includes(c.code));

  if (countries.length === 0) {
    return new Response(JSON.stringify({ error: "No country to sync" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Always process only the FIRST country
  const ctry = countries[0] as any;
  const remaining = countries.slice(1).map((c: any) => c.code);

  // Create sync log immediately
  const { data: log } = await sb.from("sync_logs").insert({
    sync_type: "products", status: "running",
    stats: { country: ctry.code, countries_total: countries.length },
    progress_current: 0, progress_total: 0,
    progress_message: `${ctry.code}: démarrage en arrière-plan...`,
  }).select().single();

  const logId = log!.id;

  // Launch background processing via EdgeRuntime.waitUntil
  (globalThis as any).EdgeRuntime.waitUntil(
    syncCountry(sb, ctry, logId, remaining).catch(async (e: any) => {
      console.error("Background sync error:", e);
      await sb.from("sync_logs").update({
        status: "error", completed_at: new Date().toISOString(),
        error_message: e.message, progress_message: `Erreur: ${e.message}`,
      }).eq("id", logId);
      await sb.from("qogita_config").update({ sync_status: "error", sync_error_message: e.message }).eq("id", 1);
    })
  );

  // Return immediately
  return new Response(JSON.stringify({
    success: true,
    sync_log_id: logId,
    country: ctry.code,
    remaining_countries: remaining,
    message: `Sync ${ctry.code} lancée en arrière-plan. Suivez la progression via sync_logs.`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

async function syncCountry(sb: any, ctry: any, logId: string, remaining: string[]) {
  const { token, baseUrl } = await getToken(sb);
  const vat = ctry.default_vat_rate || 21;

  await sb.from("sync_logs").update({ progress_message: `${ctry.code}: téléchargement CSV...` }).eq("id", logId);

  const res = await fetch(`${baseUrl}/variants/search/download/?country=${ctry.code}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`CSV ${ctry.code}: ${res.status}`);

  // Stream the response to reduce memory: read as text but process line-by-line
  const csvText = await res.text();
  const nl = csvText.indexOf("\n");
  if (nl === -1) throw new Error("Empty CSV");
  const headers = csvText.substring(0, nl).split(",").map(h => h.trim().replace(/^"|"$/g, ""));

  // Split into lines — keep only raw strings
  const rawLines = csvText.substring(nl + 1).split("\n");
  // Free csvText reference
  const totalLines = rawLines.filter(l => l.trim()).length;

  await sb.from("sync_logs").update({
    progress_total: totalLines,
    progress_message: `${ctry.code}: ${totalLines} lignes, import...`,
  }).eq("id", logId);

  let processed = 0;
  const brandNames = new Set<string>();
  const catNames = new Set<string>();
  let lineIdx = 0;

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;
    lineIdx++;

    // Accumulate a mini-batch
    const batch: any[] = [];
    const statsBatch: any[] = [];
    let count = 0;

    // Process CHUNK lines at a time
    const startIdx = lineIdx - 1;
    // We already have rawLine for the first one
    let currentLines = [rawLine];
    // Grab more lines for the chunk
    let nextIdx = rawLines.indexOf(rawLine, startIdx) + 1;
    // Actually let's use a simpler approach — collect CHUNK lines
    break; // break out and use index-based loop instead
  }

  // Index-based loop for clean chunking
  const filteredLines: string[] = [];
  for (const l of rawLines) { if (l.trim()) filteredLines.push(l); }
  // Clear rawLines
  rawLines.length = 0;

  for (let i = 0; i < filteredLines.length; i += CHUNK) {
    const batch: any[] = [];
    const statsBatch: any[] = [];
    const end = Math.min(i + CHUNK, filteredLines.length);

    for (let j = i; j < end; j++) {
      const row = parseLine(filteredLines[j], headers);
      const name = row["Name"];
      if (!name) continue;
      const gtin = row["GTIN"] || "";
      const pUrl = row["Product URL"] || "";
      const id = extractQid(pUrl) || gtin || sl(name).slice(0, 32);
      if (!id) continue;

      const bn = row["Brand"] || null;
      const cn = row["Category"] || null;
      if (bn) brandNames.add(bn);
      if (cn) catNames.add(cn);

      const bp = parseFloat(row["€ Lowest Price inc. shipping"] || "0");
      const stock = parseInt(row["Total Inventory of All Offers"] || "0", 10);
      const sellers = parseInt(row["Number of Offers"] || "0", 10);
      const img = row["Image URL"] || "";
      const s = sl(name) + (gtin ? `-${gtin.slice(-6)}` : `-${id.slice(0, 6)}`);
      const pe = bp > 0 ? Math.round((bp / (1 + vat / 100)) * 100) / 100 : 0;

      batch.push({
        qogita_qid: id, gtin: gtin || null, name, slug: s,
        brand_name: bn, category_name: cn,
        image_urls: img ? [img] : [], source: "qogita",
        is_active: true, is_published: true, synced_at: new Date().toISOString(),
        total_stock: stock, offer_count: sellers, is_in_stock: stock > 0,
        ...(pe > 0 ? { best_price_excl_vat: pe, best_price_incl_vat: bp } : {}),
      });

      statsBatch.push({ qid: id, pe: pe > 0 ? pe : null, pi: bp > 0 ? bp : null, oc: sellers, ts: stock, iis: stock > 0 });
    }

    if (batch.length > 0) {
      const { error } = await sb.from("products").upsert(batch, { onConflict: "qogita_qid", ignoreDuplicates: false });
      if (error) throw error;
    }

    // Inline country stats
    if (statsBatch.length > 0) {
      const qids = statsBatch.map((s: any) => s.qid);
      const { data: prods } = await sb.from("products").select("id, qogita_qid").in("qogita_qid", qids);
      const m = new Map((prods || []).map((p: any) => [p.qogita_qid, p.id]));
      const toUp = statsBatch.filter((s: any) => m.has(s.qid)).map((s: any) => ({
        product_id: m.get(s.qid)!, country_code: ctry.code,
        best_price_excl_vat: s.pe, best_price_incl_vat: s.pi,
        offer_count: s.oc, total_stock: s.ts, min_delivery_days: null, is_in_stock: s.iis,
      }));
      if (toUp.length > 0) {
        await sb.from("product_country_stats").upsert(toUp, { onConflict: "product_id,country_code", ignoreDuplicates: false });
      }
    }

    processed += batch.length;
    if (i % (CHUNK * 3) === 0) {
      await sb.from("sync_logs").update({
        progress_current: processed,
        progress_message: `${ctry.code}: ${processed}/${totalLines}...`,
      }).eq("id", logId);
    }
  }

  // Brands
  await sb.from("sync_logs").update({ progress_message: `${ctry.code}: marques (${brandNames.size})...` }).eq("id", logId);
  const bd = Array.from(brandNames).map(n => ({ name: n, slug: sl(n), is_active: true, synced_at: new Date().toISOString() }));
  for (let j = 0; j < bd.length; j += 200) {
    await sb.from("brands").upsert(bd.slice(j, j + 200), { onConflict: "slug", ignoreDuplicates: true });
  }

  // Categories
  const cd = Array.from(catNames).map(n => ({ name: n, slug: sl(n), is_active: true, synced_at: new Date().toISOString() }));
  for (let j = 0; j < cd.length; j += 200) {
    await sb.from("categories").upsert(cd.slice(j, j + 200), { onConflict: "slug", ignoreDuplicates: true });
  }

  // Link brand_id & category_id
  await sb.from("sync_logs").update({ progress_message: `${ctry.code}: liaison marques/catégories...` }).eq("id", logId);
  const { data: ab } = await sb.from("brands").select("id, name");
  const bm = new Map((ab || []).map((b: any) => [b.name, b.id]));
  const { data: ac } = await sb.from("categories").select("id, name");
  const cm = new Map((ac || []).map((c: any) => [c.name, c.id]));

  const { data: nb } = await sb.from("products").select("id, brand_name").eq("source", "qogita").is("brand_id", null).not("brand_name", "is", null).limit(1000);
  if (nb?.length) {
    const byB = new Map<string, string[]>();
    for (const p of nb) { const bid = bm.get(p.brand_name); if (bid) { if (!byB.has(bid)) byB.set(bid, []); byB.get(bid)!.push(p.id); } }
    for (const [bid, pids] of byB) { for (let k = 0; k < pids.length; k += 100) await sb.from("products").update({ brand_id: bid }).in("id", pids.slice(k, k + 100)); }
  }

  const { data: nc } = await sb.from("products").select("id, category_name").eq("source", "qogita").is("category_id", null).not("category_name", "is", null).limit(1000);
  if (nc?.length) {
    const byC = new Map<string, string[]>();
    for (const p of nc) { const cid = cm.get(p.category_name); if (cid) { if (!byC.has(cid)) byC.set(cid, []); byC.get(cid)!.push(p.id); } }
    for (const [cid, pids] of byC) { for (let k = 0; k < pids.length; k += 100) await sb.from("products").update({ category_id: cid }).in("id", pids.slice(k, k + 100)); }
  }

  await sb.from("countries").update({ last_sync_at: new Date().toISOString() } as any).eq("code", ctry.code);

  // Mark completed
  await sb.from("sync_logs").update({
    status: "completed", completed_at: new Date().toISOString(),
    stats: { products: processed, brands: brandNames.size, categories: catNames.size, country: ctry.code, remaining: remaining },
    progress_current: processed, progress_total: totalLines,
    progress_message: remaining.length > 0
      ? `${ctry.code}: ${processed} produits. Restant: ${remaining.join(", ")}`
      : `${ctry.code}: ${processed} produits, ${brandNames.size} marques, ${catNames.size} catégories ✓`,
  }).eq("id", logId);

  await sb.from("qogita_config").update({ last_full_sync_at: new Date().toISOString(), sync_status: "completed" }).eq("id", 1);
}
