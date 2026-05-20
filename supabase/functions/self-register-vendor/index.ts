// Edge function : self-signup vendeur.
// L'acheteur/vendeur est déjà authentifié via Supabase Auth (token Bearer).
// On crée sa fiche `vendors` côté serveur avec service_role pour garantir
// que la ligne est bien insérée (et pas avalée par une policy RLS).
//
// Garde-fous :
// - auth obligatoire
// - aucun champ "privilégié" accepté (is_active, validation_status, commission_rate, …)
// - is_active = false, validation_status = 'pending_review' forcés
// - dédoublonnage par auth_user_id ET par email
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
function jsonErr(error: string, code: string, extra: Record<string, unknown> = {}, status = 200) {
  return new Response(JSON.stringify({ ok: false, error, code, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Non authentifié", "unauthorized", {}, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return jsonErr("Non authentifié", "unauthorized", {}, 401);

    const body = await req.json().catch(() => ({}));
    const {
      company_name,
      first_name,
      last_name,
      email,
      phone,
      vat_number,
      country_code,
      city,
      description,
      preferred_language,
    } = body ?? {};

    const safeEmail = String(email || user.email || "").trim().toLowerCase();
    if (!safeEmail) return jsonErr("Email manquant", "missing_fields");
    const safeName =
      (company_name && String(company_name).trim()) ||
      [first_name, last_name].filter(Boolean).join(" ").trim();
    if (!safeName) return jsonErr("Nom requis", "missing_fields");

    // Déjà un vendor pour ce user ?
    const { data: existingForUser } = await supabaseAdmin
      .from("vendors").select("id, slug").eq("auth_user_id", user.id).maybeSingle();
    if (existingForUser) {
      return jsonOk({ vendor_id: existingForUser.id, already_existed: true });
    }

    // Conflit d'email avec un autre vendor ?
    const { data: existingForEmail } = await supabaseAdmin
      .from("vendors").select("id, auth_user_id, company_name, name")
      .ilike("email", safeEmail).maybeSingle();
    if (existingForEmail) {
      return jsonErr(
        "Un compte vendeur existe déjà avec cet email.",
        "vendor_email_already_exists",
        { existing_vendor: existingForEmail },
      );
    }

    const baseSlug = safeName
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vendeur";
    let slug = baseSlug;
    for (let i = 1; i < 50; i++) {
      const { data: clash } = await supabaseAdmin
        .from("vendors").select("id").eq("slug", slug).maybeSingle();
      if (!clash) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("vendors")
      .insert({
        auth_user_id: user.id,
        name: safeName,
        slug,
        company_name: company_name ? String(company_name).trim() : null,
        email: safeEmail,
        phone: phone || null,
        vat_number: vat_number || null,
        country_code: country_code || null,
        city: city || null,
        description: description || null,
        type: "real",
        is_active: false,                  // forcé
        validation_status: "pending_review", // forcé
        can_manage_offers: true,
        preferred_language: preferred_language || "fr",
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return jsonErr(
        insErr?.message || "Insertion impossible",
        "vendor_insert_failed",
      );
    }

    return jsonOk({ vendor_id: inserted.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonErr(msg, "internal_error", {}, 500);
  }
});
