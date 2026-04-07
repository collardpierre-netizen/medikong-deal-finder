
## Plan : Gestion centralisée des commandes Qogita

### État actuel
- `order_lines` existe déjà avec `fulfillment_type` (enum: `qogita`, `medikong_direct`, `vendor_direct`), `fulfillment_status` (enum: `pending`, `processing`, `shipped`, `delivered`, `cancelled`), `vendor_id`, `qogita_*` fields
- `order_items` est utilisé à la création de commande mais sans `vendor_id` ni routage
- Balooh existe (id: `b3aa8188-...`, type: `real`, **is_active: false**)
- VendorOrders est une page vide (placeholder)

### Étape 1 — Migration DB
- Ajouter `forwarded` à l'enum `fulfillment_status`
- Activer le vendeur Balooh (`is_active = true`)

### Étape 2 — Logique de routage (useOrders.ts)
- Après création des `order_items`, créer des `order_lines` :
  - Pour chaque item, récupérer le `vendor_id` et le `type` du vendeur via l'offre
  - Si vendeur `qogita_virtual` → assigner `vendor_id` = Balooh, `fulfillment_type` = `qogita`
  - Si vendeur `real` → garder le `vendor_id` d'origine, `fulfillment_type` = `vendor_direct`
  - Copier les champs `qogita_offer_qid`, `qogita_seller_fid`, `qogita_base_price`

### Étape 3 — Portail vendeur : page Commandes
- Construire VendorOrders pour afficher les `order_lines` du vendeur connecté
- Joindre les infos produit, commande, adresse de livraison
- Pour les lignes `fulfillment_type = 'qogita'` : afficher les champs Qogita (seller_fid, offer_qid, base_price) — visible uniquement pour Balooh et admin
- Bouton "Transmis à Qogita" qui passe `fulfillment_status` à `forwarded`

### Étape 4 — Admin
- Le détail de commande admin montre déjà les order_items avec refs Qogita → rien à changer

### Fichiers modifiés
- `src/hooks/useOrders.ts` — routage order_lines
- `src/pages/vendor/VendorOrders.tsx` — interface commandes vendeur
- Migration DB pour enum + activation Balooh
