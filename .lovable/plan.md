
# Système d'Alertes Prix MediKong

## Phase 1 — Fondations (base de données + détection)
1. **Migration DB** : Créer les tables `price_alerts`, `price_alert_vendors`, `price_alert_settings`, `price_alert_notifications`, `price_adjustment_log`, `vendor_notification_preferences`
2. **Fonction de détection** : Edge function ou DB function qui compare les prix MediKong vs marché/externes et génère les alertes
3. **Settings par défaut** : Seuils initiaux (5%, 15%, marge compétitive 1%)

## Phase 2 — Dashboard Superadmin
4. **Page `/admin/price-alerts`** : KPI cards + tableau filtrable/triable des alertes
5. **Vue détail `/admin/price-alerts/:id`** : Graphique prix, tableau vendeurs, historique notifications
6. **Page settings `/admin/price-alerts/settings`** : Configuration seuils, notifications auto

## Phase 3 — Portail Vendeur
7. **Page `/vendor/price-alerts`** : Liste des alertes du vendeur avec prix suggéré
8. **Vue détail vendeur** : Positionnement visuel, suggestion de prix, bouton d'alignement rapide
9. **Badge notification** : Badge rouge sur nav + bandeau d'alerte sur dashboard
10. **Préférences notifications** : Page settings vendeur

## Phase 4 — Notifications & Automatisation
11. **Notifications in-app** : Realtime via Supabase
12. **Notifications email** : Templates + Edge function d'envoi
13. **Alignement automatique** : Toggle vendeur + logique d'auto-ajustement
14. **Actions groupées superadmin** : Sélection multiple + notification en masse

## Approche
- Commencer par Phase 1 + 2 (fondations + admin) car c'est le cœur du système
- Phase 3 suit naturellement
- Phase 4 en dernier (notifications email nécessitent l'infra déjà en place)
