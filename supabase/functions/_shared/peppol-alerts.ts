// @ts-nocheck — Deno runtime
// Alertes admin : une facture Peppol reste en erreur après N tentatives.
//
// Idempotence : une notification n'est créée qu'une seule fois par palier de
// tentatives (payload.attempts). Si la facture retombe en erreur avec une
// tentative supplémentaire, une nouvelle notification est créée.

export const PEPPOL_ALERT_DEFAULT_THRESHOLD = 3;

export function peppolAlertThreshold(): number {
  const raw = Deno.env.get("PEPPOL_ALERT_MIN_ATTEMPTS");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : PEPPOL_ALERT_DEFAULT_THRESHOLD;
}

const FAILED_STATUSES = ["failed", "rejected"];

export interface PeppolAlertResult {
  threshold: number;
  scanned: number;
  created: number;
  skipped_already_notified: number;
  errors: string[];
}

/**
 * Scanne les factures Peppol en échec après >= threshold tentatives et crée
 * une notification admin avec lien direct vers le détail de la commande.
 */
export async function notifyExhaustedPeppolInvoices(
  supabase: any,
  opts: { threshold?: number; limit?: number; caller: string } = { caller: "unknown" },
): Promise<PeppolAlertResult> {
  const threshold = opts.threshold ?? peppolAlertThreshold();
  const limit = opts.limit ?? 100;
  const out: PeppolAlertResult = {
    threshold,
    scanned: 0,
    created: 0,
    skipped_already_notified: 0,
    errors: [],
  };

  const { data: invoices, error } = await supabase
    .from("order_invoices")
    .select("id, order_id, invoice_number, type, peppol_status, peppol_error, peppol_retry_count, peppol_last_attempt_at")
    .in("peppol_status", FAILED_STATUSES)
    .gte("peppol_retry_count", threshold)
    .order("peppol_last_attempt_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    out.errors.push(`query_failed: ${error.message}`);
    return out;
  }

  for (const inv of invoices || []) {
    out.scanned++;
    const attempts = inv.peppol_retry_count || 0;

    // Déjà alertée pour ce palier de tentatives ?
    const { data: existing, error: exErr } = await supabase
      .from("admin_notifications")
      .select("id, payload")
      .eq("type", "peppol_invoice_failed")
      .eq("source_type", "order_invoice")
      .eq("source_id", inv.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (exErr) {
      out.errors.push(`${inv.id}: ${exErr.message}`);
      continue;
    }
    const alreadyNotified = (existing || []).some(
      (n: any) => Number(n?.payload?.attempts ?? 0) >= attempts,
    );
    if (alreadyNotified) {
      out.skipped_already_notified++;
      continue;
    }

    let orderNumber: string | null = null;
    if (inv.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", inv.order_id)
        .maybeSingle();
      orderNumber = order?.order_number ?? null;
    }

    const statusLabel = String(inv.peppol_status).toLowerCase() === "rejected" ? "rejetée" : "en échec";
    const { error: insErr } = await supabase.from("admin_notifications").insert({
      type: "peppol_invoice_failed",
      severity: "error",
      title: `Facture Peppol ${statusLabel} après ${attempts} tentative${attempts > 1 ? "s" : ""}`,
      body: [
        `Facture ${inv.invoice_number || inv.id}${orderNumber ? ` — commande ${orderNumber}` : ""}`,
        inv.peppol_error ? `Erreur : ${inv.peppol_error}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      cta_url: inv.order_id ? `/admin/commandes/${inv.order_id}` : "/admin/peppol-virements",
      source_type: "order_invoice",
      source_id: inv.id,
      payload: {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_type: inv.type,
        order_id: inv.order_id,
        order_number: orderNumber,
        peppol_status: inv.peppol_status,
        peppol_error: inv.peppol_error,
        attempts,
        threshold,
        last_attempt_at: inv.peppol_last_attempt_at,
        detected_by: opts.caller,
      },
    });
    if (insErr) {
      out.errors.push(`${inv.id}: ${insErr.message}`);
      continue;
    }
    out.created++;

    await supabase
      .from("audit_logs")
      .insert({
        action: "peppol_invoice_alert_created",
        module: "peppol",
        detail: `facture ${inv.invoice_number || inv.id} ${statusLabel} après ${attempts} tentatives`,
        target_type: "order",
        target_id: inv.order_id,
        entity_type: "order_invoice",
        entity_id: inv.id,
        metadata: { attempts, threshold, peppol_status: inv.peppol_status, peppol_error: inv.peppol_error },
      })
      .then(() => {}, () => {});
  }

  return out;
}
