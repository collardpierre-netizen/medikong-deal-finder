# Plusieurs EAN et parcours « Code non reconnu »

## Diagnostic confirmé

- `4051895042664` et `4051895042657` ne correspondent actuellement à aucun `products.gtin`, aucun `product_market_codes.code_value` et aucun CNK.
- `product_market_codes` contient 0 ligne.
- La fiche correspondante est **Fresubin THICKENED Level 3 – 200 ml – Vanille** : CNK `4181459`, GTIN actuel `4051895015576`, pack de 4, active.
- Elle possède une offre active à **10,80 € HTVA le pack**, soit **2,70 € HTVA par bouteille**.
- Le GTIN `4051895042664` correspond au pack de 4 × 200 ml ; `4051895042657` est le code de la bouteille unitaire fourni par le test réel.

## Migration proposée — à approuver avant application

### 1. Étendre `product_market_codes`

Ajouter :

- `packaging_level text not null default 'unit'` avec valeurs autorisées `unit`, `pack`, `carton` ;
- `units_per_pack integer not null default 1` avec contrôle strictement positif ;
- une contrainte d’unicité sur `code_value` normalisé, afin qu’un EAN ne puisse désigner qu’une seule fiche ;
- remplacer la contrainte actuelle `(product_id, market_code_type_id)`, qui interdit plusieurs EAN du même type par produit, par `(product_id, market_code_type_id, code_value)`.

Les droits et règles d’accès existants restent inchangés : lecture catalogue, écriture admin uniquement.

### 2. Enregistrer les codes Fresubin

Pour la fiche CNK `4181459` :

| EAN | Niveau | Unités par pack | État |
|---|---|---:|---|
| `4051895042664` | pack | 4 | vérifié |
| `4051895042657` | unité | 1 | vérifié |

Le GTIN actuel `4051895015576` reste sur la fiche ; il n’est ni remplacé ni supprimé.

### 3. Adapter `product_gtin_proposals`

Conserver la table existante et lui ajouter les éléments nécessaires au Scan :

- `scan_event_id` facultatif ;
- `proposed_by` facultatif ;
- `packaging_level` et `units_per_pack` proposés ;
- `matched_cnk` devient facultatif pour une proposition issue d’un EAN inconnu ;
- la source de proposition distingue import et Scan.

L’accès reste strictement admin pour la lecture et la validation. Le pharmacien ne voit jamais la liste des propositions.

À l’approbation admin, l’EAN sera ajouté à `product_market_codes` avec son conditionnement ; `products.gtin` ne sera plus écrasé.

## Comportement Scan en preview

### Code reconnu

- Chercher d’abord dans `products.gtin`, puis dans `product_market_codes`, puis par CNK.
- Retourner le niveau d’emballage scanné et le nombre d’unités.
- Lorsque l’offre est au pack, afficher : **« Vendu par pack de 4 »** et **« 2,70 € HTVA par bouteille »** sous le prix de 10,80 € HTVA.
- Le prix et l’ajout au panier restent basés sur le conditionnement réellement vendu par l’offre, jamais sur le code unitaire seul.

### Code non reconnu

- Remplacer l’écran actuel par **« Code non reconnu — cherchez le produit »**.
- Recherche catalogue par nom, marque ou CNK, limitée aux produits actifs.
- Après sélection d’une fiche : résoudre et afficher immédiatement son offre, puis créer une proposition EAN → fiche en attente de validation admin.
- La sélection ne modifie pas immédiatement le catalogue et ne rend pas l’EAN officiellement reconnu avant validation.
- Si aucune fiche ne convient, conserver la demande de sourcing actuelle.

### Admin

- Compléter l’écran EAN existant avec les propositions issues du Scan : EAN, fiche choisie, CNK, officine, date, conditionnement proposé.
- Actions : approuver ou rejeter.
- L’approbation écrit dans `product_market_codes`; le rejet ne modifie aucune fiche.

## Vérifications prévues

1. Scanner les deux EAN Fresubin : même fiche et même offre.
2. Scanner le pack : « Vendu par pack de 4 » et 2,70 € HTVA/bouteille.
3. Scanner l’unité : même information de vente au pack, sans ajouter une bouteille isolée au panier.
4. Scanner un EAN inconnu, chercher par nom/marque/CNK, sélectionner une fiche : offre immédiate et proposition admin en attente.
5. Choisir « aucune fiche » : demande de sourcing inchangée.
6. Vérifier qu’un non-admin ne peut ni lire ni valider les propositions.
7. Tester l’écran Scan au format iPhone en preview et fournir les captures demandées.

## Hors périmètre

- Aucune publication.
- Aucun changement des trois alertes RLS définitivement ignorées.
- Aucun changement de prix, d’offre ou de fiche produit autre que les deux associations EAN validées ci-dessus.
