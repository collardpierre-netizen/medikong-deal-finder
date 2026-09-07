// Admin-only: regenerates a temporary password for a target auth user and
// forces a password change at next login (must_change_password metadata flag).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) return json({ success: false, error: guard.error }, guard.status);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    let userId: string | undefined = body.user_id;
    const email: string | undefined = body.email?.trim?.().toLowerCase();

    if (!userId) {
      if (!email) return json({ success: false, error: "user_id or email required" }, 400);
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email)?.id;
      if (!userId) return json({ success: false, error: "Utilisateur introuvable" }, 404);
    }

    const { data: existing, error: getErr } = await admin.auth.admin.getUserById(userId);
    if (getErr || !existing?.user) return json({ success: false, error: "Utilisateur introuvable" }, 404);

    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      user_metadata: { ...(existing.user.user_metadata ?? {}), must_change_password: true },
    });
    if (updErr) throw updErr;

    return json({
      success: true,
      user_id: userId,
      email: existing.user.email ?? email ?? null,
      temp_password: tempPassword,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: message }, 400);
  }
});
