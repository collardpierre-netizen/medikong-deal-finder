# Plan — Pickup (enlèvement sur place) sur ReStock

Scope : **ReStock uniquement** (pas le marketplace B2B classique). Le paiement reste obligatoire et reste **bloqué en escrow** jusqu'à confirmation de remise. Les coordonnées vendeur ne sont révélées **qu'après paiement**.

---

## 1. Modèle de données

### `restock_listings` — nouvelles colonnes
- `pickup_enabled boolean default false` — le vendeur active "enlèvement sur place possible" sur l'annonce
- `pickup_address_line1 text`, `pickup_address_line2 text`, `pickup_postal_code text`, `pickup_city text`, `pickup_country_code text` — adresse de retrait (peut différer de l'adresse du vendeur)
- `pickup_contact_name text`, `pickup_contact_phone text`, `pickup_contact_email text`
- `pickup_hours jsonb` — créneaux horaires par jour (`{mon:[{from:"09:00",to:"12:00"}],…}`)
- `pickup_instructions text` — instructions libres (étage, code porte, parking, frigo…)

> Toutes ces colonnes sont **PRIVÉES** côté RLS : jamais exposées sur les annonces publiques. La vue publique ReStock continue de masquer le vendeur (cf. `mem://features/restock-anonymisation-vendeur`).

### `restock_transactions` — nouvelles colonnes
- `delivery_mode text check in ('shipping','pickup')` — choix de l'acheteur au checkout
- `pickup_deadline_at timestamptz` — = `paid_at + 10 jours`
- `pickup_handover_code text` — code 6 chiffres généré au paiement
- `pickup_qr_token text` — token UUID signé pour le QR code
- `pickup_confirmed_at timestamptz`, `pickup_confirmed_by uuid` (vendeur ou acheteur — les deux peuvent scanner / saisir)
- `pickup_confirmation_method text check in ('code_by_seller','code_by_buyer','qr_scan')`

### Nouvelle table `restock_pickup_events`
Audit trail : `transaction_id`, `event_type` (`code_attempt`/`code_success`/`qr_scan_success`/`coords_revealed`/`reminder_sent`/`auto_cancelled`), `actor_user_id`, `metadata jsonb`, `created_at`. RLS : lecture vendeur + acheteur de la transaction + admin.

---

## 2. Workflow Pickup

```text
1. Vendeur publie l'annonce
   └─ Toggle "Enlèvement sur place possible" → remplit adresse + horaires + contact + instructions
   
2. Acheteur voit l'annonce
   └─ Si pickup_enabled : choix au checkout entre "Livraison" et "Enlèvement sur place (gratuit)"
   └─ AUCUNE coordonnée vendeur affichée à ce stade
   
3. Paiement (escrow comme aujourd'hui — cf. restock-checkout-flow)
   └─ paid → génère pickup_handover_code (6 chiffres) + pickup_qr_token (UUID)
   └─ pickup_deadline_at = paid_at + 10 jours
   └─ Email acheteur : coordonnées complètes vendeur + horaires + instructions + code + QR + deadline
   └─ Email vendeur : notif "commande à préparer pour enlèvement" + code + QR + deadline
   └─ Event coords_revealed loggé
   
4. Enlèvement physique
   └─ Méthode A : acheteur tape le code côté écran vendeur (app vendeur)
   └─ Méthode B : vendeur tape le code côté écran acheteur (app acheteur)
   └─ Méthode C : l'un scanne le QR de l'autre
   └─ Toute confirmation valide → pickup_confirmed_at, déclenche escrow_release_window 48h (idem livraison)
   
5. Litige / no-show
   └─ J+8 : rappel email acheteur ("plus que 48h pour venir")
   └─ J+10 sans confirmation : auto-cancel transaction
       ├─ Remboursement acheteur MOINS flake penalty 20€ (cf. restock-flake-penalty)
       └─ Vendeur notifié, lot remis en vente automatiquement
```

---

## 3. UI

### Côté vendeur
- **Édition annonce ReStock** : nouvelle section "Enlèvement sur place" (toggle + formulaire adresse/horaires/contact/instructions) en dessous des options livraison existantes
- **Détail commande** (`/restock/vendor/orders/:id`) si `delivery_mode='pickup'` :
  - Bloc "Enlèvement sur place" avec deadline countdown
  - Bouton "Valider le retrait" → modal avec 2 onglets : "Saisir le code de l'acheteur" / "Scanner son QR"
  - Affiche aussi le code/QR du vendeur (pour que l'acheteur le saisisse côté vendeur)

### Côté acheteur
- **Checkout ReStock** : radio Livraison / Enlèvement sur place (gratuit) si dispo
- **Page confirmation paiement** + **email** : carte "Coordonnées de retrait" (adresse complète, contact, horaires, instructions, deadline) + code 6 chiffres en grand + QR code
- **Page commande** (`/restock/orders/:id`) : même bloc + bouton "Confirmer le retrait" (modal saisie code / scan QR)

### Admin
- Colonne `delivery_mode` dans le listing commandes ReStock + filtre
- Vue détail : timeline `restock_pickup_events`

---

## 4. RLS & sécurité

- `restock_listings.pickup_*` colonnes : visibles uniquement par le vendeur propriétaire et admin
- Coordonnées révélées à l'acheteur **uniquement via la vue/RPC `get_pickup_details(transaction_id)`** qui vérifie `transaction.buyer_user_id = auth.uid() AND transaction.status IN ('paid','awaiting_pickup','disputed')`
- `pickup_handover_code` : jamais exposé dans la vue publique de l'annonce ; généré server-side au moment du `paid` (trigger sur `restock_transactions`)
- Validation du code via **RPC `confirm_pickup(transaction_id, code | qr_token)`** : rate-limited (max 5 tentatives / 10 min via `restock_pickup_events`), retourne erreur générique en cas d'échec

---

## 5. Cron / jobs

- Cron horaire `restock-pickup-watchdog` (edge function) :
  - J+8 sans confirmation → email rappel acheteur + event `reminder_sent`
  - J+10 sans confirmation → appelle RPC `auto_cancel_pickup_transaction(id)` qui :
    - status → `cancelled_no_show`
    - rembourse acheteur (montant − 20€ flake penalty)
    - relibère le lot vendeur (stock dispo + `is_active=true`)
    - notifie les 2 parties
    - log event `auto_cancelled`

---

## 6. Découpage en étapes

1. **Migration DB** : colonnes `restock_listings` + `restock_transactions`, table `restock_pickup_events`, RLS, trigger génération code/QR au paiement, RPC `get_pickup_details` + `confirm_pickup` + `auto_cancel_pickup_transaction`
2. **UI vendeur** : section pickup dans l'édition annonce + bloc confirmation retrait dans détail commande
3. **UI acheteur** : option pickup au checkout + bloc coordonnées + bouton confirmation
4. **Emails** : 3 templates React-Email (`restock-pickup-instructions-buyer`, `restock-pickup-ready-seller`, `restock-pickup-reminder-buyer`)
5. **Cron watchdog** : edge function `restock-pickup-watchdog` + cron horaire
6. **Admin** : colonne + filtre + timeline events

---

## 7. Hors scope (à confirmer plus tard)

- Pas de géolocalisation/distance — l'acheteur voit juste l'adresse au paiement
- Pas de réservation de créneau précis (juste les horaires d'ouverture vendeur)
- Pas de signature manuscrite — code + QR suffisent
- Pas de photo preuve de remise — peut s'ajouter en v2 si besoin

Confirme et je commence par l'étape 1 (migration DB).
