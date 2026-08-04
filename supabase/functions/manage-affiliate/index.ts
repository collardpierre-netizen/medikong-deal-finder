// Gestion des apporteurs d'affaires (admin uniquement).
// Actions : create | invite | update | set_status
// Le portail /apporteur est gaté par affiliates.user_id = auth.uid()
// (même pattern que vendors.auth_user_id — pas de système de rôles parallèle).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const guard = await requireAdminOrService(req);
  if (!guard.ok) return json({ ok: false, error: guard.error }, guard.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  try {
    // ---------------------------------------------------------------- create
    if (action === "create") {
      const displayName = String(body?.display_name ?? "").trim();
      const email = String(body?.email ?? "").trim().toLowerCase();
      if (!displayName || !email) return json({ ok: false, error: "display_name et email requis" }, 400);

      let code = String(body?.affiliate_code ?? "").trim().toUpperCase();
      if (!code) {
        const base = slugify(displayName).replace(/-/g, "").slice(0, 8).toUpperCase() || "APP";
        code = `AP-${base}${String(new Date().getFullYear()).slice(-2)}`;
      }

      const { data: aff, error } = await admin
        .from("affiliates")
        .insert({
          affiliate_code: code,
          display_name: displayName,
          email,
          company_name: body?.company_name ?? null,
          vat_number: body?.vat_number ?? null,
          phone: body?.phone ?? null,
          iban: body?.iban ?? null,
          notes_admin: body?.notes_admin ?? null,
          status: "invited",
        })
        .select("*")
        .single();
      if (error) return json({ ok: false, error: error.message }, 400);

      // Campagne par défaut : /go/<code en minuscules>
      const slug = code.toLowerCase();
      const { data: camp } = await admin
        .from("tracking_campaigns")
        .insert({
          slug,
          name: `Lien permanent — ${displayName}`,
          owner_type: "affiliate",
          owner_id: aff.id,
          partner_label: displayName,
          landing_path: "/",
          utm_source: code.toLowerCase(),
          utm_medium: "affiliate",
          utm_campaign: "lien-permanent",
          status: "active",
        })
        .select("id")
        .maybeSingle();

      if (camp?.id) {
        await admin.from("affiliates").update({ default_campaign_id: camp.id }).eq("id", aff.id);
      }

      return json({ ok: true, affiliate_id: aff.id, affiliate_code: code, campaign_id: camp?.id ?? null });
    }

    // ---------------------------------------------------------------- invite
    if (action === "invite") {
      const affiliateId = String(body?.affiliate_id ?? "");
      if (!affiliateId) return json({ ok: false, error: "affiliate_id requis" }, 400);

      const { data: aff } = await admin
        .from("affiliates").select("id, email, user_id, status").eq("id", affiliateId).maybeSingle();
      if (!aff) return json({ ok: false, error: "apporteur introuvable" }, 404);

      const redirectTo = String(body?.redirect_to ?? "https://medikong.pro/apporteur");
      let userId: string | null = aff.user_id ?? null;

      if (!userId) {
        const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(aff.email, {
          redirectTo,
        });
        if (invited?.user?.id) {
          userId = invited.user.id;
        } else {
          // compte déjà existant : on le retrouve puis on envoie un magic link
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = list?.users?.find((u) => (u.email ?? "").toLowerCase() === aff.email.toLowerCase());
          if (!found) return json({ ok: false, error: invErr?.message ?? "invitation impossible" }, 400);
          userId = found.id;
          await admin.auth.admin.generateLink({ type: "magiclink", email: aff.email, options: { redirectTo } });
        }
      } else {
        await admin.auth.admin.generateLink({ type: "magiclink", email: aff.email, options: { redirectTo } });
      }

      const { error: updErr } = await admin
        .from("affiliates")
        .update({ user_id: userId, status: aff.status === "invited" ? "active" : aff.status, updated_at: new Date().toISOString() })
        .eq("id", affiliateId);
      if (updErr) return json({ ok: false, error: updErr.message }, 400);

      return json({ ok: true, user_id: userId });
    }

    // ---------------------------------------------------------------- update
    if (action === "update") {
      const affiliateId = String(body?.affiliate_id ?? "");
      if (!affiliateId) return json({ ok: false, error: "affiliate_id requis" }, 400);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ["display_name", "company_name", "vat_number", "email", "phone", "iban", "notes_admin"]) {
        if (body?.[k] !== undefined) patch[k] = body[k];
      }
      const { error } = await admin.from("affiliates").update(patch).eq("id", affiliateId);
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true });
    }

    // ------------------------------------------------------------ set_status
    if (action === "set_status") {
      const affiliateId = String(body?.affiliate_id ?? "");
      const status = String(body?.status ?? "");
      if (!["invited", "active", "suspended", "terminated"].includes(status)) {
        return json({ ok: false, error: "statut invalide" }, 400);
      }
      const { error } = await admin
        .from("affiliates")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", affiliateId);
      if (error) return json({ ok: false, error: error.message }, 400);

      // Suspension/résiliation : on stoppe aussi les campagnes (plus d'attribution)
      if (status === "suspended" || status === "terminated") {
        await admin
          .from("tracking_campaigns")
          .update({ status: "paused" })
          .eq("owner_type", "affiliate")
          .eq("owner_id", affiliateId)
          .eq("status", "active");
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "action inconnue" }, 400);
  } catch (e) {
    console.error("manage-affiliate error", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
