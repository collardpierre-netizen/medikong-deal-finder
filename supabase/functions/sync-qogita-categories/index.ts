import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_TIME = 250000;

async function getQogitaToken(supabaseClient: any): Promise<{ token: string; baseUrl: string }> {
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
  return { token, baseUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "categories").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  let syncLogId: string;
  let startPage = 1;
  let stats = { last_page: 0, total_pages: 0, items_processed: 0, items_total: 0 };

  if (existingSync && existingSync.stats?.last_page) {
    syncLogId = existingSync.id;
    startPage = (existingSync.stats as any).last_page + 1;
    stats = existingSync.stats as any;
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

    // Phase 1: Fetch all categories
    const allCategories: any[] = [];
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
      allCategories.push(...(data.results || []));
      const totalCount = data.count || allCategories.length;
      const totalPages = Math.ceil(totalCount / 100) || 1;
      stats.items_total = totalCount;
      stats.total_pages = totalPages;
      stats.last_page = page;

      await supabase.from("sync_logs").update({
        stats, progress_current: allCategories.length, progress_total: totalCount,
        progress_message: `Fetch page ${page}/${totalPages} — ${allCategories.length} catégories`,
      }).eq("id", syncLogId);

      hasMore = !!data.next;
      page++;
      await new Promise(r => setTimeout(r, 200));
    }

    // Phase 2: Batch upsert all categories (single query per chunk)
    await supabase.from("sync_logs").update({ progress_message: "Upsert batch des catégories..." }).eq("id", syncLogId);
    const CHUNK = 100;
    for (let i = 0; i < allCategories.length; i += CHUNK) {
      const chunk = allCategories.slice(i, i + CHUNK);
      const batchData = chunk.map((cat: any) => ({
        qogita_qid: cat.qid,
        name: cat.name,
        slug: cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        description: cat.description || null,
        is_active: true,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("categories").upsert(batchData, {
        onConflict: "qogita_qid",
        ignoreDuplicates: false,
      });
      if (error) throw error;
    }

    // Phase 3: Resolve parent_id
    await supabase.from("sync_logs").update({ progress_message: "Résolution des catégories parentes..." }).eq("id", syncLogId);
    const parentsToResolve = allCategories.filter(c => c.parentQid);
    if (parentsToResolve.length > 0) {
      // Load all categories with qogita_qid for mapping
      const { data: allCats } = await supabase.from("categories").select("id, qogita_qid").not("qogita_qid", "is", null);
      const catMap = new Map((allCats || []).map((c: any) => [c.qogita_qid, c.id]));

      for (const cat of parentsToResolve) {
        const parentId = catMap.get(cat.parentQid);
        const childId = catMap.get(cat.qid);
        if (parentId && childId) {
          await supabase.from("categories").update({ parent_id: parentId }).eq("id", childId);
        }
      }
    }

    const finalStats = { ...stats, items_processed: allCategories.length };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats: finalStats,
      progress_current: allCategories.length, progress_total: allCategories.length,
      progress_message: `Terminé — ${allCategories.length} catégories synchronisées`,
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
