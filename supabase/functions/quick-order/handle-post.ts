// MEDIKONG — Quick Order · supabase/functions/quick-order/handle-post.ts
// POST : désinscription, et soumission de commande avec recalcul intégral
// des prix côté serveur. Le navigateur n'est jamais la source d'un montant.

import {
  db, json, hashIp, effectiveUnitPrice, freeUnits, estimatedDelivery,
  reference, NOTIFY_EMAIL, BREVO_API_KEY, type OfferItem,
  timingSafeEqualStr, normalizeEmail, isValidEmail, isValidBce, digitsOnly,
  dedupeKey,
  findRecentTwin,
  resolveLang, tr, vatFromBases, localizeItem, type Lang,
} from "./_shared.ts";

const eur = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

/**
 * Accusé de réception pharmacien, dans la langue de la commande.
 * Paiement à 30 jours sur facture : plus aucun bloc virement.
 * (La notification interne n'utilise pas cette fonction : toujours en FR.)
 */
function buildReceipt(a: {
  lang: Lang;
  ref: string;
  lines: Array<Record<string, unknown>>;
  names: Map<string, string>;
  subtotal: number;
  shipping: number;
  totalTtc: number;
  campaign: Record<string, any>;
  etaLabel: string;
}): { subject: string; text: string } {
  const { lang, ref, lines, campaign } = a;
  const nl = lang === "nl";
  const t = (f: string) => tr(campaign, f, lang);
  const lineText = lines.map((l) =>
    (l.line_type === "request" ? (nl ? "[IN PROSPECTIE] " : "[EN PROSPECTION] ") : "") +
    `${l.cnk ?? "CNK ?"} · ${l.qty} x ${a.names.get(String(l.offer_item_id)) ?? l.name}` +
    (Number(l.free_units) > 0 ? ` (+${l.free_units} ${nl ? "gratis" : "offertes"})` : "") +
    ` — ${eur(Number(l.unit_price_cents))} €/${nl ? "st." : "u"}`
  ).join("\n");
  const vendor = t("vendor_label");
  const carrier = t("carrier_label");
  const contact = t("contact_label") ?? "";
  const hasRequest = lines.some((l) => l.line_type === "request");
  const footer =
    `MediKong SRL · BE 1005.771.323 · Rue de la Procession 23, 7822 Meslin-l'Évêque (Ath)\n`;

  if (nl) {
    return {
      subject: `Goed ontvangen — uw bestelling ${ref}`,
      text:
        `Goedendag,\n\n` +
        `U hebt zonet een bestelling geplaatst op commande.medikong.pro.\n` +
        `Hieronder vindt u het overzicht.\n\n` +
        `Wij hebben uw bestelling ${ref} goed ontvangen.\n\n` +
        lineText + `\n\n` +
        `Totaal goederen excl. btw : ${eur(a.subtotal)} €\n` +
        (a.shipping > 0
          ? `Leveringskosten : ${eur(a.shipping)} € ` +
            `(gratis vanaf ${eur(campaign.franco_threshold_cents ?? 0)} €)\n`
          : `Gratis levering\n`) +
        `\n------------------------------\n` +
        `Bedrag van uw bestelling: ${eur(a.totalTtc)} € incl. btw\n` +
        `Betaling op factuur binnen 30 dagen.\n` +
        `Uw factuur volgt samen met de orderbevestiging.\n` +
        `------------------------------\n\n` +
        (vendor ? `${vendor}\n` : "") +
        `Geschatte levering : ${a.etaLabel}` +
        (carrier ? ` — ${carrier}` : "") + `\n` +
        (hasRequest
          ? `De referenties in prospectie vallen niet onder deze datum: ` +
            `wij komen bij u terug met de vaste prijs en de levertermijn.\n`
          : "") +
        `\nWij bevestigen de bestelling binnen 24 werkuren.\n` +
        `Een vraag in tussentijd: ${contact}\n\n` + footer,
    };
  }

  return {
    subject: `Bien reçu — votre commande ${ref}`,
    text:
      `Bonjour,\n\n` +
      `Vous venez de passer commande sur commande.medikong.pro.\n` +
      `Voici le récapitulatif.\n\n` +
      `Nous avons bien reçu votre commande ${ref}.\n\n` +
      lineText + `\n\n` +
      `Total marchandises HTVA : ${eur(a.subtotal)} €\n` +
      (a.shipping > 0
        ? `Frais de livraison : ${eur(a.shipping)} € ` +
          `(offerts dès ${eur(campaign.franco_threshold_cents ?? 0)} €)\n`
        : `Livraison offerte\n`) +
      `\n------------------------------\n` +
      `Montant de votre commande : ${eur(a.totalTtc)} € TTC\n` +
      `Paiement à 30 jours sur facture.\n` +
      `Votre facture vous parvient avec la confirmation de commande.\n` +
      `------------------------------\n\n` +
      (vendor ? `${vendor}\n` : "") +
      `Livraison estimée : ${a.etaLabel}` +
      (carrier ? ` — ${carrier}` : "") + `\n` +
      (hasRequest
        ? `Les références en prospection ne sont pas couvertes par cette date : ` +
          `nous revenons vers vous avec le prix ferme et le délai.\n`
        : "") +
      `\nNous confirmons la commande sous 24 h ouvrables.\n` +
      `Une question d'ici là : ${contact}\n\n` + footer,
  };
}

