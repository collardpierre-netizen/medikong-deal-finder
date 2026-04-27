const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
    const {
      company_name,
      email,
      phone,
      vat_number,
      address_line1,
      city,
      postal_code,
      country_code,
      customer_type,
      customer_id, // mode ATTACH si fourni
    } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "Email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Helper : trouver un user auth par email
    const findAuthUser = async (mail: string): Promise<string | null> => {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const m = list?.users?.find((u: any) => (u.email || "").toLowerCase() === mail);
      return m?.id ?? null;
    };

    // ─── MODE 1 : ATTACH — fiche client existante à rattacher ─────────────
    if (customer_id) {
      const { data: existing, error: cErr } = await supabaseAdmin
        .from("customers")
        .select("id, auth_user_id, email, company_name")
        .eq("id", customer_id)
        .maybeSingle();

      if (cErr || !existing) {
        return new Response(JSON.stringify({ error: "Client introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing.auth_user_id) {
        return new Response(JSON.stringify({ error: "Ce client a déjà un compte d'accès." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let userId = await findAuthUser(normalizedEmail);
      let tempPassword: string | null = null;

      if (!userId) {
        tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: "buyer", company_name: existing.company_name },
        });
        if (authError || !authData.user) {
          return new Response(JSON.stringify({ error: `Erreur auth: ${authError?.message || "inconnue"}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = authData.user.id;
      }

      const { error: updateError } = await supabaseAdmin
        .from("customers")
        .update({ auth_user_id: userId, email: normalizedEmail })
        .eq("id", customer_id);

      if (updateError) {
        if (tempPassword) await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: `Erreur rattachement: ${updateError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        customer_id,
        user_id: userId,
        temp_password: tempPassword,
        reused_existing_user: !tempPassword,
        message: tempPassword
          ? "Accès créé. Mot de passe temporaire généré."
          : "Compte existant rattaché au client.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE 2 : CREATE FROM SCRATCH ──────────────────────────────────────
    if (!company_name || !address_line1 || !city || !postal_code) {
      return new Response(JSON.stringify({ error: "Nom, adresse, ville et code postal requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Si le compte auth existe déjà → on le réutilise
    let userId = await findAuthUser(normalizedEmail);
    let tempPassword: string | null = null;

    if (!userId) {
      tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: "buyer", company_name },
      });
      if (authError || !authData.user) {
        return new Response(JSON.stringify({ error: `Erreur auth: ${authError?.message || "inconnue"}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = authData.user.id;
    }

    // Si une fiche customer existe déjà avec cet email → on la lie + update
    const { data: existingByEmail } = await supabaseAdmin
      .from("customers")
      .select("id, auth_user_id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    let customerIdResult: string;

    if (existingByEmail) {
      const { error: upErr } = await supabaseAdmin
        .from("customers")
        .update({
          auth_user_id: existingByEmail.auth_user_id ?? userId,
          company_name: company_name.trim(),
          phone: phone || null,
          vat_number: vat_number || null,
          address_line1: address_line1.trim(),
          city: city.trim(),
          postal_code: postal_code.trim(),
          country_code: country_code || "BE",
          customer_type: customer_type || "pharmacy",
          is_professional: true,
          is_verified: true,
        })
        .eq("id", existingByEmail.id);
      if (upErr) {
        if (tempPassword) await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: `Erreur mise à jour client: ${upErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerIdResult = existingByEmail.id;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin.from("customers").insert({
        auth_user_id: userId,
        company_name: company_name.trim(),
        email: normalizedEmail,
        phone: phone || null,
        vat_number: vat_number || null,
        address_line1: address_line1.trim(),
        city: city.trim(),
        postal_code: postal_code.trim(),
        country_code: country_code || "BE",
        customer_type: customer_type || "pharmacy",
        is_professional: true,
        is_verified: true,
      }).select("id").single();

      if (insErr) {
        if (tempPassword) await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: `Erreur client: ${insErr.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerIdResult = inserted.id;
    }

    return new Response(JSON.stringify({
      success: true,
      customer_id: customerIdResult,
      user_id: userId,
      temp_password: tempPassword,
      reused_existing_user: !tempPassword,
      message: tempPassword
        ? "Client créé avec un mot de passe temporaire."
        : "Compte auth existant réutilisé et lié au client.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
