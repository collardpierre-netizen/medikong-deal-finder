// Admin-only: triggers a password reset email for a target user (by user_id or email).
// Uses Supabase Auth's built-in recovery flow (auth-email-hook will render the custom template if configured).
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.user_id;
    const explicitEmail: string | undefined = body.email;
    const redirectTo: string =
      body.redirectTo ||
      `${(req.headers.get("origin") ?? "https://medikong.pro").replace(/\/$/, "")}/reset-password`;

    let email = explicitEmail?.trim().toLowerCase();
    if (!email) {
      if (!userId) return json({ success: false, error: "user_id or email required" }, 400);
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
      if (uErr || !u?.user?.email) {
        return json({ success: false, error: "User not found or has no email" }, 404);
      }
      email = u.user.email.toLowerCase();
    }

    // Generate a recovery link — this dispatches the recovery email through
    // Supabase Auth (which routes to auth-email-hook when configured).
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error) throw error;

    return json({
      success: true,
      email,
      action_link: data?.properties?.action_link ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: message }, 400);
  }
});
