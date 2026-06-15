// Edge function dédiée : rattacher un email/utilisateur à un vendeur EXISTANT.
// Séparé de `create-vendor-account` pour clarifier les responsabilités :
//   - create-vendor-account = créer un nouveau vendeur (+ optionnel compte auth)
//   - attach-user-to-vendor = brancher un compte auth (existant ou nouveau) sur un vendor déjà en base
//
// Body attendu : { vendor_id: string, email: string }
//
// Réponses normalisées (HTTP 200 sauf auth) :
//   succès : { ok: true, vendor_id, user_id, temp_password|null, reused_existing_user, message }
//   erreur : { ok: false, code, error, ...extra }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { issueAttachVerification, resolveAttachLocale } from "../_shared/vendor-attach-verification.ts";


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
  httpStatus = 200,
) {
  return new Response(
    JSON.stringify({ ok: false, error, code, ...extra }),
    { status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    const body = await req.json().catch(() => ({}));
    const vendor_id: string | undefined = body?.vendor_id;
    const emailRaw: string | undefined = body?.email;

    if (!vendor_id || !emailRaw) {
      return jsonErr("vendor_id et email sont requis", "missing_fields");
    }
    const normalizedEmail = String(emailRaw).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return jsonErr("Email invalide", "invalid_email");
    }

    // 1) Vendor existe ?
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

    // 2) L'email est-il déjà utilisé par un AUTRE vendor ?
    const { data: emailConflict } = await supabaseAdmin
      .from("vendors")
      .select("id, company_name, name, auth_user_id")
      .ilike("email", normalizedEmail)
      .neq("id", vendor_id)
      .maybeSingle();
    if (emailConflict) {
      return jsonErr(
        "Cet email est déjà rattaché à un autre vendeur.",
        "vendor_email_already_exists",
        { existing_vendor: emailConflict },
      );
    }

    // 3) Compte auth existant ?
    const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = listed?.users?.find(
      (u: any) => (u.email || "").toLowerCase() === normalizedEmail,
    ) ?? null;

    let userId: string;
    let createdAuthUser = false;

    if (matched) {
      userId = matched.id;
    } else {
      const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";
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
      createdAuthUser = true;
    }

    // 4) ⛔ Pas de rattachement immédiat. Génère token + envoie email de vérification.
    const { data: vendorLang } = await supabaseAdmin
      .from("vendors")
      .select("preferred_language, country_code")
      .eq("id", vendor_id)
      .maybeSingle();
    const attachLocale = resolveAttachLocale(
      vendorLang?.preferred_language as string | null,
      vendorLang?.country_code as string | null,
    );

    let verif: Awaited<ReturnType<typeof issueAttachVerification>>;
    try {
      verif = await issueAttachVerification({
        supabaseAdmin,
        vendorId: vendor_id,
        userId,
        email: normalizedEmail,
        companyName: existingVendor.company_name || existingVendor.name || "",
        locale: attachLocale,
        createdByAdminId: caller.id,
      });
    } catch (e) {
      if (createdAuthUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      return jsonErr(
        `Erreur création vérification: ${e instanceof Error ? e.message : String(e)}`,
        "verification_create_failed",
      );
    }

    return jsonOk({
      vendor_id,
      user_id: userId,
      reused_existing_user: !createdAuthUser,
      verification_sent: verif.emailStatus === "enqueued",
      verification_id: verif.verificationId,
      expires_at: verif.expiresAt,
      email_error: verif.emailError,
      message: verif.emailStatus === "enqueued"
        ? `Email de vérification envoyé à ${normalizedEmail} (valide 24 h). L'accès portail s'activera après confirmation par le destinataire.`
        : `Vérification créée mais l'envoi d'email a échoué (${verif.emailError ?? "erreur inconnue"}). Renvoyez le lien depuis la fiche vendeur.`,
    });
  } catch (e: any) {
    return jsonErr(`Erreur serveur: ${e?.message ?? "inconnue"}`, "server_error", {}, 500);
  }
});

