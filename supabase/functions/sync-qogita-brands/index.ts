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
    sync_type: "brands", status: "running", stats: {},
  }).select().single();

  try {
    const { token, baseUrl } = await getQogitaToken(supabase);
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    let allBrands: any[] = [];
    let nextUrl: string | null = `${baseUrl}/brands/?page_size=100`;

    while (nextUrl) {
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) throw new Error(`Qogita API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      allBrands = allBrands.concat(data.results || []);
      nextUrl = data.next || null;
    }

    let created = 0, updated = 0;

    for (const brand of allBrands) {
      const slug = brand.slug || brand.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data: existing } = await supabase
        .from("brands")
        .select("id")
        .eq("qogita_qid", brand.qid)
        .maybeSingle();

      const row = {
        qogita_qid: brand.qid,
        name: brand.name,
        slug,
        logo_url: brand.logoUrl || null,
        description: brand.description || null,
        is_active: true,
        synced_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("brands").update(row).eq("id", existing.id);
        updated++;
      } else {
        await supabase.from("brands").insert(row);
        created++;
      }
    }

    const stats = { total: allBrands.length, created, updated };
    await supabase.from("sync_logs").update({
      status: "completed", completed_at: new Date().toISOString(), stats,
    }).eq("id", syncLog?.id);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Sync brands error:", error);
    await supabase.from("sync_logs").update({
      status: "error", completed_at: new Date().toISOString(), error_message: error.message,
    }).eq("id", syncLog?.id);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