const localNames = (items: Map<string, OfferItem>, lang: Lang) =>
  new Map([...items].map(([id, i]) => [id, String(tr(i as any, "name", lang) ?? i.name)]));

type IncomingLine = {
  item_id: string;
  qty: number;
  /** Prix d'achat actuel déclaré par le pharmacien, en centimes. Optionnel. */
  buyer_price_cents?: number;
};

export async function handlePost(req: Request, ip: string): Promise<Response> {
  let body: {
    token?: string;
    action?: string;
    lines?: IncomingLine[];
    contact_name?: string;
    contact_phone?: string;
    comment?: string;
    requested_delivery_date?: string;
    consent?: boolean;
    consent_text_version?: string;
    /** Parcours groupement uniquement. */
    campaign_code?: string;
    access_code?: string;
    identity?: GroupIdentity;
    email?: string;
    pharmacy_name?: string;
    /** Lot 2 : langue de la commande ('fr' | 'nl'). */
    language?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // --- Aiguillage groupement -------------------------------------------------
  // Discriminant strict : `action` groupement ET `campaign_code` présent.
  // En dessous, le parcours par token est inchangé.
  const groupAction = typeof body.action === "string" ? body.action : "";
  const groupCode = typeof body.campaign_code === "string" ? body.campaign_code.trim() : "";
  if (groupCode && (groupAction === "unlock" || groupAction === "order" || groupAction === "subscribe")) {
    return await handleGroupPost(req, ip, body, groupAction, groupCode);
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
  // Lot 2 : body.language > recipient.language > campaign.language > 'fr'.
  const lang = resolveLang(body.language, recipient.language, campaign.language);
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

    subtotal += lineHt;

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
  // Lot 6 : TVA sur la somme des bases par taux, un seul arrondi par taux.
  vatTotal = vatFromBases(lines, shipping, Number(campaign.shipping_vat_rate ?? 21));

  // --- Déduplication (mêmes deux mécanismes que le parcours /g) -----------
  const sigLines = lines.map((l) => ({ item_id: String(l.offer_item_id), qty: Number(l.qty) }));
  let twin10: { reference: string; total_ttc_cents: number } | null;
  try {
    twin10 = await findRecentTwin(recipient.id, sigLines, "token");
  } catch {
    return json({ error: "server_error" }, 500);
  }
  if (twin10) {
    return json({ ok: true, reference: twin10.reference, duplicate: true });
  }
  const key = await dedupeKey(recipient.id, sigLines);

  const { data: insertedRows, error: orderErr } = await db
    .from("qo_orders")
    .upsert({
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
      language: lang,
      dedupe_key: key,
      ip_hash: await hashIp(ip),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    }, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, reference");

  if (orderErr) {
    console.error("[quick-order][token] création commande échouée:", orderErr.message, orderErr);
    return json({ error: "server_error" }, 500);
  }
  const order = (insertedRows ?? [])[0];
  if (!order) {
    // Course perdue : la requête parallèle a déjà inséré la même commande.
    const { data: twin, error: twinErr } = await db
      .from("qo_orders").select("reference").eq("dedupe_key", key).maybeSingle();
    if (twinErr || !twin) {
      console.error("[quick-order][token] relecture doublon échouée:", twinErr?.message ?? "introuvable", twinErr);
      return json({ error: "server_error" }, 500);
    }
    return json({ ok: true, reference: twin.reference, duplicate: true });
  }

  const { error: linesErr } = await db.from("qo_order_lines").insert(
    lines.map((l) => ({ ...l, order_id: order.id })),
  );
  if (linesErr) {
    console.error("[quick-order][token] insertion lignes échouée:", linesErr.message, linesErr);
  }

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

  const eta = estimatedDelivery(campaign.cutoff_hour ?? 14, campaign.lead_time_days ?? 2, lang);

  if (BREVO_API_KEY && recipient.contact_email) {
    try {
      const receipt = buildReceipt({
        lang, ref, lines, names: localNames(byId, lang),
        subtotal, shipping, totalTtc: subtotal + shipping + vatTotal,
        campaign, etaLabel: eta.label,
      });
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: "MediKong", email: "pcoll@medikong.pro" },
          replyTo: { email: NOTIFY_EMAIL || "commandes@medikong.pro" },
          to: [{ email: recipient.contact_email, name: recipient.pharmacy_name }],
          subject: receipt.subject,
          textContent: receipt.text,
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

// ===========================================================================
// PARCOURS GROUPEMENT (Dynaphar) — additif. Aucune fonction ci-dessous n'est
// appelée par le parcours par token. Spécification v6.
// ===========================================================================

export type GroupIdentity = {
  pharmacy_name?: string;
  bce?: string;
  apb?: string;
  email?: string;
  contact_name?: string;
  phone?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  marketing_consent?: boolean;
};

const CONSENT_TEXT_VERSION = "v1-2026-09";
const SUBSCRIBE_EXPIRES_AT = "2027-12-31T00:00:00Z";

/** 401 unique : on ne distingue jamais code faux, campagne absente, close ou expirée. */
const invalidCode = () => json({ error: "invalid_code" }, 401);

async function logGroupEvent(type: string, meta: Record<string, unknown>) {
  const { error } = await db.from("qo_events").insert({ recipient_id: null, type, meta });
  if (error) {
    console.error(`[quick-order][group] journalisation ${type} échouée:`, error.message, error);
  }
}

/**
 * Résout la campagne par son code public et vérifie le code d'accès + l'état.
 * Aucune donnée n'est renvoyée avant ce contrôle.
 */
async function resolveGroupCampaign(
  campaignCode: string,
  accessCode: unknown,
): Promise<Record<string, unknown> | null> {
  const provided = typeof accessCode === "string" ? accessCode : "";
  const { data: campaign, error } = await db
    .from("qo_campaigns")
    .select("*")
    .eq("code", campaignCode)
    .maybeSingle();

  if (error) {
    console.error("[quick-order][group] lecture campagne échouée:", error.message, error);
    return null;
  }
  if (!campaign) return null;

  const expected = typeof campaign.access_code === "string" ? campaign.access_code : "";
  if (expected.length < 10) return null;
  if (provided.length < 10) return null;
  if (!timingSafeEqualStr(provided, expected)) return null;

  // État BLOQUANT : statut actif et campagne non terminée (dernier jour inclus).
  if (campaign.status !== "active") return null;
  if (new Date(`${campaign.ends_on}T23:59:59Z`).getTime() < Date.now()) return null;

  return campaign as Record<string, unknown>;
}

/** Bloc `campaign` du payload public, identique au parcours par token. */
function groupCampaignPayload(c: Record<string, any>, lang: Lang) {
  const t = (f: string) => tr(c, f, lang);
  return {
    name: c.name,
    headline: t("headline"),
    ends_on: c.ends_on,
    franco_threshold_cents: c.franco_threshold_cents,
    cashback_multiplier: c.cashback_multiplier,
    payment_terms_days: c.payment_terms_days,
    allocation_note: t("allocation_note"),
    vendor_label: t("vendor_label"),
    shipping_fee_cents: c.shipping_fee_cents,
    market_price_label: t("market_price_label"),
    margin_note: t("margin_note"),
    ask_buyer_price: c.ask_buyer_price,
    delivery_label: t("delivery_label"),
    carrier_label: t("carrier_label"),
    estimated_delivery: estimatedDelivery(c.cutoff_hour ?? 14, c.lead_time_days ?? 2, lang),
    returns_label: t("returns_label"),
    carrier_short_label: t("carrier_short_label"),
    returns_short_label: t("returns_short_label"),
    origin_label: t("origin_label"),
    payment_terms_label: t("payment_terms_label"),
    contact_label: t("contact_label"),
  };
}

export async function handleGroupPost(
  req: Request,
  ip: string,
  body: Record<string, any>,
  action: string,
  campaignCode: string,
): Promise<Response> {
  const campaign = await resolveGroupCampaign(campaignCode, body.access_code);

  if (!campaign) {
    if (action === "unlock") {
      await logGroupEvent("group_unlock_failed", {
        campaign_code: campaignCode.slice(0, 64),
        ip: await hashIp(ip),
      });
    }
    return invalidCode();
  }

  if (action === "unlock") return await groupUnlock(campaign, campaignCode, ip, body.language);
  if (action === "subscribe") return await groupSubscribe(campaign, body, ip);
  return await groupOrder(req, campaign, body, ip);
}

// --- 1. unlock -------------------------------------------------------------
async function groupUnlock(
  campaign: Record<string, any>,
  campaignCode: string,
  ip: string,
  langParam: unknown,
): Promise<Response> {
  // Lot 2 : body.language > campaign.language > 'fr' (pas de destinataire ici).
  const lang = resolveLang(langParam, campaign.language);
  const { data: items, error } = await db
    .from("qo_offer_items")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("active", true)
    .order("position", { ascending: true });

  if (error) {
    console.error("[quick-order][group] lecture offres échouée:", error.message, error);
    return json({ error: "server_error" }, 500);
  }

  await logGroupEvent("group_unlock", {
    campaign_code: campaignCode.slice(0, 64),
    ip: await hashIp(ip),
  });

  return json({
    language: lang,
    pharmacy: null,
    campaign: groupCampaignPayload(campaign, lang),
    items: (items ?? []).map((i: Record<string, any>) => localizeItem(i, lang)),
    already_ordered: null,
  });
}

// --- 3. subscribe ----------------------------------------------------------
async function groupSubscribe(
  campaign: Record<string, any>,
  body: Record<string, any>,
  ip: string,
): Promise<Response> {
  const email = normalizeEmail(body.email);
  const pharmacyName = typeof body.pharmacy_name === "string" ? body.pharmacy_name.trim() : "";
  if (!email || !isValidEmail(email) || !pharmacyName) {
    return json({ error: "invalid_identity" }, 400);
  }

  const res = await upsertGroupRecipient({
    campaign,
    email,
    identity: { pharmacy_name: pharmacyName },
    consentExplicit: true,
    consentSource: "page_groupement",
    expiresAt: SUBSCRIBE_EXPIRES_AT,
    ip,
  });
  if (!res.ok) return json({ error: "server_error" }, 500);

  return json({ ok: true });
}

/**
 * Destinataire : insertion, ou complétion des seuls champs vides en conflit.
 * On ne rétrograde jamais un consentement 'explicit', on ne raccourcit jamais
 * `expires_at`, on n'écrase jamais `source`/`flow`.
 */
async function upsertGroupRecipient(args: {
  campaign: Record<string, any>;
  email: string;
  identity: GroupIdentity;
  consentExplicit: boolean;
  consentSource: "page_commande" | "page_groupement";
  expiresAt: string;
  ip: string;
}): Promise<{ ok: boolean; recipient?: Record<string, any> }> {
  const { campaign, email, identity, consentExplicit, consentSource, expiresAt, ip } = args;
  const ipHash = await hashIp(ip);
  const now = new Date().toISOString();

  const consentFields = consentExplicit
    ? {
      consent_status: "explicit",
      consent_source: consentSource,
      consent_at: now,
      consent_ip_hash: ipHash,
      consent_text_version: CONSENT_TEXT_VERSION,
    }
    : { consent_status: "soft" };

  const { data: existing, error: readErr } = await db
    .from("qo_recipients")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("contact_email", email)
    .maybeSingle();

  if (readErr) {
    console.error("[quick-order][group] lecture destinataire échouée:", readErr.message, readErr);
    return { ok: false };
  }

  if (!existing) {
    const { data: created, error: insErr } = await db
      .from("qo_recipients")
      .insert({
        campaign_id: campaign.id,
        contact_email: email,
        pharmacy_name: (identity.pharmacy_name ?? "").slice(0, 200) || email,
        contact_name: identity.contact_name?.slice(0, 120) ?? null,
        phone: identity.phone?.slice(0, 40) ?? null,
        street: identity.street?.slice(0, 200) ?? null,
        postal_code: identity.postal_code ? digitsOnly(identity.postal_code).slice(0, 10) : null,
        city: identity.city?.slice(0, 120) ?? null,
        bce_number: identity.bce ? digitsOnly(identity.bce) : null,
        apb_number: identity.apb ? digitsOnly(identity.apb).slice(0, 10) || null : null,
        source: "dynaphar",
        flow: "cold",
        expires_at: expiresAt,
        ...consentFields,
      })
      .select("*")
      .single();

    if (!insErr && created) return { ok: true, recipient: created };

    // 23505 : collision sur (campaign_id, contact_email) → on relit et complète.
    if (insErr && insErr.code !== "23505") {
      console.error("[quick-order][group] création destinataire échouée:", insErr.message, insErr);
      return { ok: false };
    }
  }

  const { data: current, error: reReadErr } = await db
    .from("qo_recipients")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("contact_email", email)
    .maybeSingle();

  if (reReadErr || !current) {
    console.error(
      "[quick-order][group] relecture destinataire échouée:",
      reReadErr?.message ?? "introuvable",
      reReadErr,
    );
    return { ok: false };
  }

  const patch: Record<string, unknown> = {};
  const fill = (col: string, value: string | null) => {
    const cur = current[col];
    if (value && (cur === null || cur === undefined || String(cur).trim() === "")) {
      patch[col] = value;
    }
  };
  fill("pharmacy_name", identity.pharmacy_name?.slice(0, 200) ?? null);
  fill("contact_name", identity.contact_name?.slice(0, 120) ?? null);
  fill("phone", identity.phone?.slice(0, 40) ?? null);
  fill("street", identity.street?.slice(0, 200) ?? null);
  fill("postal_code", identity.postal_code ? digitsOnly(identity.postal_code).slice(0, 10) : null);
  fill("city", identity.city?.slice(0, 120) ?? null);
  fill("bce_number", identity.bce ? digitsOnly(identity.bce) : null);
  fill("apb_number", identity.apb ? digitsOnly(identity.apb).slice(0, 10) || null : null);
  fill("source", "dynaphar");

  // Consentement : jamais de rétrogradation.
  if (consentExplicit && current.consent_status !== "explicit") {
    Object.assign(patch, consentFields);
  }
  // `expires_at` : jamais raccourci.
  if (new Date(expiresAt).getTime() > new Date(current.expires_at).getTime()) {
    patch.expires_at = expiresAt;
  }

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await db.from("qo_recipients").update(patch).eq("id", current.id);
    if (updErr) {
      console.error("[quick-order][group] complétion destinataire échouée:", updErr.message, updErr);
      return { ok: false };
    }
  }

  return { ok: true, recipient: { ...current, ...patch } };
}

// --- 2. order --------------------------------------------------------------
async function groupOrder(
  req: Request,
  campaign: Record<string, any>,
  body: Record<string, any>,
  ip: string,
): Promise<Response> {
  const identity: GroupIdentity = (body.identity ?? {}) as GroupIdentity;
  const email = normalizeEmail(identity.email);
  const bce = digitsOnly(identity.bce);
  // APB : chiffres uniquement, borne large 4–10 (arrêter les saisies vides de
  // sens, pas de contrôle de format précis — décision du 25/09/2026).
  const apb = digitsOnly(identity.apb);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const missing =
    !str(identity.pharmacy_name) || !str(identity.contact_name) || !str(identity.phone) ||
    !str(identity.street) || !str(identity.city) || !email || !bce || !apb;
  if (
    missing || !isValidEmail(email) || !isValidBce(bce) ||
    !/^\d{4}$/.test(digitsOnly(identity.postal_code)) || !/^\d{4,10}$/.test(apb)
  ) {
    return json({ error: "invalid_identity" }, 400);
  }

  const incoming: IncomingLine[] = (Array.isArray(body.lines) ? body.lines : []).filter(
    (l: IncomingLine) =>
      l && typeof l.item_id === "string" && Number.isInteger(l.qty) && l.qty > 0,
  );
  if (incoming.length === 0) return json({ error: "empty_cart" }, 400);
  if (incoming.length > 100) return json({ error: "too_many_lines" }, 400);

  // Destinataire : la commande crée la relation client → 'soft' par défaut,
  // 'explicit' si la case marketing est cochée.
  const consentExplicit = identity.marketing_consent === true;
  const endsPlusOne = new Date(`${campaign.ends_on}T00:00:00Z`);
  endsPlusOne.setUTCDate(endsPlusOne.getUTCDate() + 1);
  const rec = await upsertGroupRecipient({
    campaign,
    email,
    identity: { ...identity, email },
    consentExplicit,
    consentSource: "page_commande",
    // Inscription marketing explicite = validité longue, sinon campagne + 1 jour.
    expiresAt: consentExplicit ? SUBSCRIBE_EXPIRES_AT : endsPlusOne.toISOString(),
    ip,
  });
  if (!rec.ok || !rec.recipient) return json({ error: "server_error" }, 500);
  const recipient = rec.recipient;
  const lang = resolveLang(body.language, campaign.language);

  // --- Recalcul intégral côté serveur (identique au parcours token) --------
  const { data: items, error: itemsErr } = await db
    .from("qo_offer_items")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("active", true)
    .in("id", incoming.map((l) => l.item_id));

  if (itemsErr) {
    console.error("[quick-order][group] lecture offres échouée:", itemsErr.message, itemsErr);
    return json({ error: "server_error" }, 500);
  }

  const byId = new Map<string, OfferItem>((items ?? []).map((i: OfferItem) => [i.id, i]));
  const lines: Array<Record<string, unknown>> = [];
  const rejected: string[] = [];
  let subtotal = 0;
  let vatTotal = 0;

  const buyerPrice = (v: unknown): number | null =>
    (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1_000_00)
      ? Math.round(v)
      : null;

  for (const l of incoming) {
    const item = byId.get(l.item_id);
    if (!item) { rejected.push(l.item_id); continue; }

    let qty = l.qty;
    if (qty < item.min_qty) qty = item.min_qty;
    if (item.max_qty && qty > item.max_qty) qty = item.max_qty;
    if (item.step_qty > 1) {
      qty = Math.max(item.min_qty, Math.round(qty / item.step_qty) * item.step_qty);
    }
    if (qty <= 0) { rejected.push(l.item_id); continue; }

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

    subtotal += lineHt;

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
  const shipping = francoReached ? 0 : (campaign.shipping_fee_cents ?? 0);
  // Lot 6 : TVA sur la somme des bases par taux, un seul arrondi par taux.
  vatTotal = vatFromBases(lines, shipping, Number(campaign.shipping_vat_rate ?? 21));
  const totalTtc = subtotal + shipping + vatTotal;

  // --- Alerte « 2e commande » : correspondance élargie, AVERTISSEMENT SEUL --
  let repeatPharmacy = false;
  {
    const { data: sameEmail, error: e1 } = await db
      .from("qo_orders")
      .select("id, recipient_id, qo_recipients!inner(contact_email)")
      .eq("campaign_id", campaign.id)
      .neq("status", "cancelled")
      .eq("qo_recipients.contact_email", email)
      .limit(1);
    if (e1) console.error("[quick-order][group] recherche commandes (email) échouée:", e1.message, e1);
    if ((sameEmail ?? []).length > 0) repeatPharmacy = true;

    // Le BCE n'est PAS utilisé ici : plusieurs officines peuvent partager
    // un même numéro d'entreprise (faux avertissements). Il reste enregistré
    // pour la facturation.
    if (!repeatPharmacy && apb) {
      const { data: sameApb, error: e2 } = await db
        .from("qo_orders")
        .select("id, qo_recipients!inner(apb_number)")
        .eq("campaign_id", campaign.id)
        .neq("status", "cancelled")
        .not("qo_recipients.apb_number", "is", null)
        .neq("qo_recipients.apb_number", "")
        .eq("qo_recipients.apb_number", apb)
        .limit(1);
      if (e2) console.error("[quick-order][group] recherche commandes (APB) échouée:", e2.message, e2);
      if ((sameApb ?? []).length > 0) repeatPharmacy = true;
    }
  }

  // --- Déduplication ---------------------------------------------------------
  const sigLines = lines.map((l) => ({ item_id: String(l.offer_item_id), qty: Number(l.qty) }));
  // Mécanisme 2 : re-soumission < 10 min (created_at), lignes identiques.
  let twin10: { reference: string; total_ttc_cents: number } | null;
  try {
    twin10 = await findRecentTwin(recipient.id, sigLines, "group");
  } catch {
    return json({ error: "server_error" }, 500);
  }
  if (twin10) {
    return json({ ok: true, duplicate: true, reference: twin10.reference, total_ttc_cents: twin10.total_ttc_cents });
  }
  // Mécanisme 1 : course — l'index UNIQUE sur dedupe_key (minute) tranche.
  const key = await dedupeKey(recipient.id, sigLines);

  const { data: inserted, error: orderErr } = await db
    .from("qo_orders")
    .upsert({
      reference: ref,
      recipient_id: recipient.id,
      campaign_id: campaign.id,
      subtotal_ht_cents: subtotal,
      shipping_ht_cents: shipping,
      vat_cents: vatTotal,
      total_ttc_cents: totalTtc,
      franco_reached: francoReached,
      contact_name: (identity.contact_name ?? "").slice(0, 120),
      contact_phone: (identity.phone ?? "").slice(0, 40),
      comment: (typeof body.comment === "string" ? body.comment : "").slice(0, 2000),
      language: lang,
      dedupe_key: key,
      ip_hash: await hashIp(ip),
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    }, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, reference, total_ttc_cents");

  if (orderErr) {
    console.error("[quick-order][group] création commande échouée:", orderErr.message, orderErr);
    return json({ error: "server_error" }, 500);
  }

  const order = (inserted ?? [])[0];

  // Rien inséré = doublon strict (même destinataire, mêmes lignes, < 10 min).
  if (!order) {
    const { data: twin, error: twinErr } = await db
      .from("qo_orders")
      .select("reference, total_ttc_cents")
      .eq("dedupe_key", key)
      .maybeSingle();
    if (twinErr || !twin) {
      console.error(
        "[quick-order][group] relecture doublon échouée:",
        twinErr?.message ?? "introuvable",
        twinErr,
      );
      return json({ error: "server_error" }, 500);
    }
    return json({
      ok: true,
      duplicate: true,
      reference: twin.reference,
      total_ttc_cents: twin.total_ttc_cents,
    });
  }

  const { error: linesErr } = await db.from("qo_order_lines").insert(
    lines.map((l) => ({ ...l, order_id: order.id })),
  );
  if (linesErr) {
    console.error("[quick-order][group] insertion lignes échouée:", linesErr.message, linesErr);
  }

  const { error: recUpdErr } = await db
    .from("qo_recipients")
    .update({ ordered_at: new Date().toISOString() })
    .eq("id", recipient.id);
  if (recUpdErr) {
    console.error("[quick-order][group] marquage ordered_at échoué:", recUpdErr.message, recUpdErr);
  }

  await logGroupEvent("submit", {
    reference: order.reference,
    subtotal_ht_cents: subtotal,
    campaign_code: campaign.code,
    group: true,
  });

  await sendGroupEmails({
    campaign,
    recipient: { ...recipient, contact_email: email },
    identity,
    lines,
    ref: order.reference,
    subtotal,
    shipping,
    totalTtc,
    francoReached,
    orderId: order.id,
    comment: typeof body.comment === "string" ? body.comment : "",
    repeatPharmacy,
    lang,
    names: localNames(byId, lang),
  });

  return json({
    ok: true,
    reference: order.reference,
    subtotal_ht_cents: subtotal,
    shipping_ht_cents: shipping,
    total_ttc_cents: totalTtc,
    franco_reached: francoReached,
    rejected,
  });
}

/** Accusé de réception pharmacien + alerte interne. Best effort, jamais bloquant. */
async function sendGroupEmails(a: {
  campaign: Record<string, any>;
  recipient: Record<string, any>;
  identity: GroupIdentity;
  lines: Array<Record<string, unknown>>;
  ref: string;
  subtotal: number;
  shipping: number;
  totalTtc: number;
  francoReached: boolean;
  orderId: string;
  comment: string;
  repeatPharmacy: boolean;
  lang: Lang;
  names: Map<string, string>;
}) {
  const { campaign, recipient, identity, lines, ref } = a;

  const lineText = lines.map((l) =>
    (l.line_type === "request" ? "[EN PROSPECTION] " : "") +
    `${l.cnk ?? "CNK ?"} · ${l.qty} x ${l.name}` +
    (Number(l.free_units) > 0 ? ` (+${l.free_units} offertes)` : "") +
    ` — ${eur(Number(l.unit_price_cents))} €/u`
  ).join("\n");

  const eta = estimatedDelivery(campaign.cutoff_hour ?? 14, campaign.lead_time_days ?? 2, a.lang);

  if (BREVO_API_KEY && recipient.contact_email) {
    try {
      const receipt = buildReceipt({
        lang: a.lang, ref, lines, names: a.names,
        subtotal: a.subtotal, shipping: a.shipping, totalTtc: a.totalTtc,
        campaign, etaLabel: eta.label,
      });
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: "MediKong", email: "pcoll@medikong.pro" },
          replyTo: { email: NOTIFY_EMAIL || "commandes@medikong.pro" },
          to: [{ email: recipient.contact_email, name: identity.pharmacy_name }],
          subject: receipt.subject,
          textContent: receipt.text,
        }),
      });
      if (!res.ok) {
        console.error(
          "[quick-order][group] Brevo accusé pharmacien refusé:",
          `HTTP ${res.status}`,
          await res.text(),
        );
      } else {
        const { error } = await db.from("qo_orders")
          .update({ receipt_sent_at: new Date().toISOString() })
          .eq("id", a.orderId);
        if (error) {
          console.error("[quick-order][group] marquage receipt_sent_at échoué:", error.message, error);
        }
      }
    } catch (e) {
      console.error(
        "[quick-order][group] Brevo accusé pharmacien échoué:",
        (e as Error)?.message ?? String(e),
        (e as { body?: unknown })?.body ?? null,
      );
    }
  }

  if (BREVO_API_KEY && NOTIFY_EMAIL) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: "MediKong", email: "pcoll@medikong.pro" },
          to: [{ email: NOTIFY_EMAIL }],
          subject: `Nouvelle commande ${ref} — ${identity.pharmacy_name}`,
          textContent:
            (a.repeatPharmacy
              ? `⚠ 2e commande de cette officine — vérifier si un regroupement ` +
                `d'expédition est possible.\n\n`
              : "") +
            `${identity.pharmacy_name} (${identity.city ?? "-"})\n` +
            `${recipient.contact_email} · ${identity.phone ?? "-"}\n` +
            `BCE : ${identity.bce ?? "-"} · APB : ${identity.apb ?? "-"}\n` +
            `Flux : cold · Source : dynaphar (groupement)\n` +
            `Campagne : ${campaign.code}\n` +
            `Total HTVA : ${eur(a.subtotal)} €\n` +
            `Franco atteint : ${a.francoReached ? "oui" : "non"}\n\n` +
            lineText +
            `\n\nCommentaire : ${a.comment || "-"}\n` +
            `\n→ À VALIDER : stock, délai, conditions de paiement. ` +
            `Puis envoyer la confirmation et créer le compte.`,
        }),
      });
      if (!res.ok) {
        console.error(
          "[quick-order][group] Brevo notification interne refusée:",
          `HTTP ${res.status}`,
          await res.text(),
        );
      }
    } catch (e) {
      console.error(
        "[quick-order][group] Brevo notification interne échouée:",
        (e as Error)?.message ?? String(e),
        (e as { body?: unknown })?.body ?? null,
      );
    }
  }
}
