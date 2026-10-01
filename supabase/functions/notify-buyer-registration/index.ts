// Emails à l'inscription d'un acheteur : confirmation au client + alerte aux admins.
// Appelée par le nouvel inscrit ; les données viennent de sa fiche, jamais du navigateur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ADMIN_RECIPIENTS = ["admin@medikong.pro", "pcoll@medikong.pro", "collardpierre@gmail.com"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Non autorisé" }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Non autorisé" }, 401);

    const { data: c } = await admin.from("customers")
      .select("id, email, company_name, phone, country_code, vat_number, customer_type, is_verified")
      .eq("auth_user_id", user.id).maybeSingle();
    if (!c) return json({ error: "Fiche introuvable" }, 404);
    if (c.is_verified) return json({ success: true, skipped: "already_verified" });

    const send = (templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) =>
      admin.functions.invoke("send-app-email", {
        headers: { Authorization: `Bearer ${serviceKey}` },
        body: { templateName, recipientEmail, idempotencyKey, templateData },
      }).then(({ error }) => !error).catch(() => false);

    const results: Record<string, boolean> = {};
    results[c.email] = await send("buyer-registration-received", c.email, `buyer-reg-received-${c.id}`,
      { companyName: c.company_name });
    for (const to of ADMIN_RECIPIENTS) {
      results[to] = await send("buyer-registration", to, `buyer-reg-${c.id}-${to}`, {
        companyName: c.company_name, email: c.email, phone: c.phone || undefined,
        country: c.country_code || "BE", vatNumber: c.vat_number || undefined, sector: c.customer_type || undefined,
      });
    }
    return json({ success: true, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
