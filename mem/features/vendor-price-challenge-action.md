---
name: Vendor Price Challenge — Notification + Email + Anti-spam
description: Action admin "Challenger le vendeur" depuis /admin/prix-cockpit. Crée vendor_notifications (type=price_challenge), log via RPC admin_log_price_challenge, envoie email transactionnel vendor-price-challenge. Anti-spam serveur (cooldown produit/vendeur, quota journalier, écart minimum) + métriques (taux de réponse, délai, baisse moyenne).
type: feature
---

## Flow d'envoi
1. Création `vendor_notifications` (type=`price_challenge`, payload prix/écart/ref_label)
2. Log via RPC `admin_log_price_challenge(_vendor_id, _product_id, _offer_id, _reason, _ref_price_ht, _mk_price_ht, _delta_pct, _message, _notification_id, _force=false)` → table `vendor_price_challenges`
3. Email `vendor-price-challenge` (best-effort, idempotencyKey `price-challenge-<notif_id>`)

## Anti-spam serveur
Table singleton `price_challenge_settings` (admin only) :
- `cooldown_days` (défaut 7) : pas 2× le même couple produit/vendeur sur cette période
- `min_delta_pct` (défaut 2%) : refuse les challenges sur de petits écarts
- `max_per_vendor_per_day` (défaut 5) : quota journalier par vendeur

`admin_log_price_challenge` lève `price_challenge_blocked: …` (errcode P0001) si une règle est violée. Paramètre `_force=true` réservé admin permet le bypass (passé par le toggle "Forcer l'envoi" dans `PriceChallengeModal`).

RPC `check_price_challenge_cooldown(_vendor_id, _product_id)` retourne `{ allowed, block_reason, last_sent_at, next_allowed_at, sent_today }` — appelée à l'ouverture du modal pour afficher un bandeau d'alerte avant l'envoi.

## Métriques
- Trigger `trg_offers_detect_challenge_response` sur `offers.price_excl_vat` : quand le vendeur baisse son prix dans les 30j suivants un challenge ouvert, met à jour `responded_at` et `responded_delta_pct` automatiquement.
- Vue `vendor_price_challenge_metrics_v` (admin only, security_invoker) : par vendeur → `total_challenges`, `responded_count`, `response_rate_pct`, `avg_response_delta_pct`, `avg_response_days`, `last_sent_at`, `last_open_challenge_at`, `sent_30d`, `responded_30d`.
- Onglet "Métriques challenges" dans `/admin/prix-cockpit` (3e onglet).
