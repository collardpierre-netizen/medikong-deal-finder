import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: newLog } = await supabase.from("sync_logs").insert({
    sync_type: "brands", status: "running", stats: {},
    progress_current: 0, progress_total: 0,
    progress_message: "Extraction des marques depuis les produits...",
  }).select().single();
  const syncLogId = newLog!.id;

  try {
    // Extract unique brands from already-imported products
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("brand_name, brand_qid")
      .eq("source", "qogita")
      .eq("is_active", true)
      .not("brand_name", "is", null);
    if (pErr) throw pErr;

    const uniqueBrands = new Map<string, string | null>();
    for (const p of (products || [])) {
      if (p.brand_name && !uniqueBrands.has(p.brand_name)) {
        uniqueBrands.set(p.brand_name, p.brand_qid || null);
      }
    }

    const brandsData = Array.from(uniqueBrands.entries()).map(([name, qid]) => ({
      name,
      qogita_qid: qid,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      is_active: true,
      synced_at: new Date().toISOString(),
    }));

    const total = brandsData.length;
    await supabase.from("sync_logs").update({
      progress_total: total,
      progress_message: `${total} marques uniques trouvées dans ${products?.length || 0} produits`,
    }).eq("id", syncLogId);

    // Batch upsert in chunks of 500
    for (let i = 0; i < brandsData.length; i += 500) {
      const chunk = brandsData.slice(i, i + 500);
      const { error } = await supabase.from("brands").upsert(chunk, {
        onConflict: "slug",
        ignoreDuplicates: false,
      });
      if (error) throw error;

      await supabase.from("sync_logs").update({
        progress_current: Math.min(i + 500, total),
        progress_message: `Upsert ${Math.min(i + 500, total)}/${total} marques`,
      }).eq("id", syncLogId);
    }

    // Resolve brand_id on products
    await supabase.from("sync_logs").update({
      progress_message: "Résolution des brand_id sur les produits...",
    }).eq("id", syncLogId);

    const { data: allBrands } = await supabase.from("brands").select("id, qogita_qid, name");
    const brandByQid = new Map((allBrands || []).map(b => [b.qogita_qid, b.id]));
    const brandByName = new Map((allBrands || []).map(b => [b.name, b.id]));

    // Batch update products with brand_id — use brand_qid first, fallback to brand_name
    const { data: unlinked } = await supabase
      .from("products")
      .select("id, brand_qid, brand_name")
      .eq("source", "qogita")
      .is("brand_id", null)
      .not("brand_name", "is", null);

    if (unlinked && unlinked.length > 0) {
      for (let i = 0; i < unlinked.length; i += 200) {
        const chunk = unlinked.slice(i, i + 200);
        for (const p of chunk) {
          const brandId = (p.brand_qid && brandByQid.get(p.brand_qid)) || brandByName.get(p.brand_name);
          if (brandId) {
            await supabase.from("products").update({ brand_id: brandId }).eq("id", p.id);
          }
        }
      }
    }

    const stats = { brands_total: total, products_linked: unlinked?.length || 0, source_products: products?.length || 0 };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: total, progress_total: total,
      progress_message: `Terminé — ${total} marques depuis ${products?.length || 0} produits`,
    }).eq("id", syncLogId);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync brands error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
      progress_message: `Erreur: ${error.message}`,
    }).eq("id", syncLogId);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
