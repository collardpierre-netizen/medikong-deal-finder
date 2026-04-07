import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminUser } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { vendor_id, mode } = body; // mode: "link" | "email"

    if (!vendor_id) {
      return new Response(JSON.stringify({ error: "vendor_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get vendor
    const { data: vendor, error: vendorErr } = await supabaseAdmin
      .from("vendors")
      .select("*")
      .eq("id", vendor_id)
      .maybeSingle();

    if (vendorErr || !vendor) {
      return new Response(JSON.stringify({ error: "Vendeur non trouvé" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vendor.email) {
      return new Response(JSON.stringify({ error: "Le vendeur n'a pas d'email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authUserId = vendor.auth_user_id;

    // If no auth account exists, create one
    if (!authUserId) {
      const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: vendor.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: "vendor", company_name: vendor.company_name || vendor.name },
      });

      if (authError) {
        return new Response(JSON.stringify({ error: `Erreur auth: ${authError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      authUserId = authData.user.id;

      // Link auth user to vendor
      await supabaseAdmin.from("vendors").update({ auth_user_id: authUserId }).eq("id", vendor_id);
    }

    // Generate a password reset link (acts as invitation link)
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "https://medikong-deal-finder.lovable.app";
    const redirectTo = `${siteUrl}/reset-password`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: vendor.email,
      options: { redirectTo },
    });

    if (linkError) {
      return new Response(JSON.stringify({ error: `Erreur lien: ${linkError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the actual invitation link with the token
    const actionLink = linkData.properties?.action_link || "";

    if (mode === "email") {
      // Send invitation email via transactional email system
      try {
        await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "vendor-application",
            recipientEmail: vendor.email,
            idempotencyKey: `vendor-invite-${vendor_id}-${Date.now()}`,
            templateData: {
              companyName: vendor.company_name || vendor.name,
              invitationLink: actionLink,
              isInvitation: true,
            },
          },
        });
      } catch (emailErr) {
        // Email might fail but link is still generated
        console.error("Email error:", emailErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      invitation_link: actionLink,
      mode,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
