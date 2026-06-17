---
name: Buyer P2P Private Sales V1
description: Ventes privées B2B entre acheteurs MediKong (nominative, 1 destinataire, sans escrow). Tables buyer_p2p_listings/messages/settings + 3 écrans (admin/vendeur/acheteur). Emails et acceptation→sub_order à venir.
type: feature
---
# Buyer P2P Private Sales V1

## Périmètre V1 validé
- B2B uniquement (acheteur ↔ acheteur), nominative (1 destinataire par vente).
- Pas d'escrow MediKong en V1, paiement via Stripe Connect après acceptation (livraison 3 à faire).
- Module activable par admin (`buyer_p2p_settings.is_enabled`), commission paramétrable (% bps + payeur seller/buyer/split).

## Schéma DB
- `buyer_p2p_settings` (singleton id=true) : default_commission_bps, commission_payer, max_validity_days, is_enabled.
- `buyer_p2p_listings` : seller_buyer_id, target_buyer_id, product_name/gtin/cnk/brand, quantity, unit_price_excl_vat_cents, vat_rate, valid_until, batch_number, expiry_date, status, commission_*, sub_order_id (FK sub_orders, alimenté par étape acceptation).
- `buyer_p2p_messages` : thread négociation (counter_quantity, counter_unit_price_excl_vat_cents).
- Trigger `_buyer_p2p_status_transitions` impose les transitions : draft→sent/cancelled, sent→accepted/declined/expired/cancelled, accepted→paid/cancelled, paid→shipped/completed, shipped→completed.

## Helpers & RLS
- `_current_user_buyer_ids()` : retourne tous les buyer_id du user via `buyers.user_id` + `account_memberships`.
- Listings : SELECT seller/target/admin, INSERT seller, DELETE seller(draft)/admin.
- Messages : SELECT seller/target/admin, INSERT party only sur listing draft/sent.

## Écrans (livraison 1)
- Admin `/admin/ventes-privees` (`AdminP2PSalesPage`) : settings + table globale + modale détail/messages (read-only).
- Acheteur-vendeur `/compte/ventes-privees` (`VentesPriveesPage`) : lister + créer (search buyer par nom pharmacie) + annuler draft/sent.
- Acheteur destinataire `/compte/offres-recues` (`OffresRecuesPage`) : accepter / refuser / négocier (messages + contre-offre).

## À venir
- Livraison 2 : 4 emails (`p2p-offer-received`, `p2p-offer-accepted`, `p2p-offer-declined`, `p2p-counter-offer`).
- Livraison 3 : edge function "acceptation → création sub_orders + checkout Stripe Connect", trigger sur status=accepted (UI ou edge).
