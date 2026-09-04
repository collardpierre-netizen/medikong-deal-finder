import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;
// deno-lint-ignore no-explicit-any
export type StripeLike = any;

export interface HandlerDeps {
  /** Factory injectable pour les tests (sinon : Supabase service-role réel). */
  makeClient?: () => SupabaseClientLike;
  /** Factory injectable pour les tests (sinon : Stripe réel via STRIPE_SECRET_KEY). */
  makeStripe?: () => StripeLike;
  defaultCommission?: number;
}

export async function handler(req: Request, deps: HandlerDeps = {}): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripe = deps.makeStripe
      ? deps.makeStripe()
      : new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const supabase = deps.makeClient
      ? deps.makeClient()
      : createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
    const defaultCommission = deps.defaultCommission
      ?? parseFloat(Deno.env.get("DEFAULT_COMMISSION_RATE") || "0.20");


    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, order_id, payment_intent_ids, payment_method } = body;
    // "bank_transfer" = Flux B (SEPA Bank Transfer / customer_balance, sans transfer_data).
    // sinon = Flux A (card / bancontact / sepa_debit, avec transfer_data.destination).
    const isBankTransfer = payment_method === "bank_transfer";

    if (action === "get-payment-intents-status") {
      const ids: string[] = Array.isArray(payment_intent_ids) ? payment_intent_ids : [];
      const statuses: Record<string, string> = {};
      for (const pid of ids) {
        try {
          const pi = await stripe.paymentIntents.retrieve(pid);
          statuses[pid] = pi.status;
        } catch (_e) {
          statuses[pid] = "unknown";
        }
      }
      return new Response(JSON.stringify({ statuses }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "create-payment-intent") {

      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, total_incl_vat, customer_id")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Résout (ou crée) le Stripe Customer pour l'acheteur — requis pour SEPA
      // Bank Transfer (customer_balance).
      const { data: buyer } = await supabase
        .from("customers")
        .select("id, email, company_name, stripe_customer_id")
        .eq("id", order.customer_id)
        .maybeSingle();

      let stripeCustomerId: string | null = buyer?.stripe_customer_id ?? null;

      // SEPA Bank Transfer (customer_balance) exige un Stripe Customer avec email.
      // En B2B pharma tous les acheteurs ont un email (obligatoire à l'inscription),
      // mais on garde un garde-fou explicite ici pour ne pas créer un PI cassé.
      if (isBankTransfer && !buyer?.email) {
        console.error("[stripe-checkout] Bank transfer refused — buyer has no email", {
          order_id,
          customer_id: order.customer_id,
        });
        return new Response(
          JSON.stringify({
            error:
              "Virement bancaire indisponible pour votre compte, contactez support@medikong.pro",
            code: "bank_transfer_requires_email",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!stripeCustomerId && buyer?.email) {
        try {
          const created = await stripe.customers.create({
            email: buyer.email,
            name: buyer.company_name || undefined,
            metadata: { medikong_customer_id: buyer.id },
          });
          stripeCustomerId = created.id;
          await supabase
            .from("customers")
            .update({ stripe_customer_id: stripeCustomerId })
            .eq("id", buyer.id);
        } catch (e) {
          console.error("Stripe customer create failed:", e);
        }
      }

      // Get order lines — need per-line ids so we can persist PI ids per ligne
      const { data: lines } = await supabase
        .from("order_lines")
        .select("id, vendor_id, line_total_excl_vat, line_total_incl_vat, stripe_payment_intent_id")
        .eq("order_id", order_id);


      if (!lines || lines.length === 0) {
        return new Response(JSON.stringify({ error: "Commande sans articles" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group lines by vendor
      const linesByVendor = new Map<string, typeof lines>();
      for (const l of lines) {
        if (!l.vendor_id) continue;
        const arr = linesByVendor.get(l.vendor_id) || [];
        arr.push(l);
        linesByVendor.set(l.vendor_id, arr);
      }

      // Fetch Stripe Connect info for each vendor
      const vendorIds = Array.from(linesByVendor.keys());
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, name, company_name, stripe_account_id, commission_rate, stripe_charges_enabled")
        .in("id", vendorIds);
      const vendorMap = new Map<string, any>((vendors || []).map((v: any) => [v.id, v]));

      // Build one PaymentIntent per vendor (Stripe Connect, mode mandataire).
      // Les vendeurs sans Stripe Connect actif sont exclus du flux et bascul.
      // en paiement manuel (traité par l'équipe MediKong).
      const results: Array<{
        vendor_id: string;
        payment_intent_id: string;
        client_secret: string | null;
        amount: number;
        commission: number;
        bank_transfer_instructions?: any;
        vendor_names?: string[];
      }> = [];
      const manualPaymentVendors: Array<{
        vendor_id: string;
        vendor_name: string;
        reason: "no_stripe_account" | "charges_disabled";
        amount: number;
      }> = [];
      // Flux virement : vendeurs encaissés par MediKong mais à reverser à la main
      // (pas de compte Stripe actif). N'empêche PAS le paiement du client.
      const manualPayoutVendors: Array<{
        vendor_id: string;
        vendor_name: string;
        reason: "no_stripe_account" | "charges_disabled";
        amount: number;
      }> = [];

      // ============================================================
      // Flux B — SEPA Bank Transfer : UN SEUL PI pour le total panier.
      // Pas de transfer_data.destination : le paiement arrive sur la plateforme
      // MediKong, puis le webhook payment_intent.succeeded crée N Transfers
      // (un par vendeur) en reconstruisant les splits depuis order_lines.
      // ============================================================
      if (isBankTransfer) {
        if (!stripeCustomerId) {
          throw new Error("Stripe customer requis pour un virement bancaire");
        }

        let aggregateTtcCents = 0;
        let aggregateCommissionCents = 0;
        const eligibleVendorNames: string[] = [];

        for (const [vendorId, vLines] of linesByVendor.entries()) {
          const vendor = vendorMap.get(vendorId);
          const vendorName: string = vendor?.company_name || vendor?.name || `Fournisseur ${vendorId.slice(0, 8)}`;

          const totalTtcCents = vLines.reduce(
            (sum, l) => sum + Math.round(Number(l.line_total_incl_vat) * 100),
            0,
          );
          const totalHtCents = vLines.reduce(
            (sum, l) => sum + Math.round(Number(l.line_total_excl_vat) * 100),
            0,
          );
          if (totalTtcCents <= 0) continue;

          // Vendeur pas prêt Stripe : le virement arrive quand même sur le compte
          // MediKong (aucun transfer_data ici), le reversement sera fait à la main
          // par l'équipe. On le trace pour le back-office sans bloquer l'encaissement.
          if (!vendor?.stripe_account_id || !vendor?.stripe_charges_enabled) {
            manualPayoutVendors.push({
              vendor_id: vendorId,
              vendor_name: vendorName,
              reason: !vendor?.stripe_account_id ? "no_stripe_account" : "charges_disabled",
              amount: totalTtcCents,
            });
          }

          const commRate = Number(vendor?.commission_rate ?? defaultCommission);
          const commissionCents = Math.round(totalHtCents * commRate);
          if (totalTtcCents - commissionCents < 0) {
            throw new Error(`Commission > total pour vendor ${vendorId}`);
          }
          aggregateTtcCents += totalTtcCents;
          aggregateCommissionCents += commissionCents;
          eligibleVendorNames.push(vendorName);
        }

        if (aggregateTtcCents <= 0) {
          // Aucun vendeur éligible online → tout bascule manuel, on renvoie vide
          if (manualPaymentVendors.length > 0) {
            await supabase
              .from("orders")
              .update({ payment_status: "pending_payment_manual" })
              .eq("id", order.id);
          }
          return new Response(
            JSON.stringify({
              payment_intents: [],
              manual_payment_vendors: manualPaymentVendors,
              client_secret: null,
              payment_intent_id: null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Réutilise un PI existant si déjà présent (idempotence panier)
        // On considère qu'un PI virement est partagé entre toutes les lignes online.
        const existingPiId = (lines as any[])
          .find((l) => l.stripe_payment_intent_id)?.stripe_payment_intent_id ?? null;

        let paymentIntent: any;
        if (existingPiId) {
          paymentIntent = await stripe.paymentIntents.retrieve(existingPiId);
        } else {
          paymentIntent = await stripe.paymentIntents.create({
            amount: aggregateTtcCents,
            currency: "eur",
            customer: stripeCustomerId,
            payment_method_types: ["customer_balance"],
            payment_method_data: { type: "customer_balance" },
            payment_method_options: {
              customer_balance: {
                funding_type: "bank_transfer",
                bank_transfer: {
                  type: "eu_bank_transfer",
                  eu_bank_transfer: { country: "BE" },
                },
              },
            },
            confirm: true,
            metadata: {
              order_id: order.id,
              billing_model: "mandataire",
              payment_method: "bank_transfer",
              transfer_pending: "true",
              total_ttc_cents: String(aggregateTtcCents),
              total_commission_cents: String(aggregateCommissionCents),
              // splits reconstruits côté webhook depuis order_lines (évite la
              // limite 500 chars des metadata Stripe pour paniers multi-vendeurs)
            },
          });

          // Persist PI id sur toutes les lignes du virement (y compris les vendeurs
          // à reverser manuellement : l'encaissement les couvre aussi).
          const allLineIds = (lines as any[]).map((l) => l.id);
          if (allLineIds.length > 0) {
            await supabase
              .from("order_lines")
              .update({ stripe_payment_intent_id: paymentIntent.id })
              .in("id", allLineIds);
          }
        }

        results.push({
          vendor_id: "__mandataire__",
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret ?? null,
          amount: aggregateTtcCents,
          commission: aggregateCommissionCents,
          bank_transfer_instructions:
            paymentIntent.next_action?.display_bank_transfer_instructions ?? null,
          vendor_names: eligibleVendorNames,
        });
      } else {
        // ============================================================
        // Flux A — Carte / Bancontact / SEPA Debit : 1 PI par vendeur
        // avec transfer_data.destination (destination charge classique).
        // ============================================================
        for (const [vendorId, vLines] of linesByVendor.entries()) {
          const vendor = vendorMap.get(vendorId);
          const vendorName: string = vendor?.company_name || vendor?.name || `Fournisseur ${vendorId.slice(0, 8)}`;

          const totalTtcCents = vLines.reduce(
            (sum, l) => sum + Math.round(Number(l.line_total_incl_vat) * 100),
            0,
          );
          const totalHtCents = vLines.reduce(
            (sum, l) => sum + Math.round(Number(l.line_total_excl_vat) * 100),
            0,
          );
          if (totalTtcCents <= 0) continue;

          if (!vendor?.stripe_account_id || !vendor?.stripe_charges_enabled) {
            manualPaymentVendors.push({
              vendor_id: vendorId,
              vendor_name: vendorName,
              reason: !vendor?.stripe_account_id ? "no_stripe_account" : "charges_disabled",
              amount: totalTtcCents,
            });
            continue;
          }

          const commRate = Number(vendor?.commission_rate ?? defaultCommission);
          const commissionCents = Math.round(totalHtCents * commRate);
          const transferCents = totalTtcCents - commissionCents;
          if (transferCents < 0) {
            throw new Error(`Commission > total pour vendor ${vendorId}`);
          }

          const existingPiId = vLines.find((l: any) => l.stripe_payment_intent_id)?.stripe_payment_intent_id ?? null;
          let paymentIntent: any;
          if (existingPiId) {
            paymentIntent = await stripe.paymentIntents.retrieve(existingPiId);
          } else {
            paymentIntent = await stripe.paymentIntents.create({
              amount: totalTtcCents,
              currency: "eur",
              payment_method_types: ["card", "bancontact", "sepa_debit"],
              application_fee_amount: commissionCents,
              transfer_data: { destination: vendor.stripe_account_id },
              metadata: {
                order_id: order.id,
                vendor_id: vendorId,
                billing_model: "mandataire",
                total_ht_cents: String(totalHtCents),
                total_ttc_cents: String(totalTtcCents),
                commission_rate: String(commRate),
              },
            });
            const lineIds = vLines.map((l: any) => l.id);
            await supabase
              .from("order_lines")
              .update({ stripe_payment_intent_id: paymentIntent.id })
              .in("id", lineIds);
          }

          results.push({
            vendor_id: vendorId,
            payment_intent_id: paymentIntent.id,
            client_secret: paymentIntent.client_secret ?? null,
            amount: totalTtcCents,
            commission: commissionCents,
          });
        }
      }

      // Si au moins un vendeur bascule en paiement manuel, on marque la commande
      // (partiellement ou totalement) en pending_payment_manual pour que l'équipe
      // reprenne la main.
      if (manualPaymentVendors.length > 0) {
        await supabase
          .from("orders")
          .update({ payment_status: "pending_payment_manual" })
          .eq("id", order.id);
      }

      // Compat rétro : renvoie aussi le premier client_secret si mono-vendeur
      return new Response(
        JSON.stringify({
          payment_intents: results,
          manual_payment_vendors: manualPaymentVendors,
          client_secret: results[0]?.client_secret ?? null,
          payment_intent_id: results[0]?.payment_intent_id ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }



    if (action === "create-checkout-session") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, order_number, total_incl_vat, customer_id, stripe_session_id, stripe_payment_intent_id")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // IDOR check : caller must own this order via customers.auth_user_id
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .select("id, auth_user_id, customer_type, country_code")
        .eq("id", order.customer_id)
        .maybeSingle();

      if (custErr || !customer || customer.auth_user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Accès refusé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If a session already exists, return it (avoid duplicates)
      if (order.stripe_session_id) {
        try {
          const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          if (existing && existing.url && existing.status === "open") {
            return new Response(
              JSON.stringify({ url: existing.url, session_id: existing.id }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.warn("Existing session retrieval failed, creating a new one:", e);
        }
      }

      // Load order lines with product info + offer_id (needed for cart validation)
      const { data: lines } = await supabase
        .from("order_lines")
        .select("offer_id, vendor_id, product_id, quantity, unit_price_incl_vat, line_total_incl_vat, product:products(name)")
        .eq("order_id", order_id);

      if (!lines || lines.length === 0) {
        return new Response(JSON.stringify({ error: "Commande sans articles" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // SECURITY: Server-side cart validation (MOQ, stock, vendor MOV, recalculated tier prices)
      const { validateCart } = await import("../_shared/validate-cart.ts");
      const cartItems = lines
        .filter((l: any) => l.offer_id)
        .map((l: any) => ({ offer_id: l.offer_id as string, quantity: Number(l.quantity) }));
      const validation = await validateCart(supabase, cartItems, customer.id, {
        customer_type: customer.customer_type,
        country_code: customer.country_code,
      });
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "cart_validation_failed", validation }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Use RECALCULATED prices from validation (protect against client tampering)
      const validatedByOffer = new Map(validation.items.map((v) => [v.offer_id, v]));
      const productNameByOffer = new Map<string, string>();
      for (const l of lines) {
        productNameByOffer.set(l.offer_id, (l as any).product?.name || `Produit ${l.product_id}`);
      }

      // Vendor breakdown from validated prices
      const vendorTotals: Record<string, number> = {};
      for (const v of validation.items) {
        vendorTotals[v.vendor_id] = (vendorTotals[v.vendor_id] || 0) + v.total_incl_vat;
      }
      const vendorIds = Object.keys(vendorTotals);
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, stripe_account_id, commission_rate, stripe_charges_enabled")
        .in("id", vendorIds);
      const vendorMap = new Map<string, any>(vendors?.map((v: any) => [v.id, v]) || []);
      const vendorBreakdown = vendorIds.map((vid) => {
        const vendor = vendorMap.get(vid);
        const subtotalCents = Math.round(vendorTotals[vid] * 100);
        const commRate = vendor?.commission_rate ?? defaultCommission;
        const commissionCents = Math.round(subtotalCents * Number(commRate) / 100);
        const transferCents = subtotalCents - commissionCents;
        if (transferCents < 0) throw new Error(`Negative transfer_amount: ${transferCents}`);
        return {
          vendor_id: vid,
          stripe_account_id: vendor?.stripe_account_id || null,
          subtotal: subtotalCents,
          commission_rate: Number(commRate),
          commission_amount: commissionCents,
          transfer_amount: transferCents,
        };
      });

      // Build Stripe line_items from VALIDATED prices
      const lineItems = validation.items.map((v) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: productNameByOffer.get(v.offer_id) || `Produit ${v.product_id}`,
            metadata: { product_id: String(v.product_id) },
          },
          unit_amount: Math.round(v.unit_price_incl_vat * 100),
        },
        quantity: v.quantity,
      }));

      const ALLOWED_ORIGINS = new Set([
        "https://medikong.pro",
        "https://www.medikong.pro",
        "https://medikong-deal-finder.lovable.app",
        "https://dev.medikong.pro",
      ]);
      const rawOrigin =
        req.headers.get("origin") ||
        req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
        "";
      const origin = ALLOWED_ORIGINS.has(rawOrigin) ? rawOrigin : "https://medikong.pro";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: lineItems,
        success_url: `${origin}/confirmation?order=${order.order_number}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout`,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          platform: "medikong",
          vendor_breakdown: JSON.stringify(vendorBreakdown),
        },
        payment_intent_data: {
          transfer_group: `order_${order.id}`,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            platform: "medikong",
            vendor_breakdown: JSON.stringify(vendorBreakdown),
          },
        },
      });

      // Persist session id (and PI id if already linked) + flag test si Stripe en mode test
      const update: Record<string, unknown> = {
        stripe_session_id: session.id,
        is_test: session.livemode === false,
      };
      if (typeof session.payment_intent === "string") {
        update.stripe_payment_intent_id = session.payment_intent;
      }
      await supabase.from("orders").update(update).eq("id", order_id);

      return new Response(
        JSON.stringify({ url: session.url, session_id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "admin-create-payment-link") {
      // Admin generates a shareable Stripe Payment Link for a manual, unpaid order.
      if (!order_id) {
        return new Response(JSON.stringify({ error: "order_id requis" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Admin gating
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", caller.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!adminUser) {
        return new Response(JSON.stringify({ error: "Accès refusé" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, order_number, source, status, payment_status, total_incl_vat, customer_id")
        .eq("id", order_id)
        .single();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Commande introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (order.source !== "manual_admin") {
        return new Response(
          JSON.stringify({ error: "Lien de paiement réservé aux commandes manuelles" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (order.status === "draft" || order.status === "cancelled") {
        return new Response(
          JSON.stringify({ error: "Commande non confirmée ou annulée" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (order.payment_status === "paid") {
        return new Response(
          JSON.stringify({ error: "Commande déjà payée" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: lines } = await supabase
        .from("order_lines")
        .select("product_id, quantity, unit_price_incl_vat, product:products(name)")
        .eq("order_id", order_id);

      if (!lines || lines.length === 0) {
        return new Response(JSON.stringify({ error: "Commande sans articles" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const lineItems = lines.map((l: any) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: l.product?.name || `Produit ${l.product_id}`,
          },
          unit_amount: Math.round(Number(l.unit_price_incl_vat) * 100),
        },
        quantity: Number(l.quantity),
      }));

      const ALLOWED_ORIGINS = new Set([
        "https://medikong.pro",
        "https://www.medikong.pro",
        "https://medikong-deal-finder.lovable.app",
        "https://dev.medikong.pro",
      ]);
      const rawOrigin =
        req.headers.get("origin") ||
        req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
        "";
      const origin = ALLOWED_ORIGINS.has(rawOrigin) ? rawOrigin : "https://medikong.pro";

      const paymentLink = await stripe.paymentLinks.create({
        line_items: lineItems,
        after_completion: {
          type: "redirect",
          redirect: {
            url: `${origin}/confirmation?order=${order.order_number}`,
          },
        },
        metadata: {
          order_id: order.id,
          order_number: order.order_number ?? "",
          platform: "medikong",
          origin: "admin_manual_order",
        },
        payment_intent_data: {
          metadata: {
            order_id: order.id,
            order_number: order.order_number ?? "",
            platform: "medikong",
            origin: "admin_manual_order",
          },
        },
      });

      return new Response(
        JSON.stringify({ url: paymentLink.url, payment_link_id: paymentLink.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve((req) => handler(req));

