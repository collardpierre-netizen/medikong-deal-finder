// Envoie au client le lien de signature en ligne d'un bon de livraison.
// Appelable par un admin connecté ou par le fournisseur propriétaire du BL.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!bearer) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  // Client "utilisateur" : les RPC de génération de jeton vérifient elles-mêmes
  // que l'appelant est admin ou fournisseur propriétaire du bon de livraison.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const deliveryNoteId = String(body?.deliveryNoteId ?? "");
  if (!deliveryNoteId) return json({ error: "deliveryNoteId required" }, 400);
  const dryRun = body?.dryRun === true;

  const { data: token, error: tokErr } = await asUser.rpc(
    "create_delivery_note_confirmation_token",
    { _delivery_note_id: deliveryNoteId },
  );
  if (tokErr || !token) {
    const msg = tokErr?.message ?? "token_generation_failed";
    const status = msg.includes("unauthorized") ? 403 : 422;
    return json({ error: msg }, status);
  }

  const { data: note } = await admin
    .from("delivery_notes")
    .select("id, document_number, order_id, delivery_note_lines(id)")
    .eq("id", deliveryNoteId)
    .maybeSingle();
  if (!note) return json({ error: "delivery_note_not_found" }, 404);

  const { data: order } = await admin
    .from("orders")
    .select("order_number, customer_id")
    .eq("id", note.order_id)
    .maybeSingle();

  const { data: customer } = await admin
    .from("customers")
    .select("email, company_name")
    .eq("id", order?.customer_id ?? "")
    .maybeSingle();

  const recipientEmail = String(body?.recipientEmail || customer?.email || "").trim();
  if (!recipientEmail) return json({ error: "customer_email_missing" }, 422);

  const appOrigin = String(body?.appOrigin || "https://medikong.pro").replace(/\/+$/, "");
  const confirmUrl = `${appOrigin}/livraison/${encodeURIComponent(String(token))}`;

  // Checklist de réception embarquée dans l'e-mail (les pièces jointes ne sont
  // pas supportées par l'infrastructure d'envoi) — même liste que la page signée.
  const CHECKLIST_ITEMS = [
    "Nombre de colis reçus conforme au bon de livraison",
    "Emballages intacts, aucun colis ouvert ou écrasé",
    "Quantités reçues conformes aux quantités livrées",
    "Numéros de lot et dates de péremption (DLU) vérifiés",
    "Chaîne du froid respectée (si applicable)",
    "Documents d'accompagnement présents et lisibles",
  ];

  const templateData = {
    documentNumber: note.document_number,
    orderNumber: order?.order_number,
    customerName: customer?.company_name || undefined,
    confirmUrl,
    lineCount: (note as any).delivery_note_lines?.length ?? 0,
    checklistItems: CHECKLIST_ITEMS,
  };
  const idempotencyKey = `delivery-confirmation-${deliveryNoteId}-${String(token).slice(0, 8)}`;

  if (dryRun) {
    return json({ dryRun: true, recipient: recipientEmail, confirmUrl, templateData, idempotencyKey });
  }

  const { error: sendErr } = await admin.functions.invoke("send-app-email", {
    body: {
      templateName: "delivery-confirmation-request",
      recipientEmail,
      idempotencyKey,
      templateData,
    },
  });
  if (sendErr) return json({ error: "email_invoke_failed", detail: sendErr.message, confirmUrl }, 502);

  return json({ success: true, recipient: recipientEmail, confirmUrl });
});
