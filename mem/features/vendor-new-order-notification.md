---
name: Vendor New Order Notification
description: Email + notif cloche + sub_orders fan-out + magic-link token déclenchés quand commande passe payée/confirmée
type: feature
---
Quand une commande passe à `payment_status='paid'` (via stripe-webhook `checkout.session.completed`/`payment_intent.succeeded` ou `check-session-status`), l'edge function `notify-vendors-new-order` est invoquée. Elle :

1. Appelle RPC `fanout_order_to_vendors(_order_id)` (SECURITY DEFINER) qui :
   - crée 1 `sub_orders` par vendeur distinct des `order_lines` (idempotent), lie via `order_line_sub_orders`,
   - insère 1 `vendor_notifications` (type `order_new`, cta `/vendor/commandes`) dédoublonnée via `vendor_notification_dispatch_log` (source_type=`order_new`, source_id=sub_order_id),
   - **résout l'email vendeur via cascade `COALESCE(v.contact_email, v.shipping_email, v.email)`** (P2),
   - **génère 1 `vendor_order_tokens` par sub_order** (idempotent, base64url 32 bytes, expires_at = created_at + 90j absolus, RLS deny-all sauf service_role) et le retourne dans `magic_token`.

2. Envoie l'email transactionnel `vendor-new-order` avec `idempotencyKey=vendor-new-order-<sub_order_id>` et **CTA magic-link** `https://medikong.pro/vendor/order/<order_number>?token=<magic_token>` (fallback `PORTAL_URL=/vendor/commandes` si pas de token).

⚠️ La page front `/vendor/order/:orderNumber?token=…` n'est PAS encore implémentée — bloc séparé à créer.

SLA overdue restent gérés par cron `check-order-sla` → table `order_vendor_sla_alerts`. Page admin `/admin/commandes-en-retard` (`AdminCommandesEnRetard`) liste les alertes ouvertes (severity, hours_overdue, vendeur, commande) avec bouton "Forcer un scan SLA".
