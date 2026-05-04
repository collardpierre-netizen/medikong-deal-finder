---
name: Vendor New Order Notification
description: Email + notif cloche + sub_orders fan-out déclenchés quand commande passe payée/confirmée
type: feature
---
Quand une commande passe à `payment_status='paid'` (via stripe-webhook `checkout.session.completed`/`payment_intent.succeeded` ou `check-session-status`), l'edge function `notify-vendors-new-order` est invoquée. Elle :
1. Appelle RPC `fanout_order_to_vendors(_order_id)` (SECURITY DEFINER) qui crée 1 `sub_orders` par vendeur distinct des `order_lines` (idempotent), lie via `order_line_sub_orders`, et insère 1 `vendor_notifications` (type `order_new`, cta `/vendor/commandes`) dédoublonnée via `vendor_notification_dispatch_log` (source_type=`order_new`, source_id=sub_order_id).
2. Envoie l'email transactionnel `vendor-new-order` (template MediKong, Primary Blue #1C58D9, logo cms-images, CTA portail vendeur, rappel délais SLA depuis `vendor_sla_settings`) avec `idempotencyKey=vendor-new-order-<sub_order_id>`.

SLA overdue restent gérés par cron `check-order-sla` → table `order_vendor_sla_alerts`. Page admin `/admin/commandes-en-retard` (`AdminCommandesEnRetard`) liste les alertes ouvertes (severity, hours_overdue, vendeur, commande) avec bouton "Forcer un scan SLA".
