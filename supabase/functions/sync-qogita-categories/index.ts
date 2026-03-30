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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: syncLog } = await supabase.from("sync_logs").insert({
    sync_type: "categories",
    status: "running",
    stats: {},
    progress_current: 0,
    progress_total: 0,
    progress_message: "Authentification Qogita...",
  }).select().single();

  try {
    const { token, baseUrl } = await getQogitaToken(supabase);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    let allCategories: any[] = [];
    let nextUrl: string | null = `${baseUrl}/categories/?page_size=100`;
    let currentPage = 0;
    let totalCount = 0;

    // Fetch all pages
    while (nextUrl) {
      currentPage++;
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) throw new Error(`Qogita API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      
      if (currentPage === 1 && data.count) totalCount = data.count;
      
      allCategories = allCategories.concat(data.results || []);
      nextUrl = data.next || null;
      
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / 100) : currentPage;
      await supabase.from("sync_logs").update({
        progress_current: allCategories.length,
        progress_total: totalCount || allCategories.length,
        progress_message: `Page ${currentPage}/${totalPages} — ${allCategories.length} catégories récupérées`,
      }).eq("id", syncLog?.id);
    }

    let created = 0, updated = 0;

    await supabase.from("sync_logs").update({
      progress_message: `Import de ${allCategories.length} catégories en base...`,
    }).eq("id", syncLog?.id);

    for (let i = 0; i < allCategories.length; i++) {
      const cat = allCategories[i];
      const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("qogita_qid", cat.qid)
        .maybeSingle();

      const row = {
        qogita_qid: cat.qid,
        name: cat.name,
        slug,
        description: cat.description || null,
        is_active: true,
        synced_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("categories").update(row).eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("categories").insert(row);
        created++;
      }

      // Update progress every 20 items
      if ((i + 1) % 20 === 0 || i === allCategories.length - 1) {
        await supabase.from("sync_logs").update({
          progress_current: i + 1,
          progress_total: allCategories.length,
          progress_message: `${i + 1}/${allCategories.length} catégories traitées (${created} créées, ${updated} mises à jour)`,
        }).eq("id", syncLog?.id);
      }
    }

    // Resolve parent_id after all categories are inserted
    await supabase.from("sync_logs").update({
      progress_message: "Résolution des catégories parentes...",
    }).eq("id", syncLog?.id);

    for (const cat of allCategories) {
      if (cat.parentQid) {
        const { data: parent } = await supabase.from("categories").select("id").eq("qogita_qid", cat.parentQid).maybeSingle();
        if (parent) {
          await supabase.from("categories").update({ parent_id: parent.id }).eq("qogita_qid", cat.qid);
        }
      }
    }

    const stats = { total: allCategories.length, created, updated };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
      progress_current: allCategories.length,
      progress_total: allCategories.length,
      progress_message: `Terminé — ${allCategories.length} catégories (${created} créées, ${updated} mises à jour)`,
    }).eq("id", syncLog?.id);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync categories error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
      progress_message: `Erreur: ${error.message}`,
    }).eq("id", syncLog?.id);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
