// MEDIKONG — Quick Order · supabase/functions/quick-order/handle-get.ts
// GET : résout le token en payload personnalisé.

import {
  db, json, hashIp, estimatedDelivery, resolveLang, tr, localizeItem,
} from "./_shared.ts";

export async function handleGet(
  token: string,
  ip: string,
  langParam: string | null = null,
): Promise<Response> {
  const { data: recipient } = await db
    .from("qo_recipients")
    .select("*, qo_campaigns(*)")
    .eq("token", token)
    .maybeSingle();

  // Message volontairement identique pour "token inconnu" et "token expiré" :
  // on ne confirme jamais l'existence d'un token à un curieux.
  if (!recipient) return json({ error: "invalid_link" }, 404);

  const campaign = recipient.qo_campaigns;
  const now = new Date();

  if (recipient.unsubscribed_at) return json({ error: "unsubscribed" }, 410);
  if (new Date(recipient.expires_at) < now || campaign.status === "closed") {
    await db.from("qo_events").insert({
      recipient_id: recipient.id,
      type: "expired",
    });
    return json({
      error: "expired",
      campaign: { name: campaign.name, ends_on: campaign.ends_on },
    }, 410);
  }
  if (campaign.status !== "active") return json({ error: "invalid_link" }, 404);

  await db.from("qo_recipients").update({
    first_opened_at: recipient.first_opened_at ?? now.toISOString(),
    last_opened_at: now.toISOString(),
    open_count: (recipient.open_count ?? 0) + 1,
  }).eq("id", recipient.id);

  await db.from("qo_events").insert({
    recipient_id: recipient.id,
    type: "open",
    meta: { ip: await hashIp(ip) },
  });

  const { data: items } = await db
    .from("qo_offer_items")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("active", true)
    .order("position", { ascending: true });

  const { data: lastOrder } = await db
    .from("qo_orders")
    .select("reference, created_at, total_ttc_cents")
    .eq("recipient_id", recipient.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Lot 2 : paramètre lang > recipient.language > campaign.language > 'fr'.
  const lang = resolveLang(langParam, recipient.language, campaign.language);
  const t = (f: string) => tr(campaign, f, lang);

  return json({
    language: lang,
    pharmacy: {
      name: recipient.pharmacy_name,
      city: recipient.city,
      contact_name: recipient.contact_name,
      phone: recipient.phone,
      language: recipient.language,
      consent_status: recipient.consent_status,
    },
    campaign: {
      name: campaign.name,
      headline: t("headline"),
      ends_on: campaign.ends_on,
      franco_threshold_cents: campaign.franco_threshold_cents,
      cashback_multiplier: campaign.cashback_multiplier,
      payment_terms_days: campaign.payment_terms_days,
      allocation_note: t("allocation_note"),
      vendor_label: t("vendor_label"),
      shipping_fee_cents: campaign.shipping_fee_cents,
      market_price_label: t("market_price_label"),
      margin_note: t("margin_note"),
      ask_buyer_price: campaign.ask_buyer_price,
      delivery_label: t("delivery_label"),
      carrier_label: t("carrier_label"),
      estimated_delivery: estimatedDelivery(
        campaign.cutoff_hour ?? 14,
        campaign.lead_time_days ?? 2,
        lang,
      ),
      returns_label: t("returns_label"),
      carrier_short_label: t("carrier_short_label"),
      returns_short_label: t("returns_short_label"),
      origin_label: t("origin_label"),
      payment_terms_label: t("payment_terms_label"),
      contact_label: t("contact_label"),
    },
    items: (items ?? []).map((i: Record<string, any>) => localizeItem(i, lang)),
    already_ordered: lastOrder ?? null,
  });
}
