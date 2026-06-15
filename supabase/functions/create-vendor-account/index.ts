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
      address_line1,
      city,
      postal_code,
      country_code,
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

      // Best-effort onboarding email pour le mode ATTACH
      let recoveryUrl: string | null = null;
      // Résoudre la langue préférée du vendeur (fallback FR)
      const { data: vendorLang } = await supabaseAdmin
        .from("vendors")
        .select("preferred_language, country_code, company_name, name")
        .eq("id", vendor_id)
        .maybeSingle();
      const attachLocale = (vendorLang?.preferred_language as string)
        || (vendorLang?.country_code === "NL" ? "nl"
          : (["FR","BE","LU"].includes(String(vendorLang?.country_code || "")) ? "fr" : "en"));
      try {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: normalizedEmail,
          options: { redirectTo: "https://www.medikong.pro/vendor/login" },
        });
        recoveryUrl = linkData?.properties?.action_link ?? null;
      } catch (e) {
        console.warn("[create-vendor-account/ATTACH] generateLink failed:", e);
      }
      {
        const idemKey = `vendor-onboarding-attach-${vendor_id}`;
        let logStatus: "enqueued" | "failed" = "enqueued";
        let logError: string | null = null;
        try {
          const { error: invokeErr } = await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "vendor-account-created",
              recipientEmail: normalizedEmail,
              idempotencyKey: idemKey,
              templateData: {
                companyName: vendorLang?.company_name || vendorLang?.name || existingVendor.company_name || existingVendor.name,
                loginEmail: normalizedEmail,
                recoveryUrl,
                tempPassword: tempPassword && !recoveryUrl ? tempPassword : null,
                locale: attachLocale,
              },
            },
          });
          if (invokeErr) { logStatus = "failed"; logError = invokeErr.message ?? String(invokeErr); }
        } catch (e) {
          logStatus = "failed";
          logError = e instanceof Error ? e.message : String(e);
          console.warn("[create-vendor-account/ATTACH] onboarding email failed:", e);
        }
        try {
          await supabaseAdmin.from("vendor_onboarding_email_logs").insert({
            vendor_id, mode: "attach", template_name: "vendor-account-created",
            locale: attachLocale, recipient_email: normalizedEmail,
            idempotency_key: idemKey, status: logStatus, error_message: logError,
          });
        } catch (e) { console.warn("[create-vendor-account/ATTACH] log insert failed:", e); }
      }

      return jsonOk({
        vendor_id,
        user_id: userId,
        temp_password: tempPassword,
        recovery_url: recoveryUrl,
        reused_existing_user: !tempPassword,
        message: tempPassword
          ? "Accès créé. Mot de passe temporaire généré + email envoyé."
          : "Compte existant rattaché au vendeur. Email de notification envoyé.",
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

    const normalizedCountry = (country_code ? String(country_code).trim().toUpperCase() : null) || null;
    const preferredLanguage = normalizedCountry === 'NL'
      ? 'nl'
      : (normalizedCountry === 'FR' || normalizedCountry === 'BE' || normalizedCountry === 'LU')
        ? 'fr'
        : 'en';

    const { data: vendor, error: vendorError } = await supabaseAdmin.from("vendors").insert({
      auth_user_id: userId,
      name: company_name.trim(),
      slug,
      company_name: company_name.trim(),
      email: normalizedEmail,
      phone: phone || null,
      vat_number: vat_number || null,
      address_line1: address_line1 || address || null,
      city: city || null,
      postal_code: postal_code || null,
      country_code: normalizedCountry,
      preferred_language: preferredLanguage,
      type: vendorType,
      is_active: true,
      can_manage_offers: true,
      commission_rate: parseFloat(commission_rate) || 15,
      description: description || null,
    }).select("id").single();

    if (vendorError) {
      // Rollback du user auth créé juste avant
      await supabaseAdmin.auth.admin.deleteUser(userId);

      // Conflit unique (race entre 2 admins) → l'index unique CI sur lower(email) garantit l'atomicité.
      // Postgres renvoie le code 23505 (unique_violation).
      const isUniqueViolation =
        (vendorError as any).code === "23505" ||
        /vendors_email_unique_ci|duplicate key value/i.test(vendorError.message || "");

      if (isUniqueViolation) {
        // Re-lookup pour proposer la bonne action (rattacher / ouvrir)
        const racedVendor = await findVendorByEmail(normalizedEmail);
        return jsonErr(
          racedVendor
            ? `Un vendeur avec cet email vient d'être créé : ${racedVendor.company_name || racedVendor.name}`
            : "Un vendeur avec cet email existe déjà.",
          "vendor_email_already_exists",
          {
            existing_vendor: racedVendor,
            suggested_action: racedVendor?.auth_user_id ? "open_existing" : "attach_to_existing",
            race_detected: true,
          },
        );
      }

      return jsonErr(`Erreur vendeur: ${vendorError.message}`, "vendor_insert_failed");
    }

    // Best-effort : magic link de récupération + email d'onboarding multilingue.
    let recoveryUrl: string | null = null;
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: { redirectTo: "https://www.medikong.pro/vendor/login" },
      });
      recoveryUrl = linkData?.properties?.action_link ?? null;
    } catch (e) {
      console.warn("[create-vendor-account] generateLink failed:", e);
    }

    {
      const idemKey = `vendor-onboarding-${vendor.id}`;
      let logStatus: "enqueued" | "failed" = "enqueued";
      let logError: string | null = null;
      try {
        const { error: invokeErr } = await supabaseAdmin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "vendor-account-created",
            recipientEmail: normalizedEmail,
            idempotencyKey: idemKey,
            templateData: {
              companyName: company_name.trim(),
              loginEmail: normalizedEmail,
              recoveryUrl,
              tempPassword: recoveryUrl ? null : tempPassword,
              locale: preferredLanguage,
            },
          },
        });
        if (invokeErr) { logStatus = "failed"; logError = invokeErr.message ?? String(invokeErr); }
      } catch (e) {
        logStatus = "failed";
        logError = e instanceof Error ? e.message : String(e);
        console.warn("[create-vendor-account] onboarding email failed:", e);
      }
      try {
        await supabaseAdmin.from("vendor_onboarding_email_logs").insert({
          vendor_id: vendor.id, mode: "create", template_name: "vendor-account-created",
          locale: preferredLanguage, recipient_email: normalizedEmail,
          idempotency_key: idemKey, status: logStatus, error_message: logError,
        });
      } catch (e) { console.warn("[create-vendor-account] log insert failed:", e); }
    }

    return jsonOk({
      vendor_id: vendor.id,
      user_id: userId,
      temp_password: tempPassword,
      recovery_url: recoveryUrl,
      message: "Vendeur créé avec succès",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonErr(message, "internal_error", {}, 500);
  }
});
