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

    // 4) Rattachement
    const { error: updateError } = await supabaseAdmin
      .from("vendors")
      .update({ auth_user_id: userId, email: normalizedEmail })
      .eq("id", vendor_id);

    if (updateError) {
      // Rollback du user fraîchement créé si on l'a créé pour cette opération
      if (tempPassword) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      // Conflit unique email côté DB (lower(email))
      if ((updateError as any).code === "23505") {
        return jsonErr(
          "Cet email est déjà rattaché à un autre vendeur.",
          "vendor_email_already_exists",
        );
      }
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
  } catch (e: any) {
    return jsonErr(`Erreur serveur: ${e?.message ?? "inconnue"}`, "server_error", {}, 500);
  }
});
