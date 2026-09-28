// Admin : envoie l'invitation MediKong Scan à l'officine (activation de l'accès ou « Renvoyer l'invitation »).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const auth = await requireAdminOrService(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const { customer_id } = await req.json().catch(() => ({}));
  if (typeof customer_id !== "string" || !/^[0-9a-f-]{36}$/i.test(customer_id)) return json({ error: "customer_id invalide" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: c } = await admin.from("customers").select("id, company_name, email, auth_user_id, scan_enabled").eq("id", customer_id).maybeSingle();
  if (!c) return json({ error: "Officine introuvable" }, 404);
  if (!c.scan_enabled) return json({ error: "Accès Scan désactivé pour cette officine" }, 409);
  let to: string | null = null;
  if (c.auth_user_id) { const { data } = await admin.auth.admin.getUserById(c.auth_user_id); to = data?.user?.email ?? null; }
  to = to ?? c.email ?? null;
  if (!to) return json({ error: "Aucune adresse e-mail pour cette officine" }, 422);
  try {
    const r = await sendTemplateEmail("scan-invitation", to, {
      templateData: { pharmacyName: c.company_name ?? undefined },
      idempotencyKey: `scan-invitation-${c.id}-${Date.now()}`,
    });
    if (r.sent) await admin.from("audit_logs").insert({ action: "scan_invitation_sent", user_id: auth.userId ?? null, module: "scan", entity_type: "customers", entity_id: c.id, metadata: { to } });
    return json({ ok: r.sent, to, reason: (r as any).reason ?? null });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});
