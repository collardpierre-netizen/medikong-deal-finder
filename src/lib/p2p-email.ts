import { supabase } from "@/integrations/supabase/client";

const APP_URL = typeof window !== "undefined" ? window.location.origin : "https://medikong.pro";

type Role = "seller" | "target";

async function getContact(listingId: string, role: Role) {
  const { data, error } = await (supabase as any).rpc("buyer_p2p_get_contact", {
    _listing_id: listingId,
    _role: role,
  });
  if (error || !data?.[0]?.email) return null;
  return data[0] as { email: string; pharmacy_name: string | null; buyer_id: string };
}

async function send(templateName: string, recipientEmail: string, templateData: Record<string, any>, idempotencyKey: string) {
  try {
    await supabase.functions.invoke("send-app-email", {
      body: { templateName, recipientEmail, templateData, idempotencyKey },
    });
  } catch (e) {
    console.warn("[p2p-email] send failed", templateName, e);
  }
}

function fmtDateFr(iso?: string | null) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return iso; }
}

export async function notifyP2POfferReceived(listing: any) {
  const target = await getContact(listing.id, "target");
  const seller = await getContact(listing.id, "seller");
  if (!target) return;
  const totalHt = (Number(listing.unit_price_excl_vat_cents) * Number(listing.quantity)) / 100;
  await send(
    "p2p-offer-received",
    target.email,
    {
      recipientPharmacy: target.pharmacy_name,
      sellerPharmacy: seller?.pharmacy_name,
      productName: listing.product_name,
      brandName: listing.brand_name,
      gtin: listing.gtin,
      cnk: listing.cnk_code,
      quantity: listing.quantity,
      unitPriceHt: Number(listing.unit_price_excl_vat_cents) / 100,
      totalHt,
      vatRate: Number(listing.vat_rate),
      validUntil: fmtDateFr(listing.valid_until),
      batchNumber: listing.batch_number,
      expiryDate: listing.expiry_date,
      notes: listing.notes,
      ctaUrl: `${APP_URL}/compte/offres-recues`,
    },
    `p2p-received-${listing.id}`,
  );
}

export async function notifyP2POfferAccepted(listing: any) {
  const seller = await getContact(listing.id, "seller");
  const buyer = await getContact(listing.id, "target");
  if (!seller) return;
  const totalHt = (Number(listing.unit_price_excl_vat_cents) * Number(listing.quantity)) / 100;
  await send(
    "p2p-offer-accepted",
    seller.email,
    {
      sellerPharmacy: seller.pharmacy_name,
      buyerPharmacy: buyer?.pharmacy_name,
      productName: listing.product_name,
      quantity: listing.quantity,
      totalHt,
      vatRate: Number(listing.vat_rate),
      ctaUrl: `${APP_URL}/compte/ventes-privees`,
    },
    `p2p-accepted-${listing.id}`,
  );
}

export async function notifyP2POfferDeclined(listing: any) {
  const seller = await getContact(listing.id, "seller");
  const buyer = await getContact(listing.id, "target");
  if (!seller) return;
  await send(
    "p2p-offer-declined",
    seller.email,
    {
      sellerPharmacy: seller.pharmacy_name,
      buyerPharmacy: buyer?.pharmacy_name,
      productName: listing.product_name,
      ctaUrl: `${APP_URL}/compte/ventes-privees`,
    },
    `p2p-declined-${listing.id}`,
  );
}

export async function notifyP2PCounterOffer(params: {
  listing: any;
  authorBuyerId: string;
  messageId: string;
  body: string;
  counterQuantity?: number | null;
  counterUnitPriceCents?: number | null;
}) {
  const { listing, authorBuyerId, messageId, body, counterQuantity, counterUnitPriceCents } = params;
  // Recipient = the other party
  const role: Role = listing.seller_buyer_id === authorBuyerId ? "target" : "seller";
  const recipient = await getContact(listing.id, role);
  const author = await getContact(listing.id, role === "target" ? "seller" : "target");
  if (!recipient) return;
  await send(
    "p2p-counter-offer",
    recipient.email,
    {
      recipientPharmacy: recipient.pharmacy_name,
      authorPharmacy: author?.pharmacy_name,
      productName: listing.product_name,
      body,
      counterQuantity: counterQuantity ?? null,
      counterUnitPriceHt: counterUnitPriceCents != null ? counterUnitPriceCents / 100 : null,
      ctaUrl: role === "target" ? `${APP_URL}/compte/offres-recues` : `${APP_URL}/compte/ventes-privees`,
    },
    `p2p-msg-${messageId}`,
  );
}
