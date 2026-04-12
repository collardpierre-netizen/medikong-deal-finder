import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: newLog } = await supabase.from("sync_logs").insert({
    sync_type: "categories", status: "running", stats: {},
    progress_current: 0, progress_total: 0,
    progress_message: "Extraction des catégories depuis les produits...",
  }).select().single();
  const syncLogId = newLog!.id;

  try {
    // Extract unique categories from already-imported products
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("category_name, category_qid")
      .eq("source", "qogita")
      .eq("is_active", true)
      .not("category_name", "is", null);
    if (pErr) throw pErr;

    const uniqueCategories = new Map<string, string | null>();
    for (const p of (products || [])) {
      if (p.category_name) {
        // Extract the LEAF category name (last segment after ">")
        const rawName = p.category_name.trim();
        const leafName = rawName.includes(">")
          ? rawName.split(">").pop()!.trim()
          : rawName;
        if (leafName && !uniqueCategories.has(leafName)) {
          uniqueCategories.set(leafName, p.category_qid || null);
        }
      }
    }

    const categoriesRaw = Array.from(uniqueCategories.entries()).map(([name, qid]) => ({
      name,
      qogita_qid: qid,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      is_active: true,
      synced_at: new Date().toISOString(),
    }));
    // Deduplicate by slug to avoid "cannot affect a row a second time" error
    const categoriesData = [...new Map(categoriesRaw.map(c => [c.slug, c])).values()];

    const total = categoriesData.length;
    await supabase.from("sync_logs").update({
      progress_total: total,
      progress_message: `${total} catégories uniques trouvées dans ${products?.length || 0} produits`,
    }).eq("id", syncLogId);

    // Batch upsert
    for (let i = 0; i < categoriesData.length; i += 500) {
      const chunk = categoriesData.slice(i, i + 500);
      const { error } = await supabase.from("categories").upsert(chunk, {
        onConflict: "slug",
        ignoreDuplicates: false,
      });
      if (error) throw error;
    }

    // Resolve category_id on products
    await supabase.from("sync_logs").update({
      progress_message: "Résolution des category_id sur les produits...",
    }).eq("id", syncLogId);

    const { data: allCats } = await supabase.from("categories").select("id, qogita_qid, name");
    const catByQid = new Map((allCats || []).map(c => [c.qogita_qid, c.id]));
    const catByName = new Map((allCats || []).map(c => [c.name, c.id]));

    const { data: unlinked } = await supabase
      .from("products")
      .select("id, category_qid, category_name")
      .eq("source", "qogita")
      .is("category_id", null)
      .not("category_name", "is", null);

    if (unlinked && unlinked.length > 0) {
      for (const p of unlinked) {
        const catId = (p.category_qid && catByQid.get(p.category_qid)) || catByName.get(p.category_name);
        if (catId) {
          await supabase.from("products").update({ category_id: catId }).eq("id", p.id);
        }
      }
    }

    const stats = { categories_total: total, products_linked: unlinked?.length || 0, source_products: products?.length || 0 };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: total, progress_total: total,
      progress_message: `Terminé — ${total} catégories depuis ${products?.length || 0} produits`,
    }).eq("id", syncLogId);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync categories error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
      progress_message: `Erreur: ${error.message}`,
    }).eq("id", syncLogId);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
