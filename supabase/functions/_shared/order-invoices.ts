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

import {
  acquireLock,
  releaseLock,
  orderInvoicesLockKey,
  IDEMPOTENCY_TTL,
} from "./idempotency.ts";

export type InvoiceLink = { label: string; url: string };

export type PeppolDispatchEntry = {
  invoice_id: string;
  invoice_number: string | null;
  type: string;
  status: string | null;
  ok: boolean;
  error?: string;
};

export type EmitOrderInvoicesResult = {
  links: InvoiceLink[];
  emitted_vendors: string[];
  skipped_no_mandate: string[];
  skipped_disabled: string[];
  peppol_dispatch: PeppolDispatchEntry[];
  /** true quand une émission est déjà en cours pour cette commande (rien n'a été refait). */
  skipped_in_progress?: boolean;
};

// Statuts considérés comme déjà transmis : on ne renvoie pas.
const PEPPOL_TERMINAL_OK = new Set(["accepted", "delivered", "sent"]);

/**
 * Envoi Peppol automatique des factures de la commande.
 * Idempotent : les factures déjà transmises sont ignorées.
 * En cas d'échec, la facture est marquée peppol_status = 'failed' afin que
 * le job horaire retry-peppol-failed la reprenne automatiquement.
 */
async function dispatchPeppolForOrder(
  supabase: any,
  orderId: string,
): Promise<PeppolDispatchEntry[]> {
  const out: PeppolDispatchEntry[] = [];
  try {
    const { data: invoices, error } = await supabase
      .from("order_invoices")
      .select("id, invoice_number, type, peppol_status, pdf_path")
      .eq("order_id", orderId);
    if (error) {
      console.error("[order-invoices] peppol invoices fetch failed", error);
      return out;
    }
    for (const inv of invoices || []) {
      const status = String(inv.peppol_status || "").toLowerCase();
      if (PEPPOL_TERMINAL_OK.has(status)) {
        out.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number ?? null,
          type: inv.type,
          status: inv.peppol_status ?? null,
          ok: true,
        });
        continue;
      }
      try {
        const { data: sent, error: sendErr } = await supabase.functions.invoke("send-invoice-peppol", {
          body: { invoice_id: inv.id },
        });
        if (sendErr) throw sendErr;
        out.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number ?? null,
          type: inv.type,
          status: sent?.peppol_status ?? null,
          ok: sent?.ok !== false,
          error: sent?.error ?? sent?.peppol_error ?? undefined,
        });
      } catch (e) {
        const message = String((e as any)?.message || e);
        const httpStatus = Number((e as any)?.context?.status ?? 0);
        // 409 = envoi déjà en cours / déjà transmis : ce n'est pas un échec, on
        // ne réécrit surtout pas le statut en 'failed'.
        if (httpStatus === 409) {
          out.push({
            invoice_id: inv.id,
            invoice_number: inv.invoice_number ?? null,
            type: inv.type,
            status: inv.peppol_status ?? null,
            ok: true,
          });
          continue;
        }
        console.error(`[order-invoices] peppol send failed invoice=${inv.id}`, message);
        // Marque l'échec pour que le retry horaire reprenne la facture.
        try {
          await supabase
            .from("order_invoices")
            .update({
              peppol_status: "failed",
              peppol_error: `auto_dispatch_failed: ${message}`.slice(0, 500),
              peppol_last_attempt_at: new Date().toISOString(),
            })
            .eq("id", inv.id);
        } catch (updErr) {
          console.error("[order-invoices] peppol status update failed", updErr);
        }
        out.push({
          invoice_id: inv.id,
          invoice_number: inv.invoice_number ?? null,
          type: inv.type,
          status: "failed",
          ok: false,
          error: message,
        });
      }
    }
  } catch (e) {
    console.error("[order-invoices] peppol dispatch fatal", e);
  }
  return out;
}

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
  const result: EmitOrderInvoicesResult = {
    links: [],
    emitted_vendors: [],
    skipped_no_mandate: [],
    skipped_disabled: [],
    peppol_dispatch: [],
  };

  // Idempotence : un seul cycle d'émission par commande à la fois. Protège des
  // marquages « payée » répétés (webhook Stripe rejoué, sweep virements, admin).
  const orderLockKey = orderInvoicesLockKey(orderId);
  const gotOrderLock = await acquireLock(
    supabase,
    orderLockKey,
    IDEMPOTENCY_TTL.orderInvoices,
    "emit-order-invoices",
  );
  if (!gotOrderLock) {
    console.log(`[order-invoices] skipped, already in progress order=${orderId}`);
    result.skipped_in_progress = true;
    return result;
  }

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
      supabase
        .from("vendors")
        .select("id, name, company_name, mandate_signed_at, self_billing_enabled")
        .in("id", vendorIds),
    ]);
    const vendorMap = new Map<string, any>((vendors || []).map((v: any) => [v.id, v]));
    const orderNumber = order?.order_number ?? null;

    for (const vendorId of vendorIds) {
      const vendor = vendorMap.get(vendorId);
      const vendorLabel = vendor?.company_name || vendor?.name || vendorId;
      if (vendor && vendor.self_billing_enabled === false) {
        result.skipped_disabled.push(vendorId);
        try {
          await supabase.from("audit_logs").insert({
            action: "self_billing_skipped_disabled",
            module: "invoicing",
            detail:
              `Commande ${orderNumber ?? orderId} : facturation au nom et pour le compte de ` +
              `${vendorLabel} désactivée pour ce fournisseur, aucune facture émise.`,
          });
        } catch (e) {
          console.error("[order-invoices] audit_logs insert failed", e);
        }
        continue;
      }
      if (!vendor?.mandate_signed_at) {
        result.skipped_no_mandate.push(vendorId);
        await flagMissingMandate(supabase, orderId, vendorId, vendorLabel, orderNumber);
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

    // Envoi Peppol automatique des factures générées (statut + retry horaire).
    result.peppol_dispatch = await dispatchPeppolForOrder(supabase, orderId);
  } catch (e) {
    console.error("[order-invoices] fatal", e);
  }
  return result;
}
