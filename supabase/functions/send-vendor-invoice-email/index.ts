// Envoie une facture fournisseur par e-mail (coordonnées bancaires MediKong + lien PDF signé).
// Payload: { invoice_id, pdf_path?, recipient_email? }
// Accès: admin ou service_role uniquement.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/admin-or-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "invoices";
const TTL_SECONDS = 60 * 60 * 24 * 7;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const kindLabel = (type: string | null) => {
  if (type === "commission") return "Facture de commission MediKong";
  if (type === "self_billing") return "Facture au nom et pour le compte du fournisseur";
  return "Facture fournisseur";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAdminOrService(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let body: { invoice_id?: string; pdf_path?: string; recipient_email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const invoiceId = body.invoice_id;
  if (!invoiceId || typeof invoiceId !== "string") return json({ error: "invoice_id required" }, 400);

  const { data: inv, error: iErr } = await supabase
    .from("order_invoices")
    .select(
      "id, invoice_number, type, status, amount_incl_vat, due_date, pdf_path, vendor_id, order_id, vendor:vendors!order_invoices_vendor_id_fkey(name, company_name, email, contact_email)",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (iErr) return json({ error: "DB error", details: iErr.message }, 500);
  if (!inv) return json({ error: "invoice_not_found" }, 404);

  const vendor = (inv as any).vendor as
    | { name: string | null; company_name: string | null; email: string | null; contact_email: string | null }
    | null;
  const recipient = body.recipient_email || vendor?.email || vendor?.contact_email;
  if (!recipient) return json({ error: "no_vendor_email" }, 400);

  const path = body.pdf_path || (inv as any).pdf_path;
  if (!path) return json({ error: "no_pdf" }, 400);

  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS, { download: `${(inv as any).invoice_number || "facture"}.pdf` });
  if (sErr || !signed?.signedUrl) return json({ error: "sign_failed", details: sErr?.message }, 500);

  const amount = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(
    Number((inv as any).amount_incl_vat ?? 0),
  );
  const dueDate = (inv as any).due_date
    ? new Date((inv as any).due_date).toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  const { error: mailErr } = await supabase.functions.invoke("send-app-email", {
    body: {
      templateName: "vendor-invoice-document",
      recipientEmail: recipient,
      idempotencyKey: `vendor-invoice-${invoiceId}-${path}`,
      templateData: {
        vendorName: vendor?.company_name || vendor?.name || "Fournisseur",
        invoiceNumber: (inv as any).invoice_number || "",
        kindLabel: kindLabel((inv as any).type),
        amount,
        dueDate,
        reference: (inv as any).invoice_number || "",
        pdfUrl: signed.signedUrl,
        isSelfBilling: (inv as any).type === "self_billing",
      },
    },
  });
  if (mailErr) {
    console.error("[send-vendor-invoice-email] send-app-email failed", mailErr);
    return json({ error: String(mailErr.message || mailErr) }, 500);
  }

  const patch: Record<string, unknown> = {
    sent_at: new Date().toISOString(),
    sent_channel: "email",
    sent_to: recipient,
  };
  if (body.pdf_path) patch.pdf_path = body.pdf_path;
  if (auth.via === "admin" && auth.userId) patch.sent_by = auth.userId;
  const { error: uErr } = await supabase.from("order_invoices").update(patch).eq("id", invoiceId);
  if (uErr) console.error("[send-vendor-invoice-email] trace update failed", uErr);

  return json({ sent: true, recipient });
});
