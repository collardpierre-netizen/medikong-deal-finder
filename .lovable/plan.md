# Module Devis (Quotes)

Objectif : permettre à l'admin de créer un devis depuis `/admin/commandes/nouvelle`, de le partager via un lien public + PDF, et de le convertir en commande après acceptation.

## Étapes

### 1. Base de données (1 migration)
- Réutiliser les tables existantes `quotes` (28 colonnes) et `quote_lines` (14 colonnes) déjà présentes — auditer leurs colonnes et compléter ce qui manque (token public, expires_at, accepted_at, declined_at, pdf_path, status enum draft/sent/viewed/accepted/declined/expired/converted, converted_order_id).
- Ajouter colonnes manquantes uniquement (pas de recréation).
- RPC `quote_get_by_token(_token)` (security definer, anon) pour la page publique.
- RPC `admin_create_quote_from_payload(_payload jsonb)` calquée sur la création de commande manuelle.
- RPC `quote_accept(_token)` / `quote_decline(_token, _reason)` (anon, validation token + expires_at).
- RPC `admin_convert_quote_to_order(_quote_id)` (admin) : crée une vraie commande à partir du devis accepté, marque le devis `converted`.

### 2. Storage
- Bucket privé `quote-pdfs` + RLS (admin lecture/écriture, lecture via URL signée 7 jours pour le destinataire).

### 3. Edge functions
- `generate-quote-pdf` : génère le PDF côté serveur (template miroir des factures), upload dans `quote-pdfs`, met à jour `quotes.pdf_path`. Verrouillé admin via JWT.
- `send-quote-email` : envoie au client le lien public `/devis/<token>` + PDF en pièce jointe (template React-Email), best-effort, logge dans `audit_logs`.
- `quote-public-view` (verify_jwt=false) : tracker `viewed_at` au premier chargement du lien public.

### 4. Page admin — création (`/admin/commandes/nouvelle`)
- Toggle en haut : **Bon de commande** / **Devis** (par défaut bon de commande, comportement actuel inchangé).
- En mode Devis : champs additionnels (validité en jours, conditions, message client), bouton principal devient "Créer le devis".
- Après création : redirection vers `/admin/devis/<id>` avec actions (Aperçu PDF, Copier lien public, Envoyer par email, Marquer envoyé, Convertir en commande).

### 5. Page admin — liste & détail
- Nouvelle page `/admin/devis` : table filtrable par statut, KPI (en attente, acceptés, convertis, taux d'acceptation).
- Page détail `/admin/devis/:id` : aperçu lignes + commissions (réutilise `computeOrderTotals`), historique (créé, envoyé, vu, accepté/refusé, converti), bouton "Convertir en commande" si `status=accepted`.

### 6. Page publique (`/devis/:token`)
- Anonyme (noindex), responsive, sans header/footer marketplace.
- Affiche : entête MediKong + coordonnées vendeur (selon visibility rules), lignes, totaux HTVA/TTC, validité, conditions.
- Boutons : "Télécharger le PDF" (URL signée), "Accepter le devis", "Refuser" (avec raison optionnelle).
- Après acceptation : affiche confirmation + prochaines étapes (admin sera notifié pour conversion + paiement).

### 7. Stripe (différé — hors scope V1)
- Le devis accepté **ne déclenche pas automatiquement** un paiement Stripe : l'admin convertit manuellement en commande, puis la commande suit le workflow Stripe existant.
- Pas de PaymentIntent depuis le lien public dans cette version (à ré-évaluer plus tard).

### 8. Sécurité & audit
- Tokens : `gen_random_bytes(24)` base64url, uniques, non devinables.
- Logs `security_audit_logs` (event `quote_viewed`, `quote_accepted`, `quote_declined`).
- RLS : `quotes` admin only + lecture publique via RPC token uniquement (pas de SELECT direct anon).

### 9. Tests manuels
- Créer un devis depuis l'admin → vérifier PDF + lien.
- Ouvrir le lien en navigation privée → accepter → vérifier `accepted_at` + notification admin.
- Convertir → vérifier que la commande créée reprend bien lignes, commissions, vendeurs.

### 10. Documentation
- Ajouter une mémoire `mem://features/quotes-module` résumant l'architecture.

---

## Détails techniques

- **PDF** : skill `pdf` + reportlab côté edge function n'est pas dispo en Deno → utiliser `@react-pdf/renderer` ou template HTML + `puppeteer-core`? **Décision** : template HTML + service externe `https://pdfshift.io` est exclu (pas de secret tiers). On utilise **`@react-pdf/renderer` via esm.sh** dans l'edge function (déjà utilisé pour les factures Restock).
- **Numérotation devis** : `Q-YYYY-NNNNN` séquentiel via une table `quote_sequences (year int pk, last_number int)`.
- **Mapping payload** : on réutilise la structure `draft_payload` existante (lignes vendor/manual) pour minimiser la divergence avec les bons de commande.
- **Multi-pays / TVA** : reprend `resolve_product_vat_rate` + `computeOrderTotals` existants.
- **Edge function `generate-quote-pdf`** : `verify_jwt = true` (admin only), CORS standard.

## Hors scope V1 (à valider plus tard)
- Signature électronique
- Paiement direct depuis le lien public
- Relances automatiques (J+3, J+7)
- Devis multi-vendeurs avec acceptation partielle

## Estimation
~10 étapes, à dérouler sur plusieurs itérations. Je commence par l'étape 1 (audit + migration DB) dès validation.
