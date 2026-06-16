import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    let body: { email?: string; password?: string; name?: string; role?: string } = {};
    try { body = await req.json(); } catch { /* allow empty body only during bootstrap */ }

    // Validate inputs — no hardcoded defaults anymore
    const adminEmail = (body.email ?? "").trim().toLowerCase();
    const adminPassword = body.password ?? "";
    const adminName = (body.name ?? "Super Admin").trim();
    const adminRole = (body.role ?? "super_admin").trim();

    if (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      return json({ success: false, error: "Valid email required" }, 400);
    }
    if (!adminPassword || adminPassword.length < 12) {
      return json({ success: false, error: "Password must be at least 12 characters" }, 400);
    }
    if (!["super_admin", "admin", "moderator"].includes(adminRole)) {
      return json({ success: false, error: "Invalid role" }, 400);
    }

    // Authorization: bootstrap allowed only if no admin exists yet.
    // Otherwise the caller MUST be an authenticated super_admin.
    const { count: adminCount, error: countErr } = await admin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (countErr) throw countErr;

    if ((adminCount ?? 0) > 0) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ success: false, error: "Unauthorized" }, 401);

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return json({ success: false, error: "Unauthorized" }, 401);
      }
      const { data: callerAdmin } = await admin
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!callerAdmin?.is_active || callerAdmin.role !== "super_admin") {
        return json({ success: false, error: "Forbidden: super_admin required" }, 403);
      }
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw authError;
    }

    let userId = authData?.user?.id;
    if (!userId) {
      const { data: users } = await admin.auth.admin.listUsers();
      const existing = users?.users?.find((u: { email?: string }) => u.email === adminEmail);
      userId = existing?.id;
    }
    if (!userId) throw new Error("Could not find or create user");

    const { data: existing } = await admin
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await admin.from("admin_users").insert({
        user_id: userId,
        name: adminName,
        email: adminEmail,
        role: adminRole,
        is_active: true,
      });
      if (insertError) throw insertError;
    }

    return json({ success: true, message: `Admin created: ${adminEmail}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 400);
  }
});
