import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string; config: any }> {
  const { data: config } = await supabaseClient.from("qogita_config").select("*").eq("id", 1).single();
  if (!config) throw new Error("qogita_config not found");
  if (!config.qogita_email || !config.qogita_password) throw new Error("Qogita email/password not configured");
  const baseUrl = config.base_url || "https://api.qogita.com";
  const authResponse = await fetch(`${baseUrl}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: config.qogita_email, password: config.qogita_password }),
  });
  if (!authResponse.ok) throw new Error(`Qogita auth failed (${authResponse.status}): ${await authResponse.text()}`);
  const authData = await authResponse.json();
  const token = authData.accessToken;
  if (!token) throw new Error("No accessToken in Qogita auth response");
  await supabaseClient.from("qogita_config").update({ bearer_token: token }).eq("id", 1);
  return { token, baseUrl, config };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Check for interrupted sync to resume
  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "categories").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let startPage = 1;
  let stats = { last_page: 0, total_pages: 0, items_processed: 0, items_total: 0, items_created: 0, items_updated: 0 };

  if (existingSync && existingSync.stats?.last_page) {
    syncLogId = existingSync.id;
    startPage = (existingSync.stats as any).last_page + 1;
    stats = existingSync.stats as any;
    await supabase.from("sync_logs").update({ progress_message: `Reprise à la page ${startPage}...` }).eq("id", syncLogId);
  } else {
    if (existingSync) {
      await supabase.from("sync_logs").update({ status: "error", error_message: "Superseded", completed_at: new Date().toISOString() }).eq("id", existingSync.id);
    }
    const { data: newLog } = await supabase.from("sync_logs").insert({
      sync_type: "categories", status: "running", stats: {},
      progress_current: 0, progress_total: 0, progress_message: "Authentification Qogita...",
    }).select().single();
    syncLogId = newLog!.id;
  }

  try {
    const { token, baseUrl } = await getQogitaToken(supabase);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    // Phase 1: Fetch all categories (paginated with timeout safety)
    let allCategories: any[] = [];
    let page = startPage;
    let hasMore = true;

    while (hasMore) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        await supabase.from("sync_logs").update({
          stats: { ...stats, phase: "fetch" }, progress_current: stats.items_processed, progress_total: stats.items_total,
          progress_message: `Pause timeout (fetch) — reprendra à la page ${page}`,
        }).eq("id", syncLogId);
        return new Response(JSON.stringify({ status: "partial", resumeAt: page, stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${baseUrl}/categories/?page=${page}&page_size=100`, { headers });
      if (!res.ok) throw new Error(`Qogita API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      allCategories = allCategories.concat(data.results || []);
      const totalCount = data.count || allCategories.length;
      const totalPages = Math.ceil(totalCount / 100) || 1;
      stats.items_total = totalCount;
      stats.total_pages = totalPages;
      stats.last_page = page;

      await supabase.from("sync_logs").update({
        stats, progress_current: allCategories.length, progress_total: totalCount,
        progress_message: `Page ${page}/${totalPages} — ${allCategories.length} catégories récupérées`,
      }).eq("id", syncLogId);

      hasMore = !!data.next;
      page++;
    }

    // Phase 2: Upsert categories
    let created = 0, updated = 0;
    for (let i = 0; i < allCategories.length; i++) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        stats.items_processed = i;
        stats.items_created = created;
        stats.items_updated = updated;
        await supabase.from("sync_logs").update({
          stats: { ...stats, phase: "upsert", upsert_offset: i },
          progress_current: i, progress_total: allCategories.length,
          progress_message: `Pause timeout (upsert ${i}/${allCategories.length})`,
        }).eq("id", syncLogId);
        return new Response(JSON.stringify({ status: "partial", stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cat = allCategories[i];
      const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data: existing } = await supabase.from("categories").select("id").eq("qogita_qid", cat.qid).maybeSingle();
      const row = { qogita_qid: cat.qid, name: cat.name, slug, description: cat.description || null, is_active: true, synced_at: new Date().toISOString() };

      if (existing) { await supabase.from("categories").update(row).eq("id", existing.id); updated++; }
      else { await supabase.from("categories").insert(row); created++; }

      if ((i + 1) % 20 === 0 || i === allCategories.length - 1) {
        await supabase.from("sync_logs").update({
          progress_current: i + 1, progress_total: allCategories.length,
          progress_message: `${i + 1}/${allCategories.length} catégories traitées (${created} créées, ${updated} mises à jour)`,
        }).eq("id", syncLogId);
      }
    }

    // Phase 3: Resolve parent_id
    await supabase.from("sync_logs").update({ progress_message: "Résolution des catégories parentes..." }).eq("id", syncLogId);
    for (const cat of allCategories) {
      if (cat.parentQid) {
        const { data: parent } = await supabase.from("categories").select("id").eq("qogita_qid", cat.parentQid).maybeSingle();
        if (parent) await supabase.from("categories").update({ parent_id: parent.id }).eq("qogita_qid", cat.qid);
      }
    }

    const finalStats = { ...stats, items_created: created, items_updated: updated, items_processed: allCategories.length };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats: finalStats,
      progress_current: allCategories.length, progress_total: allCategories.length,
      progress_message: `Terminé — ${allCategories.length} catégories (${created} créées, ${updated} mises à jour)`,
    }).eq("id", syncLogId);

    return new Response(JSON.stringify({ success: true, stats: finalStats }), {
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
