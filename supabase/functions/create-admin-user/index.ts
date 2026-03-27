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

    const adminEmail = "admin@medikong.pro";
    const adminPassword = "Admin123!";

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
        name: "Super Admin",
        email: adminEmail,
        role: "super_admin",
        is_active: true,
      });
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Admin created: ${adminEmail} / ${adminPassword}`,
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
