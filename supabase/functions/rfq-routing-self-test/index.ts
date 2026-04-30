// Edge function : exécute la fonction de test SQL `rfq_routing_self_test()` et retourne
// les résultats. Réservé aux admins authentifiés (auth + role check côté DB).
//
// Permet à un admin de valider manuellement, depuis l'UI ou un script, que le moteur
// de routage RFQ associe correctement les vendeurs en fonction du produit/marque/catégorie
// et du pays acheteur (+ pays limitrophes).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Row = {
  scenario: string;
  expected: number;
  actual: number;
  ok: boolean;
  details: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth + admin guard
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await admin.rpc("is_admin", {
    _user_id: userData.user.id,
  });
  const { data: isSuper } = await admin.rpc("is_super_admin", {
    _user_id: userData.user.id,
  });
  if (!isAdmin && !isSuper) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Run the self-test
  const { data, error } = await admin.rpc("rfq_routing_self_test");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (data || []) as Row[];
  const total = rows.length;
  const passed = rows.filter((r) => r.ok).length;
  const failed = total - passed;

  return new Response(
    JSON.stringify({
      summary: { total, passed, failed, all_passed: failed === 0 },
      scenarios: rows,
      ran_at: new Date().toISOString(),
    }),
    {
      status: failed === 0 ? 200 : 207,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
