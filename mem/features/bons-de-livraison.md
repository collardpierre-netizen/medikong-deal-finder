---
name: Bons de livraison (BL)
description: Bons de livraison totaux/partiels avec back order sur les commandes (admin + vendeur), tables delivery_notes/delivery_note_lines, PDF BL-YYYY-####
type: feature
---
- Tables `delivery_notes` (document_number `BL-YYYY-####` via `generate_document_number('delivery_note')`, status issued/cancelled, carrier, tracking_number, note, snapshot shipping_address) et `delivery_note_lines` (quantité par ligne de commande).
- Reliquat : colonnes `order_lines.backorder_status` (open/cancelled/undeliverable) + `backorder_note` + `backorder_updated_at`. Calcul auto = qté commandée − Σ BL émis ; statut manuel via RPC.
- RPCs : `get_order_delivery_status(_order_id)`, `create_delivery_note(_order_id,_lines,_carrier,_tracking_number,_note)` (contrôle qté ≤ reliquat, met à jour `quantity_shipped`), `cancel_delivery_note`, `set_order_line_backorder_status`.
- Accès : admin (is_admin) sur toute la commande ; vendeur (current_vendor_id) restreint à ses propres lignes.
- UI : `src/components/orders/DeliveryNotesPanel.tsx` monté dans `AdminCommandeDetail` et `VendorOrderDetail` ; PDF client `src/lib/delivery-note-pdf.ts` (badge LIVRAISON TOTALE / PARTIELLE, filigrane ANNULÉ, ligne signature) ; hooks `src/hooks/useDeliveryNotes.ts`.
