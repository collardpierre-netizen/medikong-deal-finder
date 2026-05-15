import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const orderId = body.order_id;
  if (!orderId) return json({ error: "order_id required" }, 400);

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, order_number, customer:customers!orders_customer_id_fkey(email, company_name)")
    .eq("id", orderId)
    .maybeSingle();
  if (oErr || !order) return json({ error: "Order not found" }, 404);

  const customer = (order as any).customer as { email: string; company_name: string | null } | null;
  if (!customer?.email) return json({ error: "No customer email" }, 400);

  const { data: invoices, error: iErr } = await supabase
    .from("order_invoices")
    .select("invoice_number, amount_incl_vat, pdf_url, hosted_url, vendor:vendors!order_invoices_vendor_id_fkey(name)")
    .eq("order_id", orderId)
    .in("status", ["finalized", "paid"]);
  if (iErr) return json({ error: "DB error" }, 500);
  if (!invoices || invoices.length === 0) return json({ error: "No finalized invoices" }, 400);

  const formatEUR = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const items = invoices.map((inv: any) => ({
    vendorName: inv.vendor?.name ?? "Vendeur",
    invoiceNumber: inv.invoice_number ?? "",
    amount: formatEUR(Number(inv.amount_incl_vat ?? 0)),
    pdfUrl: inv.pdf_url ?? "",
    hostedUrl: inv.hosted_url ?? "",
  }));

  const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "vendor-invoices",
      recipientEmail: customer.email,
      idempotencyKey: `vendor-invoices-${orderId}`,
      templateData: {
        orderNumber: (order as any).order_number,
        customerName: customer.company_name ?? undefined,
        invoices: items,
      },
    },
  });
  if (sendErr) {
    console.error("[send-invoices-email] send-transactional-email failed", sendErr);
    return json({ error: String(sendErr.message || sendErr) }, 500);
  }

  return json({ sent: true, count: items.length });
});
