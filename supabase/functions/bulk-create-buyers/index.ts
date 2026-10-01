// Création de comptes acheteurs en masse (admin uniquement).
// Pour chaque ligne : compte de connexion sans mot de passe + fiche client,
// puis email « Votre compte a été créé » avec un lien pour choisir son mot de passe.
// Mode "resend" : renvoie l'invitation d'un compte existant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_ROWS = 200;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TYPE_MAP: Record<string, { type: string; apbRequired: boolean }> = {
  pharmacien: { type: "pharmacy", apbRequired: true },
  pharmacie: { type: "pharmacy", apbRequired: true },
  "professionnel de sante": { type: "doctor", apbRequired: false },
  medecin: { type: "doctor", apbRequired: false },
  "maison de repos": { type: "nursing_home", apbRequired: false },
  groupement: { type: "other", apbRequired: false },
  revendeur: { type: "retail", apbRequired: false },
};
export const normType = (t: string) =>
  String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const REDIRECT = "https://medikong.pro/reset-password";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Non autorisé" }, 401);
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) return json({ error: "Non autorisé" }, 401);
    const { data: adminRow } = await admin.from("admin_users").select("id")
      .eq("user_id", caller.id).eq("is_active", true).maybeSingle();
    if (!adminRow) return json({ error: "Accès refusé" }, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Requête invalide" }, 400);

    const sendInvite = async (email: string, companyName: string, verified: boolean, key: string) => {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery", email, options: { redirectTo: REDIRECT },
      });
      if (linkErr || !link?.properties?.action_link) return { sent: false, error: linkErr?.message || "lien impossible" };
      const { data, error } = await admin.functions.invoke("send-app-email", {
        headers: { Authorization: `Bearer ${serviceKey}` },
        body: {
          templateName: "buyer-account-created",
          recipientEmail: email,
          idempotencyKey: key,
          templateData: { companyName, email, setPasswordUrl: link.properties.action_link, verified },
        },
      });
      if (error) {
        let detail = error.message || String(error);
        try { const t = await (error as any).context?.response?.clone().text(); if (t) detail += ` | ${t.slice(0, 300)}`; } catch { /* */ }
        return { sent: false, error: detail };
      }
      return { sent: (data as any)?.sent !== false, error: (data as any)?.reason ?? null };
    };

    // ── Mode renvoi ─────────────────────────────────────────────
    if (body.mode === "resend") {
      const customerId = String(body.customer_id ?? "");
      if (!customerId) return json({ error: "customer_id requis" }, 400);
      const { data: c } = await admin.from("customers")
        .select("id, email, company_name, is_verified, auth_user_id").eq("id", customerId).maybeSingle();
      if (!c || !c.auth_user_id) return json({ error: "Compte introuvable" }, 404);
      const r = await sendInvite(c.email.toLowerCase(), c.company_name, c.is_verified, `buyer-account-created-${c.id}-resend-${Date.now()}`);
      return json({ success: r.sent, ...r });
    }

    // ── Mode import ─────────────────────────────────────────────
    const rows = Array.isArray(body.rows) ? body.rows : null;
    if (!rows || rows.length === 0) return json({ error: "Aucune ligne" }, 400);
    if (rows.length > MAX_ROWS) return json({ error: `Maximum ${MAX_ROWS} comptes par import` }, 400);
    const verified = body.verified === true;

    // Emails déjà connus (clients + comptes de connexion)
    const emails = rows.map((r: any) => String(r?.email ?? "").trim().toLowerCase());
    const { data: existingCustomers } = await admin.from("customers").select("email").in("email", emails.filter(Boolean));
    const known = new Set((existingCustomers ?? []).map((c: any) => String(c.email).toLowerCase()));
    const authEmails = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      users.forEach((u: any) => u.email && authEmails.add(u.email.toLowerCase()));
      if (users.length < 1000) break;
    }

    const seen = new Set<string>();
    const results: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      const name = String(r.name ?? "").trim().slice(0, 200);
      const email = emails[i];
      const phone = String(r.phone ?? "").trim().slice(0, 40) || null;
      const apb = String(r.apb ?? "").replace(/\D/g, "");
      const t = TYPE_MAP[normType(r.type)];
      const base = { line: i + 1, name, email };

      if (!name) { results.push({ ...base, status: "error", message: "Nom manquant" }); continue; }
      if (!EMAIL_RE.test(email)) { results.push({ ...base, status: "error", message: "Email invalide" }); continue; }
      if (!t) { results.push({ ...base, status: "error", message: `Type inconnu : « ${r.type ?? ""} »` }); continue; }
      if (t.apbRequired && !apb) { results.push({ ...base, status: "error", message: "APB requis pour ce type" }); continue; }
      if (seen.has(email)) { results.push({ ...base, status: "skipped", message: "Email en double dans la liste" }); continue; }
      seen.add(email);
      if (known.has(email) || authEmails.has(email)) { results.push({ ...base, status: "skipped", message: "Compte déjà existant" }); continue; }

      // Rattachement APB → officine de l'annuaire (adresse, ville, code postal)
      let pharmacy: any = null;
      if (apb) {
        const { data } = await admin.from("be_pharmacies")
          .select("id, address_line1, postal_code, city, country_code").eq("apb_number", apb).maybeSingle();
        pharmacy = data;
      }

      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email, email_confirm: true, user_metadata: { role: "buyer", company_name: name, created_by_admin: true },
      });
      if (authErr || !created?.user) { results.push({ ...base, status: "error", message: `Compte : ${authErr?.message || "échec"}` }); continue; }

      const { data: cust, error: custErr } = await admin.from("customers").insert({
        auth_user_id: created.user.id,
        company_name: name,
        email,
        phone,
        customer_type: t.type,
        country_code: pharmacy?.country_code || "BE",
        address_line1: pharmacy?.address_line1 || "—",
        city: pharmacy?.city || "—",
        postal_code: pharmacy?.postal_code || "0000",
        be_pharmacy_id: pharmacy?.id ?? null,
        is_verified: verified,
      }).select("id").single();
      if (custErr || !cust) {
        await admin.auth.admin.deleteUser(created.user.id);
        results.push({ ...base, status: "error", message: `Fiche client : ${custErr?.message || "échec"}` });
        continue;
      }

      const mail = await sendInvite(email, name, verified, `buyer-account-created-${cust.id}`);
      results.push({
        ...base, status: "created", customer_id: cust.id, email_sent: mail.sent,
        message: [
          apb && !pharmacy ? "APB introuvable dans l'annuaire (non enregistré)" : null,
          mail.sent ? null : `Email non envoyé : ${mail.error ?? "?"}`,
        ].filter(Boolean).join(" · ") || null,
      });
    }

    const pre = (body.precheck && typeof body.precheck === "object") ? body.precheck : {};
    const preSkipped = Math.max(0, Number((pre as any).skipped) || 0);
    const preErrors = Math.max(0, Number((pre as any).errors) || 0);
    await admin.from("admin_audit_log").insert({
      admin_id: caller.id, admin_email: caller.email, action: "bulk_create_buyers",
      target_type: "customer", metadata: {
        verified,
        file_name: String(body.file_name ?? "").slice(0, 200) || null,
        total: rows.length + preSkipped + preErrors,
        created: results.filter((r) => r.status === "created").length,
        skipped: results.filter((r) => r.status === "skipped").length + preSkipped,
        errors: results.filter((r) => r.status === "error").length + preErrors,
        emails_sent: results.filter((r) => r.status === "created" && r.email_sent).length,
      },
    }).then(() => {}, () => {});

    return json({ success: true, results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
