const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Helper: réponse 200 normalisée (succès ou erreur applicative)
function jsonOk(payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonErr(
  error: string,
  code: string,
  extra: Record<string, unknown> = {},
  httpStatus = 200, // par défaut on évite le masquage côté client
) {
  return new Response(
    JSON.stringify({ ok: false, error, code, ...extra }),
    {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Non autorisé", "unauthorized", {}, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) return jsonErr("Non autorisé", "unauthorized", {}, 401);

    const { data: adminUser } = await supabaseAdmin
      .from("admin_users")
      .select("role")
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!adminUser) return jsonErr("Accès refusé", "forbidden", {}, 403);

    const body = await req.json();
    const {
      company_name,
      email,
      phone,
      vat_number,
      address,
      commission_rate,
      description,
      type,
      vendor_id,
    } = body;

    if (!company_name || !email) {
      return jsonErr("Nom et email requis", "missing_fields");
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Helper: chercher un user auth par email (pagination simple)
    const findAuthUserByEmail = async (em: string) => {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      return data?.users?.find((u: any) => (u.email || "").toLowerCase() === em) ?? null;
    };

    // Helper: chercher un vendor existant pour un email
    const findVendorByEmail = async (em: string) => {
      const { data } = await supabaseAdmin
        .from("vendors")
        .select("id, slug, name, company_name, email, auth_user_id")
        .ilike("email", em)
        .maybeSingle();
      return data ?? null;
    };

    // ─── MODE 1 : ATTACH ────────────────────────────────────────────────
    if (vendor_id) {
      const { data: existingVendor, error: vErr } = await supabaseAdmin
        .from("vendors")
        .select("id, auth_user_id, email, company_name, name")
        .eq("id", vendor_id)
        .maybeSingle();

      if (vErr || !existingVendor) {
        return jsonErr("Vendeur introuvable", "vendor_not_found");
      }
      if (existingVendor.auth_user_id) {
        return jsonErr(
          "Ce vendeur a déjà un accès portail.",
          "vendor_already_has_access",
          { existing_vendor: existingVendor },
        );
      }

      const matched = await findAuthUserByEmail(normalizedEmail);
      let userId: string;
      let tempPassword: string | null = null;

      if (matched) {
        userId = matched.id;
      } else {
        tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            role: "vendor",
            company_name: existingVendor.company_name || existingVendor.name,
          },
        });
        if (authError || !authData.user) {
          return jsonErr(
            `Erreur auth: ${authError?.message || "inconnue"}`,
            "auth_create_failed",
          );
        }
        userId = authData.user.id;
      }

      const { error: updateError } = await supabaseAdmin
        .from("vendors")
        .update({ auth_user_id: userId, email: normalizedEmail })
        .eq("id", vendor_id);

      if (updateError) {
        if (tempPassword) await supabaseAdmin.auth.admin.deleteUser(userId);
        return jsonErr(`Erreur rattachement: ${updateError.message}`, "attach_failed");
      }

      return jsonOk({
        vendor_id,
        user_id: userId,
        temp_password: tempPassword,
        reused_existing_user: !tempPassword,
        message: tempPassword
          ? "Accès créé. Mot de passe temporaire généré."
          : "Compte existant rattaché au vendeur. Le vendeur conserve son mot de passe actuel.",
      });
    }

    // ─── MODE 2 : CREATE FROM SCRATCH ─────────────────────────────────────

    // ⛳ Pré-check doublon email → on propose "rattacher" si un vendor existe déjà
    const existingVendorSameEmail = await findVendorByEmail(normalizedEmail);
    if (existingVendorSameEmail) {
      return jsonErr(
        `Un vendeur avec cet email existe déjà : ${existingVendorSameEmail.company_name || existingVendorSameEmail.name}`,
        "vendor_email_already_exists",
        {
          existing_vendor: existingVendorSameEmail,
          suggested_action: existingVendorSameEmail.auth_user_id ? "open_existing" : "attach_to_existing",
        },
      );
    }

    const existingAuthUser = await findAuthUserByEmail(normalizedEmail);
    if (existingAuthUser) {
      return jsonErr(
        "Un compte utilisateur existe déjà avec cet email (sans vendeur associé).",
        "auth_email_already_exists",
        { existing_user_id: existingAuthUser.id },
      );
    }

    const vendorType = type || "real";
    const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "vendor", company_name },
    });

    if (authError) {
      // Filet de sécurité au cas où la course aurait laissé passer
      if (/already.*registered|exists/i.test(authError.message)) {
        return jsonErr(
          "Un compte utilisateur existe déjà avec cet email.",
          "auth_email_already_exists",
        );
      }
      return jsonErr(`Erreur auth: ${authError.message}`, "auth_create_failed");
    }

    const userId = authData.user.id;

    const baseSlug = company_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

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
      return jsonErr(`Erreur vendeur: ${vendorError.message}`, "vendor_insert_failed");
    }

    return jsonOk({
      vendor_id: vendor.id,
      user_id: userId,
      temp_password: tempPassword,
      message: "Vendeur créé avec succès",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonErr(message, "internal_error", {}, 500);
  }
});
