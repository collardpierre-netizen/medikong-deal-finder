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
    const { company_name, email, phone, vat_number, address, commission_rate, description, type, vendor_id } = body;

    if (!company_name || !email) {
      return new Response(JSON.stringify({ error: "Nom et email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // ─── MODE 1 : ATTACH — un vendor_id existant est fourni ────────────────
    // On crée juste le compte auth et on le rattache au vendeur existant.
    if (vendor_id) {
      const { data: existingVendor, error: vErr } = await supabaseAdmin
        .from("vendors")
        .select("id, auth_user_id, email, company_name, name")
        .eq("id", vendor_id)
        .maybeSingle();

      if (vErr || !existingVendor) {
        return new Response(JSON.stringify({ error: "Vendeur introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingVendor.auth_user_id) {
        return new Response(JSON.stringify({ error: "Ce vendeur a déjà un accès portail." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // L'utilisateur auth existe-t-il déjà avec cet email ?
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      const matched = existingUsers?.users?.find((u: any) => (u.email || "").toLowerCase() === normalizedEmail);

      let userId: string;
      let tempPassword: string | null = null;

      if (matched) {
        // L'email a déjà un compte auth — on réutilise et on rattache
        userId = matched.id;
      } else {
        tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { role: "vendor", company_name: existingVendor.company_name || existingVendor.name },
        });

        if (authError || !authData.user) {
          return new Response(JSON.stringify({ error: `Erreur auth: ${authError?.message || "inconnue"}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = authData.user.id;
      }

      // Rattachement
      const { error: updateError } = await supabaseAdmin
        .from("vendors")
        .update({ auth_user_id: userId, email: normalizedEmail })
        .eq("id", vendor_id);

      if (updateError) {
        // Rollback du user auth si on vient de le créer
        if (tempPassword) {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        return new Response(JSON.stringify({ error: `Erreur rattachement: ${updateError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        vendor_id,
        user_id: userId,
        temp_password: tempPassword, // null si user auth déjà existant (lui dire d'utiliser son mot de passe)
        reused_existing_user: !tempPassword,
        message: tempPassword
          ? "Accès créé. Mot de passe temporaire généré."
          : "Compte existant rattaché au vendeur. Le vendeur conserve son mot de passe actuel.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE 2 : CREATE FROM SCRATCH ──────────────────────────────────────
    const vendorType = type || "real";
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "vendor", company_name },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: `Erreur auth: ${authError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    const baseSlug = company_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Garantir l'unicité du slug
    let slug = baseSlug;
    for (let i = 1; i < 50; i++) {
      const { data: clash } = await supabaseAdmin.from("vendors").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: vendor, error: vendorError } = await supabaseAdmin.from("vendors").insert({
      auth_user_id: userId,
      name: company_name.trim(),
      slug,
      company_name: company_name.trim(),
      email: normalizedEmail,
      phone: phone || null,
      vat_number: vat_number || null,
      address_line1: address || null,
      type: vendorType,
      is_active: true,
      can_manage_offers: true,
      commission_rate: parseFloat(commission_rate) || 15,
      description: description || null,
    }).select("id").single();

    if (vendorError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: `Erreur vendeur: ${vendorError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      vendor_id: vendor.id,
      user_id: userId,
      temp_password: tempPassword,
      message: `Vendeur créé avec succès`,
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
