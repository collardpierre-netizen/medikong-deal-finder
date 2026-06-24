## Objectif

Permettre à l'admin **et au vendeur** de créer une commande au statut **Devis**, de l'envoyer au client par lien partageable + PDF, puis de la transformer en **Bon de commande** une fois acceptée et payée (facture ou Stripe).

## Cycle de vie

```
draft → sent → accepted → paid → order
                  ↓
              declined
```

- `draft` : créé, modifiable, lien non actif
- `sent` : token public généré, lien partageable, PDF v1 figé, email envoyé au client
- `accepted` : client a cliqué "Accepter" sur la page publique (IP + timestamp horodatés)
- `paid` : paiement reçu (admin marque payée si facture, OU webhook Stripe)
- `order` : conversion auto en bon de commande dès `paid` → apparaît dans `/admin/commandes`
- `declined` : client refuse via le lien (terminal)

## Choix paiement

À la création (admin/vendeur), radio obligatoire :
- **Paiement par facture** : page publique affiche "Une facture sera émise après acceptation"
- **Paiement Stripe** : page publique affiche bouton "Payer maintenant" (Stripe Checkout, EUR, TVA calculée). Paiement réussi → passe directement `accepted` puis `paid`.

## Lien public

- URL : `/devis/<token>` (token 48 chars, `gen_random_bytes`)
- **Pas d'auth** requise
- Affiche : entête vendeur (logo + coordonnées), entête client, lignes (produit, qté, PU HTVA, TVA, total), totaux HTVA/TVAC, mode de paiement, conditions, boutons "Accepter / Refuser" + "Télécharger PDF"
- Une fois `accepted` ou `declined`, boutons disparaissent, bandeau de statut

## PDF

- Edge function `generate-quote-pdf` (pdf-lib ou puppeteer-less template)
- Stocké bucket privé `quote-pdfs`, URL signée 1h pour admin/vendeur
- Page publique régénère à la volée pour le client
- Mêmes coordonnées légales que factures MediKong (Balooh SRL, BE 1005.771.323)

## Données

### Table `quotes`
- `id`, `order_id` (FK orders, set à la conversion), `vendor_id`, `customer_id`, `created_by_user_id`
- `quote_number` (séquence `Q-2026-0001`)
- `status` enum (`draft|sent|accepted|paid|declined|converted`)
- `payment_method` (`invoice|stripe`)
- `public_token` (unique, 48 chars), `token_expires_at` (90j)
- `accepted_at`, `accepted_ip`, `declined_at`, `paid_at`, `converted_at`
- `stripe_session_id`, `stripe_payment_intent_id`
- `total_ht_cents`, `total_tva_cents`, `total_ttc_cents`, `currency_code`
- `pdf_storage_path`
- `notes_internal`, `notes_customer`
- `created_at`, `updated_at`

### Table `quote_lines`
- `id`, `quote_id`, `product_id` (nullable), `offer_id` (nullable), `label`, `qty`
- `unit_price_ht_cents`, `vat_rate`, `total_ht_cents`, `total_ttc_cents`
- `unit_cost_ht_cents` (interne — marge)

### RLS + GRANTs
- `quotes` / `quote_lines` :
  - admins (SELECT/INSERT/UPDATE/DELETE via `is_admin()`)
  - vendeur (SELECT/INSERT/UPDATE sur `vendor_id = current_vendor_id()`)
  - lecture publique uniquement via RPC `get_quote_by_token(_token)` (security definer) — pas de policy `anon` directe
- GRANTs : `authenticated` + `service_role` ; pas d'`anon`

## Backend

### Edge functions
- `generate-quote-pdf` : génère + upload PDF, retourne URL signée
- `quote-create-stripe-session` : crée Checkout Session (mode payment), success_url = `/devis/<token>?paid=1`
- `quote-stripe-webhook` : `checkout.session.completed` → quote `paid` + conversion auto en order
- `quote-public-action` : POST `{token, action: 'accept'|'decline'}` (no JWT, rate-limit IP)
- `send-quote-email` : envoi email au client avec lien + PDF en pièce jointe

### RPCs
- `get_quote_by_token(_token)` : lecture publique sécurisée (vérifie expiration + statut)
- `convert_quote_to_order(_quote_id)` : crée `orders` + `order_lines` depuis le devis, set `quotes.order_id` + `status='converted'`
- `mark_quote_paid(_quote_id)` : admin marque facture payée → trigger conversion

### Stripe
- Réutilise le Stripe existant du projet (Stripe Connect pour les vendeurs marketplace). 
- **V1** : paiement direct sur compte MediKong (option b du choix bloquant précédent — plus simple, MediKong refacture le vendeur via la mécanique d'order_transfers existante).
- Devise EUR uniquement.

## Frontend

### Admin
- `/admin/commande-manuelle` : ajout toggle **"Type de document"** (Bon de commande direct | **Devis**) + radio paiement (Facture | Stripe). Si Devis coché → crée une `quote` au lieu d'une `order`.
- Nouvelle page `/admin/devis` : tableau filtrable (statut, vendeur, client, total TTC, date). Actions : Voir / Télécharger PDF / Copier lien public / Renvoyer email / Marquer payé (si invoice + accepted) / Convertir manuellement.
- Détail `/admin/devis/:id` : preview + timeline (créé → envoyé → vu → accepté → payé → converti) + actions.

### Vendeur
- Nouvelle page `/vendor/devis` (liste filtrée sur son `vendor_id`)
- Nouvelle page `/vendor/devis/nouveau` (formulaire simplifié — customer picker limité à ses clients connus + création rapide)
- Entrée sidebar dans section "Commandes"

### Public
- `/devis/:token` : page standalone (sans nav admin), responsive, brandée MediKong + branding vendeur
- Composants : `QuoteHeader`, `QuoteLinesTable`, `QuoteTotals`, `PaymentBlock` (CTA Stripe ou mention facture), `AcceptDeclineBlock`, `DownloadPdfButton`

## Hors scope V1

- Pas de signature électronique avancée (juste accept timestamp + IP)
- Pas de relances automatiques (cron possible plus tard)
- Pas de devis multi-vendeurs (1 devis = 1 vendeur)
- Pas de versioning : modif après `sent` bloquée, sauf "Renvoyer en draft" qui invalide le token
- Pas d'export comptable spécifique

## Étapes d'implémentation (ordre)

1. **Migration DB** : tables `quotes`, `quote_lines`, séquence numéro, RPCs `get_quote_by_token` + `convert_quote_to_order` + `mark_quote_paid`, RLS + GRANTs
2. **Bucket Storage** `quote-pdfs` (privé) + RLS
3. **Edge function** `generate-quote-pdf` + template
4. **Page publique** `/devis/:token` (read-only + accept/decline)
5. **Adaptation `AdminCommandeManuelle`** (toggle Devis + envoi)
6. **Page `/admin/devis`** (liste + détail + actions)
7. **Pages vendeur** `/vendor/devis` + `/vendor/devis/nouveau`
8. **Intégration Stripe** Checkout + webhook
9. **Conversion auto** `paid → order` (déjà couverte par RPC ; vérification end-to-end)
10. **Email** `send-quote-email` (lien + PDF)

---

C'est un module conséquent (~10 étapes, 2 nouvelles tables, 4-5 edge functions, 5-6 nouvelles pages). Confirme et je commence par l'étape 1 (migration DB).
