import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Accept optional body params
    let adminEmail = "admin@medikong.pro";
    let adminPassword = "Admin123!";
    let adminName = "Super Admin";
    let adminRole = "super_admin";

    try {
      const body = await req.json();
      if (body.email) adminEmail = body.email;
      if (body.password) adminPassword = body.password;
      if (body.name) adminName = body.name;
      if (body.role) adminRole = body.role;
    } catch {
      // No body, use defaults
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw authError;
    }

    let userId = authData?.user?.id;

    // If user already exists, find their id
    if (!userId) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const existing = users?.users?.find((u: any) => u.email === adminEmail);
      userId = existing?.id;
    }

    if (!userId) {
      throw new Error("Could not find or create user");
    }

    // Check if already in admin_users
    const { data: existing } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase.from("admin_users").insert({
        user_id: userId,
        name: adminName,
        email: adminEmail,
        role: adminRole,
        is_active: true,
      });
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin created: ${adminEmail}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
