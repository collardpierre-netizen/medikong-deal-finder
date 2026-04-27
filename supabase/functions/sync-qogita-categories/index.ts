import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  type FieldSpec,
  formatDbError,
  partitionValidRecords,
  sampleValue,
} from "../_shared/sync-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_SPECS: FieldSpec[] = [
  { field: "name", expected: "non-empty string", required: true, hint: "leaf segment of products.category_name" },
  { field: "slug", expected: "non-empty string", required: true, hint: "auto-derived from name" },
  { field: "is_active", expected: "boolean", required: true },
];

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
    const dedupedBySlug = [...new Map(categoriesRaw.map(c => [c.slug, c])).values()];
    const skippedDuplicate = categoriesRaw.length - dedupedBySlug.length;

    // Validate so we can clearly log which catégorie pose problème
    const { valid: categoriesData, invalid: invalidCats } = partitionValidRecords(
      "qogita.categories",
      dedupedBySlug,
      CATEGORY_SPECS,
      "name",
    );
    if (invalidCats.length > 0) {
      console.warn(`[qogita.categories] ${invalidCats.length} catégories invalides ignorées (voir issues ci-dessus).`);
    }

    const total = categoriesData.length;
    await supabase.from("sync_logs").update({
      progress_total: total,
      progress_message: `${total} catégories valides (${invalidCats.length} invalides, ${skippedDuplicate} doublons) trouvées dans ${products?.length || 0} produits`,
    }).eq("id", syncLogId);

    // Batch upsert
    let upsertErrors = 0;
    for (let i = 0; i < categoriesData.length; i += 500) {
      const chunk = categoriesData.slice(i, i + 500);
      const { error } = await supabase.from("categories").upsert(chunk, {
        onConflict: "slug",
        ignoreDuplicates: false,
      });
      if (error) {
        upsertErrors++;
        console.error(formatDbError("qogita.categories.upsert", error, {
          chunk_start: i,
          chunk_size: chunk.length,
          first_row_sample: sampleValue(chunk[0], 200),
        }));
        // On chunk error, retry one-by-one to surface the offending row(s)
        for (const row of chunk) {
          const { error: oneErr } = await supabase.from("categories").upsert(row, {
            onConflict: "slug", ignoreDuplicates: false,
          });
          if (oneErr) {
            console.error(formatDbError("qogita.categories.upsert.one", oneErr, {
              name: row.name, slug: row.slug, qogita_qid: row.qogita_qid,
            }));
          }
        }
      }
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

    let linkedCount = 0;
    let linkErrors = 0;
    const unmatchedSamples: string[] = [];
    if (unlinked && unlinked.length > 0) {
      for (const p of unlinked) {
        const catId = (p.category_qid && catByQid.get(p.category_qid)) || catByName.get(p.category_name);
        if (catId) {
          const { error: linkErr } = await supabase.from("products").update({ category_id: catId }).eq("id", p.id);
          if (linkErr) {
            linkErrors++;
            console.error(formatDbError("qogita.categories.link", linkErr, {
              product_id: p.id, category_name: p.category_name, category_qid: p.category_qid, resolved_category_id: catId,
            }));
          } else {
            linkedCount++;
          }
        } else if (unmatchedSamples.length < 10) {
          unmatchedSamples.push(`${p.category_name}${p.category_qid ? ` (qid=${p.category_qid})` : ""}`);
        }
      }
    }
    if (unmatchedSamples.length > 0) {
      console.warn(
        `[qogita.categories.link] ${(unlinked?.length || 0) - linkedCount} produits sans category_id. ` +
        `Exemples (max 10): ${unmatchedSamples.join(" | ")}`,
      );
    }

    const stats = {
      categories_total: total,
      categories_invalid: invalidCats.length,
      categories_duplicates: skippedDuplicate,
      upsert_errors: upsertErrors,
      products_linked: linkedCount,
      link_errors: linkErrors,
      source_products: products?.length || 0,
    };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: total, progress_total: total,
      progress_message: `Terminé — ${total} catégories (${upsertErrors} erreurs upsert) — ${linkedCount} produits liés (${linkErrors} erreurs liaison)`,
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
