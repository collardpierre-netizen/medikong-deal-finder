// Crée une Stripe Checkout Session (paiement par virement SEPA / customer_balance)
// pour une facture self-billing et enregistre le lien sur la facture.
import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ORIGINS = new Set([
  "https://medikong.pro",
  "https://www.medikong.pro",
  "https://medikong-deal-finder.lovable.app",
  "https://dev.medikong.pro",
]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Non autorisé" });
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (!caller) return json(401, { error: "Non autorisé" });

    // Gate admin
    const { data: admin } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!admin) return json(403, { error: "Accès refusé" });

    const { invoice_id, regenerate } = await req.json().catch(() => ({}));
    if (!invoice_id) return json(400, { error: "invoice_id requis" });

    // Charge la facture self-billing
    const { data: invoice, error: invErr } = await supabase
      .from("order_invoices")
      .select(
        "id, type, invoice_number, amount_incl_vat, status, order_id, vendor_id, due_date, stripe_checkout_session_id, stripe_checkout_url",
      )
      .eq("id", invoice_id)
      .maybeSingle();

    if (invErr || !invoice) return json(404, { error: "Facture introuvable" });
    if (invoice.type !== "self_billing") {
      return json(400, {
        error: "Lien de paiement SEPA réservé aux factures self-billing",
      });
    }
    if (invoice.status === "paid") {
      return json(400, { error: "Facture déjà payée" });
    }
    const amount = Number(invoice.amount_incl_vat || 0);
    if (!amount || amount <= 0) {
      return json(400, { error: "Montant de facture invalide" });
    }

    // Réutilise le lien existant si valable et non expiré
    if (!regenerate && invoice.stripe_checkout_session_id) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          invoice.stripe_checkout_session_id,
        );
        if (existing.status === "open" && existing.url) {
          return json(200, {
            url: existing.url,
            session_id: existing.id,
            reused: true,
            email_sent: false,
          });
        }
      } catch (_e) { /* recrée */ }
    }

    // Récupère l'acheteur (email + nom) via order -> customer
    let customerEmail: string | undefined;
    let customerName: string | undefined;
    let orderNumber: string | undefined;
    if (invoice.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number, customer:customers(email, first_name, last_name, company_name)")
        .eq("id", invoice.order_id)
        .maybeSingle();
      const c: any = (order as any)?.customer;
      customerEmail = c?.email || undefined;
      customerName =
        c?.company_name ||
        [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() ||
        undefined;
      orderNumber = (order as any)?.order_number || undefined;
    }

    // Coordonnées bancaires du vendeur (self-billing = paiement direct au vendeur)
    let vendorName = "";
    let vendorBank = { bankName: "", iban: "", bic: "" };
    if (invoice.vendor_id) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, company_name, bank_name, iban, bic")
        .eq("id", invoice.vendor_id)
        .maybeSingle();
      const v: any = vendor;
      vendorName = v?.company_name || v?.name || "";
      vendorBank = {
        bankName: v?.bank_name || "",
        iban: v?.iban || "",
        bic: v?.bic || "",
      };
    }

    const rawOrigin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      "";
    const origin = ALLOWED_ORIGINS.has(rawOrigin) ? rawOrigin : "https://medikong.pro";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["customer_balance"],
      payment_method_options: {
        customer_balance: {
          funding_type: "bank_transfer",
          bank_transfer: { type: "eu_bank_transfer", eu_bank_transfer: { country: "BE" } },
        },
      },
      currency: "eur",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Facture ${invoice.invoice_number ?? invoice.id}`,
              description: "Paiement par virement SEPA",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/paiement/succes?invoice=${invoice.id}`,
      cancel_url: `${origin}/paiement/annule?invoice=${invoice.id}`,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number ?? "",
        invoice_type: "self_billing",
        vendor_id: invoice.vendor_id ?? "",
        order_id: invoice.order_id ?? "",
        payment_method: "sepa_bank_transfer",
      },
    });

    if (!session.url) {
      return json(500, { error: "Stripe n'a pas renvoyé d'URL de checkout" });
    }

    const { error: updErr } = await supabase
      .from("order_invoices")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_checkout_url: session.url,
        stripe_checkout_created_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (updErr) {
      console.error("[create-invoice-sepa-checkout] update failed", updErr);
      return json(500, { error: "Échec enregistrement du lien" });
    }

    // Envoi email client (best-effort)
    let emailSent = false;
    if (customerEmail) {
      try {
        const amountFmt = new Intl.NumberFormat("fr-BE", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
        const dueDateFmt = invoice.due_date
          ? new Date(invoice.due_date).toLocaleDateString("fr-BE", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";
        const ref = invoice.invoice_number || orderNumber || invoice.id;
        const { error: sendErr } = await supabase.functions.invoke(
          "send-app-email",
          {
            body: {
              templateName: "invoice-payment-link",
              recipientEmail: customerEmail,
              idempotencyKey: `invoice-payment-link-${invoice.id}-${session.id}`,
              templateData: {
                customerName,
                vendorName,
                invoiceNumber: invoice.invoice_number ?? "",
                orderNumber: orderNumber ?? "",
                amountIncVat: amountFmt,
                dueDate: dueDateFmt,
                payUrl: session.url,
                bankName: vendorBank.bankName,
                iban: vendorBank.iban,
                bic: vendorBank.bic,
                paymentReference: ref,
              },
            },
          },
        );
        if (sendErr) {
          console.error("[create-invoice-sepa-checkout] email send failed", sendErr);
        } else {
          emailSent = true;
        }
      } catch (e) {
        console.error("[create-invoice-sepa-checkout] email exception", e);
      }
    }

    return json(200, {
      url: session.url,
      session_id: session.id,
      reused: false,
      email_sent: emailSent,
      email_recipient: customerEmail ?? null,
    });
  } catch (err) {
    console.error("[create-invoice-sepa-checkout] error", err);
    return json(500, {
      error: err instanceof Error ? err.message : "Erreur interne",
    });
  }
});
