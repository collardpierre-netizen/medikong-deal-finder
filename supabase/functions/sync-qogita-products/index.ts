import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string; config: any }> {
  const { data: config } = await supabaseClient
    .from("qogita_config")
    .select("*")
    .eq("id", 1)
    .single();

  if (!config) throw new Error("qogita_config not found");
  if (!config.qogita_email || !config.qogita_password) {
    throw new Error("Qogita email/password not configured — go to Sync Qogita settings");
  }

  const baseUrl = config.base_url || "https://api.qogita.com";

  const authResponse = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: config.qogita_email,
      password: config.qogita_password,
    }),
  });

  if (!authResponse.ok) {
    const error = await authResponse.text();
    throw new Error(`Qogita auth failed (${authResponse.status}): ${error}`);
  }

  const authData = await authResponse.json();
  const token = authData.accessToken;
  if (!token) throw new Error("No accessToken in Qogita auth response");

  await supabaseClient
    .from("qogita_config")
    .update({ bearer_token: token })
    .eq("id", 1);

  return { token, baseUrl, config };
}

function parseCSV(text: string): any[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values: string[] = [];
    let current = "", inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    values.push(current.trim());
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: syncLog } = await supabase.from("sync_logs").insert({
    sync_type: "products", status: "running", stats: {},
    progress_current: 0,
    progress_total: 0,
    progress_message: "Authentification Qogita...",
  }).select().single();

  try {
    const { token, baseUrl, config } = await getQogitaToken(supabase);
    const country = config.default_country || "BE";

    // Phase 1: Download CSV
    await supabase.from("sync_logs").update({
      progress_message: "Téléchargement CSV...",
    }).eq("id", syncLog?.id);

    const csvUrl = `${baseUrl}/variants/search/download/?country=${country}`;
    const res = await fetch(csvUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
    });
    if (!res.ok) throw new Error(`Qogita CSV download failed ${res.status}: ${await res.text()}`);

    // Phase 2: Parse CSV
    await supabase.from("sync_logs").update({
      progress_current: 0,
      progress_total: 100,
      progress_message: "Parsing CSV...",
    }).eq("id", syncLog?.id);

    const csvText = await res.text();
    const rows = parseCSV(csvText);

    await supabase.from("sync_logs").update({
      progress_total: rows.length,
      progress_message: `${rows.length} produits trouvés dans le CSV`,
    }).eq("id", syncLog?.id);

    let created = 0, updated = 0, skipped = 0;
    const processedQids = new Set<string>();

    // Pre-load category and brand maps
    const { data: categories } = await supabase.from("categories").select("id, qogita_qid");
    const { data: brands } = await supabase.from("brands").select("id, qogita_qid");
    const catMap = new Map((categories || []).map(c => [c.qogita_qid, c.id]));
    const brandMap = new Map((brands || []).map(b => [b.qogita_qid, b.id]));

    // Phase 3: Import products
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const qid = row.qid || row.variantQid || row.variant_qid;
      if (!qid) { skipped++; continue; }
      processedQids.add(qid);

      const gtin = row.gtin || row.ean || "";
      const name = row.name || row.title || row.productName || "";
      if (!name) { skipped++; continue; }

      const slug = slugify(name) + (gtin ? `-${gtin.slice(-6)}` : `-${qid.slice(0, 6)}`);

      const categoryQid = row.categoryQid || row.category_qid || "";
      const brandQid = row.brandQid || row.brand_qid || "";

      const productRow: any = {
        qogita_qid: qid,
        qogita_fid: row.familyQid || row.family_qid || null,
        gtin: gtin || null,
        name,
        slug,
        description: row.description || null,
        short_description: row.shortDescription || row.short_description || null,
        label: row.label || null,
        category_id: catMap.get(categoryQid) || null,
        brand_id: brandMap.get(brandQid) || null,
        image_urls: row.imageUrl ? [row.imageUrl] : [],
        origin_country: row.originCountry || row.origin_country || null,
        source: "qogita",
        is_active: true,
        is_published: true,
        synced_at: new Date().toISOString(),
      };

      const bestPrice = parseFloat(row.bestPrice || row.best_price || "0");
      const stockQty = parseInt(row.totalStock || row.total_stock || "0", 10);
      const sellerCount = parseInt(row.sellerCount || row.seller_count || row.offerCount || "0", 10);

      if (bestPrice > 0) {
        productRow.best_price_excl_vat = bestPrice;
        productRow.best_price_incl_vat = Math.round(bestPrice * 1.21 * 100) / 100;
      }
      productRow.total_stock = stockQty;
      productRow.offer_count = sellerCount;
      productRow.is_in_stock = stockQty > 0;

      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("qogita_qid", qid)
        .maybeSingle();

      if (existing) {
        await supabase.from("products").update(productRow).eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("products").insert(productRow);
        created++;
      }

      // Update progress every 50 items
      if ((i + 1) % 50 === 0 || i === rows.length - 1) {
        await supabase.from("sync_logs").update({
          progress_current: i + 1,
          progress_total: rows.length,
          progress_message: `Import produits ${i + 1}/${rows.length} (${created} créés, ${updated} mis à jour, ${skipped} ignorés)`,
        }).eq("id", syncLog?.id);
      }
    }

    // Mark absent products as out of stock
    await supabase.from("sync_logs").update({
      progress_message: "Désactivation des produits absents...",
    }).eq("id", syncLog?.id);

    const { data: qProducts } = await supabase
      .from("products")
      .select("id, qogita_qid")
      .eq("source", "qogita")
      .eq("is_active", true);

    let deactivated = 0;
    for (const p of (qProducts || [])) {
      if (p.qogita_qid && !processedQids.has(p.qogita_qid)) {
        await supabase.from("products").update({ is_in_stock: false, total_stock: 0 }).eq("id", p.id);
        deactivated++;
      }
    }

    const stats = { total: rows.length, created, updated, skipped, deactivated };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: rows.length,
      progress_total: rows.length,
      progress_message: `Terminé — ${rows.length} produits (${created} créés, ${updated} mis à jour, ${deactivated} désactivés)`,
    }).eq("id", syncLog?.id);

    await supabase.from("qogita_config").update({
      last_full_sync_at: new Date().toISOString(),
      sync_status: "completed",
    }).eq("id", 1);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync products error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
      progress_message: `Erreur: ${error.message}`,
    }).eq("id", syncLog?.id);
    await supabase.from("qogita_config").update({
      sync_status: "error", sync_error_message: error.message,
    }).eq("id", 1);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
