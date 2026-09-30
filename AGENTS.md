
- Qogita OUT sweep: offers not synced for 60 days are deactivated daily (qogita_sweep_stale_offers), then Qogita sellers with no active offer (qogita_sweep_empty_vendors, marked qogita_auto_deactivated_at); the offers trigger reactivates them. Why: keep the database aligned with Qogita, reversibly.
- Prix marché côté non-admin : toujours via la fonction serveur get_market_prices_for_products (noms masqués « Grossiste A/B ») ; lecture directe de la table réservée à l'admin. Why: ne jamais exposer l'identité des grossistes aux vendeurs.
- Création de comptes acheteurs en masse via l'edge function admin-only `bulk-create-buyers` (compte sans mot de passe + lien recovery envoyé par le modèle buyer-account-created). Why: l'acheteur choisit son mot de passe, jamais de mot de passe provisoire.
