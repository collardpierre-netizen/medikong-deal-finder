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

  // Check for interrupted sync to resume
  const { data: existingSync } = await supabase
    .from("sync_logs").select("*").eq("sync_type", "brands").eq("status", "running")
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
      sync_type: "brands", status: "running", stats: {},
      progress_current: 0, progress_total: 0, progress_message: "Authentification Qogita...",
    }).select().single();
    syncLogId = newLog!.id;
  }

  try {
    const { token, baseUrl } = await getQogitaToken(supabase);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    let page = startPage;
    let hasMore = true;

    while (hasMore) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        await supabase.from("sync_logs").update({
          stats, progress_current: stats.items_processed, progress_total: stats.items_total,
          progress_message: `Pause timeout — reprendra à la page ${page}`,
        }).eq("id", syncLogId);
        return new Response(JSON.stringify({ status: "partial", resumeAt: page, stats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${baseUrl}/brands/?page=${page}&page_size=100`, { headers });
      if (!res.ok) throw new Error(`Qogita API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const brands = data.results || [];
      const totalCount = data.count || 0;
      const totalPages = Math.ceil(totalCount / 100) || 1;

      if (brands.length > 0) {
        // BATCH UPSERT — single query per page instead of N queries
        const batchData = brands.map((brand: any) => ({
          qogita_qid: brand.qid,
          name: brand.name,
          slug: brand.slug || brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          logo_url: brand.logoUrl || null,
          description: brand.description || null,
          is_active: true,
          synced_at: new Date().toISOString(),
        }));

        const { error } = await supabase.from("brands").upsert(batchData, {
          onConflict: "qogita_qid",
          ignoreDuplicates: false,
        });
        if (error) throw error;

        stats.items_processed += brands.length;
      }

      stats.last_page = page;
      stats.total_pages = totalPages;
      stats.items_total = totalCount;

      await supabase.from("sync_logs").update({
        stats, progress_current: stats.items_processed, progress_total: totalCount,
        progress_message: `Page ${page}/${totalPages} — ${stats.items_processed}/${totalCount} marques`,
      }).eq("id", syncLogId);

      hasMore = !!data.next;
      page++;
      await new Promise(r => setTimeout(r, 200));
    }

    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: stats.items_total, progress_total: stats.items_total,
      progress_message: `Terminé — ${stats.items_processed} marques synchronisées`,
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
