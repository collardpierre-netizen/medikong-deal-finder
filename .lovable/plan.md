# Option A — Write-through cache pour les traductions live

## Diagnostic préalable (important)

En lisant le code, j'ai constaté deux choses qui changent la priorité :

1. **`useAutoTranslate` appelle une edge function `translate` qui n'existe pas** dans `supabase/functions/` (il y a `auto-translate` et `batch-translate-products` mais pas `translate`). Donc actuellement, le fallback live **échoue silencieusement** et retourne le texte original — il n'y a en réalité **pas encore de coûts AI du switch de langue**, mais aussi pas de traduction visible.

2. **`useAutoTranslate`/`TranslationBadge` ne sont en fait branchés nulle part** dans des pages produits (uniquement définis et auto-référencés). Les traductions visibles passent toutes par `getLocalizedName` / `getLocalizedDescription` qui lisent les colonnes `*_en` en base.

Donc l'option A doit faire deux choses : (a) **réparer** le fallback en pointant vers la vraie edge function, et (b) ajouter le **write-through cache** pour qu'un texte traduit ne soit payé qu'une seule fois, jamais re-payé même par un autre utilisateur.

## Ce qu'on construit

### 1. Nouvelle edge function `translate-and-cache`
Remplace l'appel cassé vers `translate`. Signature simple :
- Input : `{ texts: string[], targetLang, sourceLang, productId?, field? }`
- Étape 1 : si `productId` + `field` fournis → vérifier en DB que la colonne (`name_en`, `short_description_en`, `description_en`, etc.) est toujours `NULL`. Si déjà remplie → renvoyer la valeur DB, **zéro appel AI**.
- Étape 2 : sinon, appeler Lovable AI Gateway (`google/gemini-2.5-flash-lite`).
- Étape 3 : **écrire la traduction dans la colonne correspondante** du produit (write-through).
- Étape 4 : retourner la traduction au client.

Bénéfices :
- Payé 1 fois par produit × langue, jamais re-payé.
- Visible immédiatement par tous les autres utilisateurs (aussi les anonymes via `getLocalizedName`).
- Bon pour le SEO (la traduction finit par être servie en HTML directement).
- Gère 429/402 et les renvoie proprement au client.

### 2. Nouvelle table `translation_cache` (pour les textes hors produits)
Pour les textes qui ne viennent pas d'une colonne `products` (ex. nom de catégorie côté breadcrumb si pas encore traduit, label dynamique d'une marque, etc.) :
```
translation_cache (
  source_hash text PK,        -- sha256(sourceLang:targetLang:text)
  source_lang text,
  target_lang text,
  source_text text,
  translated_text text,
  hits int default 1,
  created_at timestamptz,
  last_used_at timestamptz
)
```
RLS : lecture publique (anon+authenticated), écriture service-role uniquement (via l'edge function).
Garantit que **deux utilisateurs différents ne paient jamais 2× la même traduction**, même hors catalogue.

### 3. Refactor `useAutoTranslate`
- Pointe vers `translate-and-cache` (au lieu de `translate` qui n'existe pas).
- Accepte un paramètre optionnel `{ productId, field }` pour activer le write-through colonne produit.
- Garde le cache mémoire navigateur pour éviter les allers-retours dans la même session.
- Surface les erreurs 429/402 via toast (aujourd'hui silencieux).

### 4. Mini compteur admin (bonus, 5 min)
Dans `/admin/i18n-pilot`, ajouter une petite ligne :
- Nombre de traductions live générées aujourd'hui (count sur `translation_cache.created_at`)
- Top 10 textes les plus demandés (`hits desc`)
→ permet de voir si tu dois lancer le batch complet pour des produits spécifiques.

## Ce qu'on ne fait PAS dans cette étape

- Pas de désactivation du fallback (tu peux toujours afficher de l'EN pour des produits non encore traduits).
- Pas de batch complet du catalogue (c'est l'option B, à faire ensuite).
- Pas de modification des composants existants — on répare juste la mécanique sous-jacente.

## Détails techniques

**Migration SQL :**
- Création de `public.translation_cache` + index sur `(target_lang, last_used_at desc)` + RLS.

**Edge function `translate-and-cache/index.ts` :**
- CORS standard + JWT verify off (lecture publique).
- Logique : product write-through prioritaire → cache lookup → AI call → cache write + product write si possible.
- Retourne `{ translations: string[], fromCache: boolean[], cost: { aiCalls: number } }` pour transparence.

**Hook `src/hooks/useAutoTranslate.ts` :**
- Renommer l'appel `supabase.functions.invoke("translate", …)` → `"translate-and-cache"`.
- Ajouter signature étendue : `useAutoTranslate(text, opts?: { productId?, field? })`.
- Toast d'erreur sur 402/429.

**Aucun changement** sur `getLocalizedName` / `getLocalizedDescription` (déjà parfait).

## Risques

- **Aucun coût supplémentaire** : la fonction `translate` n'existe pas, donc on ne casse rien qui marchait.
- **Sécurité écriture DB** : seul le service-role écrit, depuis l'edge function, après vérif `productId` valide → pas d'injection.
- **Volume table cache** : on garde un index sur `last_used_at` pour pouvoir purger les entrées non utilisées >180j si besoin (à voir plus tard).

## Après ça

Une fois A en prod, je recommande d'enchaîner B (batch complet) pour atteindre 100% de couverture EN en DB, puis de désactiver complètement le fallback live → coût AI traduction = 0 €/mois sur le switch.
