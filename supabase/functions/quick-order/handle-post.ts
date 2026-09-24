// MEDIKONG — Quick Order · supabase/functions/quick-order/handle-post.ts
// POST : désinscription, et soumission de commande avec recalcul intégral
// des prix côté serveur. Le navigateur n'est jamais la source d'un montant.

import {
  db, json, hashIp, effectiveUnitPrice, freeUnits, estimatedDelivery,
  reference, NOTIFY_EMAIL, BREVO_API_KEY, type OfferItem,
} from "./_shared.ts";

const eur = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

type IncomingLine = {
  item_id: string;
  qty: number;
  /** Prix d'achat actuel déclaré par le pharmacien, en centimes. Optionnel. */
  buyer_price_cents?: number;
};

export async function handlePost(req: Request, ip: string): Promise<Response> {
  let body: {
    token?: string;
    action?: "order" | "unsubscribe";
    lines?: IncomingLine[];
    contact_name?: string;
    contact_phone?: string;
    comment?: string;
    requested_delivery_date?: string;
    consent?: boolean;
    consent_text_version?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const token = (body.token ?? "").trim();
  if (!token) return json({ error: "invalid_link" }, 404);

  const { data: recipient } = await db
    .from("qo_recipients")
    .select("*, qo_campaigns(*)")
    .eq("token", token)
    .maybeSingle();

  if (!recipient) return json({ error: "invalid_link" }, 404);

  // --- Désinscription 1 clic (obligation légale belge, < 48 h) --------------
  if (body.action === "unsubscribe") {
    await db.from("qo_recipients")
      .update({ unsubscribed_at: new Date().toISOString(), consent_status: "none" })
      .eq("id", recipient.id);
    return json({ ok: true, unsubscribed: true });
  }

  const campaign = recipient.qo_campaigns;
  if (recipient.unsubscribed_at) return json({ error: "unsubscribed" }, 410);
  if (new Date(recipient.expires_at) < new Date() || campaign.status !== "active") {
    return json({ error: "expired" }, 410);
  }

  // Anti double-clic / anti-flood : une commande par destinataire par minute.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await db
    .from("qo_orders")
    .select("reference")
    .eq("recipient_id", recipient.id)
    .gte("created_at", oneMinuteAgo)
    .limit(1)
    .maybeSingle();
  if (recent) {
    return json({ ok: true, reference: recent.reference, duplicate: true });
  }

  const incoming = (body.lines ?? []).filter(
    (l) => l && typeof l.item_id === "string" && Number.isInteger(l.qty) && l.qty > 0,
  );
  if (incoming.length === 0) return json({ error: "empty_cart" }, 400);
  if (incoming.length > 100) return json({ error: "too_many_lines" }, 400);

  const { data: items } = await db
    .from("qo_offer_items")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("active", true)
    .in("id", incoming.map((l) => l.item_id));

  const byId = new Map<string, OfferItem>((items ?? []).map((i: OfferItem) => [i.id, i]));

  // --- Recalcul intégral côté serveur ------------------------------------
  const lines: Array<Record<string, unknown>> = [];
  let subtotal = 0;
  let vatTotal = 0;
  const rejected: string[] = [];

  // Prix déclaré : borné, jamais utilisé dans un calcul de facturation.
  const buyerPrice = (v: unknown): number | null =>
    (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1_000_00)
      ? Math.round(v) : null;

  for (const l of incoming) {
    const item = byId.get(l.item_id);
    if (!item) { rejected.push(l.item_id); continue; }

    let qty = l.qty;
    if (qty < item.min_qty) qty = item.min_qty;
    if (item.max_qty && qty > item.max_qty) qty = item.max_qty;
    if (item.step_qty > 1) qty = Math.max(item.min_qty, Math.round(qty / item.step_qty) * item.step_qty);
    if (qty <= 0) { rejected.push(l.item_id); continue; }

    // Référence non stockée : on enregistre une DEMANDE, on n'engage aucun prix
    // et on ne facture rien. C'est la donnée qui dira quoi acheter.
    if (item.availability !== "in_stock") {
      lines.push({
        offer_item_id: item.id,
        line_type: "request",
        cnk: item.cnk,
        name: item.name,
        qty,
        free_units: 0,
        unit_price_cents: item.unit_price_cents,
        vat_rate: item.vat_rate,
        line_ht_cents: 0,
        buyer_price_cents: buyerPrice(l.buyer_price_cents),
      });
      continue;
    }

    if (item.stock_qty !== null && qty > item.stock_qty) qty = item.stock_qty;
    if (qty <= 0) { rejected.push(l.item_id); continue; }

    const unit = effectiveUnitPrice(item, qty);
    const free = freeUnits(item, qty);
    const lineHt = unit * qty;
    const lineVat = Math.round(lineHt * Number(item.vat_rate) / 100);

    subtotal += lineHt;
    vatTotal += lineVat;

    lines.push({
      offer_item_id: item.id,
      line_type: "order",
      cnk: item.cnk,
      name: item.name,
      qty,
      free_units: free,
      unit_price_cents: unit,
      vat_rate: item.vat_rate,
      line_ht_cents: lineHt,
      buyer_price_cents: buyerPrice(l.buyer_price_cents),
    });
  }

  if (lines.length === 0) return json({ error: "empty_cart" }, 400);

  const ref = reference(campaign.code);
  const francoReached = campaign.franco_threshold_cents
    ? subtotal >= campaign.franco_threshold_cents
    : true;

  // Frais de livraison si le franco n'est pas atteint. Recalculés ici, comme
  // tout le reste : le navigateur n'est jamais la source du montant facturé.
  const shipping = francoReached ? 0 : (campaign.shipping_fee_cents ?? 0);
  if (shipping > 0) {
    vatTotal += Math.round(shipping * Number(campaign.shipping_vat_rate ?? 21) / 100);
  }

  const { data: order, error: orderErr } = await db
    .from("qo_orders")
    .insert({
      reference: ref,
      recipient_id: recipient.id,
      campaign_id: campaign.id,
      subtotal_ht_cents: subtotal,
      shipping_ht_cents: shipping,
      vat_cents: vatTotal,
      total_ttc_cents: subtotal + shipping + vatTotal,
      franco_reached: francoReached,
      contact_name: (body.contact_name ?? "").slice(0, 120) || recipient.contact_name,
      contact_phone: (body.contact_phone ?? "").slice(0, 40) || recipient.phone,
      comment: (body.comment ?? "").slice(0, 2000),
      requested_delivery_date: body.requested_delivery_date || null,
      ip_hash: await hashIp(ip),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    })
    .select("id, reference")
    .single();

  if (orderErr || !order) return json({ error: "server_error" }, 500);

  await db.from("qo_order_lines").insert(
    lines.map((l) => ({ ...l, order_id: order.id })),
  );

  // Commande + case cochée = consentement explicite, horodaté et prouvable.
  const recipientUpdate: Record<string, unknown> = {
    ordered_at: new Date().toISOString(),
  };
  if (body.consent === true && recipient.consent_status !== "explicit") {
    recipientUpdate.consent_status = "explicit";
    recipientUpdate.consent_source = "page_commande";
    recipientUpdate.consent_at = new Date().toISOString();
    recipientUpdate.consent_ip_hash = await hashIp(ip);
    recipientUpdate.consent_text_version = (body.consent_text_version ?? "v1").slice(0, 32);
  }
  await db.from("qo_recipients").update(recipientUpdate).eq("id", recipient.id);

  await db.from("qo_events").insert({
    recipient_id: recipient.id,
    type: "submit",
    meta: { reference: ref, subtotal_ht_cents: subtotal },
  });

  // Emails. Best effort : une erreur d'envoi n'annule jamais la commande.
  // Le CNK est en tête de ligne : c'est l'identifiant de ré-encodage.
  const lineText = lines.map((l) =>
    (l.line_type === "request" ? "[EN PROSPECTION] " : "") +
    `${l.cnk ?? "CNK ?"} · ${l.qty} x ${l.name}` +
    (Number(l.free_units) > 0 ? ` (+${l.free_units} offertes)` : "") +
    ` — ${eur(Number(l.unit_price_cents))} €/u`
  ).join("\n");

  const eta = estimatedDelivery(campaign.cutoff_hour ?? 14, campaign.lead_time_days ?? 2);

  if (BREVO_API_KEY && recipient.contact_email) {
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: "MediKong", email: "pcoll@medikong.pro" },
          replyTo: { email: NOTIFY_EMAIL || "commandes@medikong.pro" },
          to: [{ email: recipient.contact_email, name: recipient.pharmacy_name }],
          subject: `Bien reçu — votre commande ${ref}`,
          textContent:
            `Bonjour,\n\n` +
            `Vous venez de passer commande sur commande.medikong.pro.\n` +
            `Voici le récapitulatif et les coordonnées de paiement.\n\n` +
            `Nous avons bien reçu votre commande ${ref}.\n\n` +
            lineText + `\n\n` +
            `Total marchandises HTVA : ${eur(subtotal)} €\n` +
            (shipping > 0
              ? `Frais de livraison : ${eur(shipping)} € ` +
                `(offerts dès ${eur(campaign.franco_threshold_cents ?? 0)} €)\n`
              : `Livraison offerte\n`) +
            `\n` +
            `------------------------------\n` +
            `Paiement par virement\n` +
            `Montant à virer : ${eur(subtotal + shipping + vatTotal)} € TTC\n` +
            `Bénéficiaire : MediKong SRL\n` +
            `IBAN : BE86 7320 7305 0650\n` +
            `BIC : CREGBEBB\n` +
            `Communication : ${ref}\n` +
            `------------------------------\n` +
            `\n` +
            (campaign.vendor_label ? `${campaign.vendor_label}\n` : "") +
            `Livraison estimée : ${eta.label} — après réception de votre virement` +
            (campaign.carrier_label ? ` — ${campaign.carrier_label}` : "") + `\n` +
            (lines.some((l) => l.line_type === "request")
              ? `Les références en prospection ne sont pas couvertes par cette date : ` +
                `nous revenons vers vous avec le prix ferme et le délai.\n`
              : "") +
            `\nNous confirmons la commande sous 24 h ouvrables.\n` +
            `Une question d'ici là : ${campaign.contact_label ?? ""}\n\n` +
            `MediKong SRL · BE 1005.771.323 · Rue de la Procession 23, 7822 Meslin-l'Évêque (Ath)\n`,
        }),
      });
      await db.from("qo_orders")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", order.id);
    } catch (e) { console.error("[quick-order] Brevo accusé pharmacien échoué:", (e as Error)?.message ?? String(e), (e as { body?: unknown })?.body ?? null); }
  }

  if (BREVO_API_KEY && NOTIFY_EMAIL) {
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: "MediKong", email: "pcoll@medikong.pro" },
          to: [{ email: NOTIFY_EMAIL }],
          subject: `Nouvelle commande ${ref} — ${recipient.pharmacy_name}`,
          textContent:
            `${recipient.pharmacy_name} (${recipient.city ?? "-"})\n` +
            `${recipient.contact_email} · ${recipient.phone ?? "-"}\n` +
            `Flux : ${recipient.flow} · Client existant : ${recipient.tenant_id ? "OUI" : "non"}\n` +
            `Campagne : ${campaign.code}\n` +
            `Total HTVA : ${eur(subtotal)} €\n` +
            `Franco atteint : ${francoReached ? "oui" : "non"}\n\n` +
            lineText +
            `\n\nCommentaire : ${body.comment ?? "-"}\n` +
            `\n→ À VALIDER : stock, délai, conditions de paiement. ` +
            `Puis envoyer la confirmation et créer le compte.`,
        }),
      });
    } catch (e) { console.error("[quick-order] Brevo notification interne échouée:", (e as Error)?.message ?? String(e), (e as { body?: unknown })?.body ?? null); }
  }

  return json({
    ok: true,
    reference: ref,
    subtotal_ht_cents: subtotal,
    shipping_ht_cents: shipping,
    total_ttc_cents: subtotal + shipping + vatTotal,
    franco_reached: francoReached,
    rejected,
  });
}
