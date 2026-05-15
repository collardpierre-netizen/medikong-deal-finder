import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: { order_id?: string; session_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const orderId = body.order_id;
  if (!orderId) return jsonResponse({ error: "order_id required" }, 400);

  // 1. Fetch order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_number, customer_id, payment_status, billing_address")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) {
    console.error("[generate-vendor-invoices] order fetch error", orderErr);
    return jsonResponse({ error: "DB error" }, 500);
  }
  if (!order) return jsonResponse({ error: "Order not found" }, 404);
  if (order.payment_status !== "paid") {
    return jsonResponse({ error: "Order not paid" }, 400);
  }

  // 2. Fetch order_lines grouped by vendor
  const { data: lines, error: linesErr } = await supabase
    .from("order_lines")
    .select(`
      id, order_id, vendor_id, product_id, quantity,
      unit_price_excl_vat, unit_price_incl_vat, vat_rate,
      line_total_excl_vat, line_total_incl_vat,
      product:products!order_lines_product_id_fkey(name, gtin),
      vendor:vendors!order_lines_vendor_id_fkey(name, slug, stripe_account_id)
    `)
    .eq("order_id", orderId);
  if (linesErr) {
    console.error("[generate-vendor-invoices] lines fetch error", linesErr);
    return jsonResponse({ error: "DB error" }, 500);
  }
  if (!lines || lines.length === 0) {
    return jsonResponse({ error: "No order lines" }, 400);
  }

  // 3. Fetch / create Stripe customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, email, company_name, stripe_customer_id")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (custErr || !customer) {
    return jsonResponse({ error: "Customer not found" }, 404);
  }

  let stripeCustomerId = customer.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const billing = (order.billing_address ?? {}) as Record<string, any>;
    const created = await stripe.customers.create(
      {
        email: customer.email,
        name: customer.company_name || customer.email,
        address: {
          line1: billing.line1 || billing.address_line1 || "",
          line2: billing.line2 || billing.address_line2 || undefined,
          city: billing.city || "",
          postal_code: billing.postal_code || "",
          country: billing.country || billing.country_code || "BE",
        },
        metadata: { medikong_customer_id: customer.id },
      },
      { idempotencyKey: `cust_${customer.id}` },
    );
    stripeCustomerId = created.id;
    await supabase
      .from("customers")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", customer.id);
  }

  // Group lines by vendor
  const byVendor = new Map<string, typeof lines>();
  for (const l of lines) {
    const arr = byVendor.get(l.vendor_id) ?? [];
    arr.push(l);
    byVendor.set(l.vendor_id, arr);
  }

  const invoicesCreated: Array<{ vendor_id: string; vendor_name: string; invoice_number: string; pdf_url: string }> = [];
  const errors: Array<{ vendor_id: string; vendor_name: string; error: string }> = [];

  for (const [vendorId, vLines] of byVendor.entries()) {
    const vendor = (vLines[0] as any).vendor as { name: string; stripe_account_id: string | null } | null;
    const vendorName = vendor?.name || "Vendor";

    // a) idempotency: skip if already finalized/paid
    const { data: existing } = await supabase
      .from("order_invoices")
      .select("id, status, stripe_invoice_id")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (existing && (existing.status === "finalized" || existing.status === "paid")) {
      console.log(`[generate-vendor-invoices] vendor ${vendorId} already invoiced, skip`);
      continue;
    }

    // b) skip if no stripe_account_id
    if (!vendor?.stripe_account_id) {
      console.warn(`[generate-vendor-invoices] vendor ${vendorId} has no stripe_account_id`);
      await supabase.from("order_invoices").upsert(
        {
          order_id: orderId,
          vendor_id: vendorId,
          status: "failed",
          error_message: "vendor has no stripe_account_id",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,vendor_id" },
      );
      errors.push({ vendor_id: vendorId, vendor_name: vendorName, error: "no stripe_account_id" });
      continue;
    }

    try {
      // c) create invoice items
      for (const line of vLines as any[]) {
        await stripe.invoiceItems.create(
          {
            customer: stripeCustomerId!,
            unit_amount: Math.round(Number(line.unit_price_incl_vat) * 100),
            quantity: line.quantity,
            currency: "eur",
            description: `${line.product?.name ?? "Produit"} (GTIN ${line.product?.gtin ?? "—"})`,
            metadata: {
              order_id: orderId,
              order_line_id: line.id,
              vendor_id: vendorId,
              order_number: order.order_number,
            },
          },
          { idempotencyKey: `iitem_${line.id}` },
        );
      }

      // d) create invoice on_behalf_of
      const invoice = await stripe.invoices.create(
        {
          customer: stripeCustomerId!,
          on_behalf_of: vendor.stripe_account_id,
          auto_advance: false,
          collection_method: "send_invoice",
          days_until_due: 0,
          description: `Commande Medikong ${order.order_number}`,
          custom_fields: [{ name: "Commande", value: order.order_number }],
          footer: `Facture émise par ${vendorName} avec l'assistance technique de Medikong, opérateur de marketplace.`,
          metadata: {
            order_id: orderId,
            order_number: order.order_number,
            vendor_id: vendorId,
            platform: "medikong",
          },
        },
        { idempotencyKey: `inv_${orderId}_${vendorId}` },
      );

      // e) finalize
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

      // f) pay out_of_band
      const paid = await stripe.invoices.pay(finalized.id, { paid_out_of_band: true });

      // g) upsert
      const subtotal = (paid.subtotal ?? 0) / 100;
      const total = (paid.total ?? 0) / 100;
      const vat = total - subtotal;

      await supabase.from("order_invoices").upsert(
        {
          order_id: orderId,
          vendor_id: vendorId,
          stripe_invoice_id: paid.id,
          stripe_customer_id: stripeCustomerId,
          invoice_number: paid.number ?? null,
          status: "finalized",
          amount_excl_vat: subtotal,
          vat_amount: vat,
          amount_incl_vat: total,
          pdf_url: paid.invoice_pdf ?? null,
          hosted_url: paid.hosted_invoice_url ?? null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,vendor_id" },
      );

      invoicesCreated.push({
        vendor_id: vendorId,
        vendor_name: vendorName,
        invoice_number: paid.number ?? "",
        pdf_url: paid.invoice_pdf ?? "",
      });
    } catch (err: any) {
      console.error(`[generate-vendor-invoices] vendor ${vendorId} failed:`, err);
      await supabase.from("order_invoices").upsert(
        {
          order_id: orderId,
          vendor_id: vendorId,
          status: "failed",
          error_message: String(err?.message || err),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,vendor_id" },
      );
      errors.push({ vendor_id: vendorId, vendor_name: vendorName, error: String(err?.message || err) });
    }
  }

  // 5. Trigger email if at least one invoice created
  if (invoicesCreated.length > 0) {
    try {
      await supabase.functions.invoke("send-invoices-email", { body: { order_id: orderId } });
    } catch (e) {
      console.error("[generate-vendor-invoices] send-invoices-email failed", e);
    }
  }

  return jsonResponse({
    invoices_created: invoicesCreated,
    errors,
    total_invoices: invoicesCreated.length,
  });
});
