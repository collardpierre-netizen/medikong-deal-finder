// @ts-nocheck — Deno runtime
// Émission centralisée des factures d'une commande payée :
//   - facture « au nom et pour le compte de » le fournisseur (destinée à l'acheteur)
//   - facture de commission MediKong → fournisseur (interne)
//
// Point d'entrée unique partagé par stripe-webhook (carte / virement Stripe) et
// par la fonction emit-order-invoices (virement encaissé hors Stripe).
//
// Garde-fou légal : aucune facture n'est émise au nom d'un fournisseur qui n'a
// pas signé le mandat de facturation (vendors.mandate_signed_at). Le cas est
// signalé à l'admin et tracé, jamais silencieux.

export type InvoiceLink = { label: string; url: string };

export type EmitOrderInvoicesResult = {
  links: InvoiceLink[];
  emitted_vendors: string[];
  skipped_no_mandate: string[];
};

async function flagMissingMandate(
  supabase: any,
  orderId: string,
  vendorId: string,
  vendorLabel: string,
  orderNumber: string | null,
) {
  const title = "Mandat de facturation manquant";
  const body =
    `La commande ${orderNumber ?? orderId} est payée, mais aucune facture ne peut être émise en votre nom : ` +
    `le mandat de facturation n'est pas signé. Merci de le signer pour régulariser.`;
  try {
    await supabase.from("vendor_notifications").insert({
      vendor_id: vendorId,
      type: "self_billing_mandate_missing",
      title,
      body,
      cta_url: "/vendor/contract",
      payload: { order_id: orderId, order_number: orderNumber },
    });
  } catch (e) {
    console.error("[order-invoices] vendor_notifications insert failed", e);
  }
  try {
    await supabase.from("audit_logs").insert({
      action: "self_billing_skipped_no_mandate",
      module: "invoicing",
      detail:
        `Commande ${orderNumber ?? orderId} : facture au nom et pour le compte de ` +
        `${vendorLabel} non émise (mandat de facturation non signé).`,
    });
  } catch (e) {
    console.error("[order-invoices] audit_logs insert failed", e);
  }
}

/**
 * Émet les factures de la commande pour chaque fournisseur concerné.
 * Idempotent : emit-self-billing-invoice et emit-commission-invoice ne
 * réémettent pas une facture déjà générée.
 */
export async function emitOrderInvoices(
  supabase: any,
  orderId: string,
  paidAtIso: string,
): Promise<EmitOrderInvoicesResult> {
  const result: EmitOrderInvoicesResult = { links: [], emitted_vendors: [], skipped_no_mandate: [] };
  try {
    const { data: vendorRows, error } = await supabase
      .from("order_lines")
      .select("vendor_id")
      .eq("order_id", orderId);
    if (error || !vendorRows) {
      console.error("[order-invoices] vendors fetch failed", error);
      return result;
    }
    const vendorIds = Array.from(new Set(vendorRows.map((r: any) => r.vendor_id).filter(Boolean)));
    if (vendorIds.length === 0) return result;

    const [{ data: order }, { data: vendors }] = await Promise.all([
      supabase.from("orders").select("order_number").eq("id", orderId).maybeSingle(),
      supabase.from("vendors").select("id, name, company_name, mandate_signed_at").in("id", vendorIds),
    ]);
    const vendorMap = new Map<string, any>((vendors || []).map((v: any) => [v.id, v]));
    const orderNumber = order?.order_number ?? null;

    for (const vendorId of vendorIds) {
      const vendor = vendorMap.get(vendorId);
      if (!vendor?.mandate_signed_at) {
        result.skipped_no_mandate.push(vendorId);
        await flagMissingMandate(
          supabase,
          orderId,
          vendorId,
          vendor?.company_name || vendor?.name || vendorId,
          orderNumber,
        );
        continue;
      }

      // Facture au nom et pour le compte du fournisseur (acheteur)
      try {
        const { data: sb, error: sbErr } = await supabase.functions.invoke("emit-self-billing-invoice", {
          body: { order_id: orderId, vendor_id: vendorId, paid_at: paidAtIso },
        });
        if (sbErr) {
          console.error(`[order-invoices] self-billing failed vendor=${vendorId}`, sbErr);
        } else if (sb?.invoice_id) {
          result.emitted_vendors.push(vendorId);
          const { data: signed } = await supabase.storage
            .from("invoices")
            .createSignedUrl(`${orderId}/self_billing-${vendorId}.pdf`, 60 * 60 * 24 * 7, {
              download: `${sb.invoice_number}.pdf`,
            });
          if (signed?.signedUrl) {
            result.links.push({ label: `Facture ${sb.invoice_number}`, url: signed.signedUrl });
          }
        }
      } catch (e) {
        console.error(`[order-invoices] self-billing exception vendor=${vendorId}`, e);
      }

      // Commission MediKong → fournisseur (jamais envoyée à l'acheteur)
      try {
        const { error: comErr } = await supabase.functions.invoke("emit-commission-invoice", {
          body: { order_id: orderId, vendor_id: vendorId, paid_at: paidAtIso },
        });
        if (comErr) console.error(`[order-invoices] commission failed vendor=${vendorId}`, comErr);
      } catch (e) {
        console.error(`[order-invoices] commission exception vendor=${vendorId}`, e);
      }
    }
  } catch (e) {
    console.error("[order-invoices] fatal", e);
  }
  return result;
}
