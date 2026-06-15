// Edge function publique : consomme un token de vérification d'attache vendeur.
// Cliquée par le destinataire de l'email "vendor-attach-verification".
// Body: { token: string }
// Réponse: { ok, vendor_id, login_email, recovery_url } | { ok:false, code }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function jsonOk(p: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...p }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonErr(error: string, code: string, httpStatus = 200) {
  return new Response(JSON.stringify({ ok: false, error, code }), {
    status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonErr("Method not allowed", "method_not_allowed", 405);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token;
    if (!token || typeof token !== "string" || token.length < 32 || token.length > 256) {
      return jsonErr("Token invalide", "invalid_token");
    }

    const tokenHash = await sha256Hex(token);

    const { data: verif, error: vErr } = await supabaseAdmin
      .from("vendor_attach_verifications")
      .select("id, vendor_id, user_id, email, expires_at, consumed_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (vErr || !verif) return jsonErr("Lien invalide", "not_found");
    if (verif.consumed_at) return jsonErr("Ce lien a déjà été utilisé", "already_consumed");
    if (new Date(verif.expires_at).getTime() < Date.now()) {
      return jsonErr("Ce lien a expiré", "expired");
    }

    // Re-check : le vendor n'a pas été rattaché entre-temps par un autre canal
    const { data: vendor } = await supabaseAdmin
      .from("vendors")
      .select("id, auth_user_id, company_name, name")
      .eq("id", verif.vendor_id)
      .maybeSingle();

    if (!vendor) return jsonErr("Vendeur introuvable", "vendor_not_found");
    if (vendor.auth_user_id && vendor.auth_user_id !== verif.user_id) {
      // Quelqu'un d'autre a déjà été rattaché : on consomme le token pour qu'il ne reste pas vivant
      await supabaseAdmin
        .from("vendor_attach_verifications")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", verif.id);
      return jsonErr("Ce vendeur est déjà rattaché à un autre compte", "vendor_already_attached");
    }

    // Re-check : email pas réattribué entre-temps à un autre vendor
    const { data: emailConflict } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .ilike("email", verif.email)
      .neq("id", verif.vendor_id)
      .maybeSingle();
    if (emailConflict) {
      return jsonErr("Cet email est désormais rattaché à un autre vendeur", "email_conflict");
    }

    // Activation : on pose auth_user_id + email, puis on marque le token consommé.
    if (!vendor.auth_user_id) {
      const { error: updErr } = await supabaseAdmin
        .from("vendors")
        .update({ auth_user_id: verif.user_id, email: verif.email })
        .eq("id", verif.vendor_id);
      if (updErr) return jsonErr(`Erreur activation: ${updErr.message}`, "attach_failed");
    }

    const consumedIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || null;

    await supabaseAdmin
      .from("vendor_attach_verifications")
      .update({ consumed_at: new Date().toISOString(), consumed_ip: consumedIp })
      .eq("id", verif.id);

    // Génère un magic-link recovery pour permettre au destinataire de poser son mot de passe
    let recoveryUrl: string | null = null;
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: verif.email,
        options: { redirectTo: "https://www.medikong.pro/vendor/login" },
      });
      recoveryUrl = linkData?.properties?.action_link ?? null;
    } catch (e) {
      console.warn("[verify-vendor-attach] generateLink failed:", e);
    }

    // Audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "vendor_attach_verified",
        resource_type: "vendor",
        resource_id: verif.vendor_id,
        metadata: { user_id: verif.user_id, email: verif.email, ip: consumedIp },
      });
    } catch (e) { console.warn("[verify-vendor-attach] audit log failed:", e); }

    return jsonOk({
      vendor_id: verif.vendor_id,
      login_email: verif.email,
      company_name: vendor.company_name || vendor.name,
      recovery_url: recoveryUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return jsonErr(message, "internal_error", 500);
  }
});
