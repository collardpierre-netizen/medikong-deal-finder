# MOV global administrable (fallback ultime)

## Objectif

Ajouter un **MOV global** configurable depuis l'admin qui sert de **fallback ultime** quand aucune règle vendeur n'est définie. Le MOV vendeur (encodé via son CMS dans `offers.mov` ou ses défauts profil) reste **prioritaire** sur ce global.

## Cascade MOV finale (vrais vendeurs)

```
1. vendor_buyer_overrides          (négocié 1↔1)
2. vendor_profile_defaults         (défauts par profil acheteur)
3. offers.mov                      (MOV de l'offre, vendeur)   ← parent
4. site_config.global_default_mov  (NOUVEAU — admin)           ← fallback
5. 0 (= pas de MOV)                si admin laisse vide
```

Pour les **vendeurs virtuels (Qogita / Balooh)** : le plancher hardcodé 500 € reste inchangé et continue de s'appliquer **par-dessus** la cascade ci-dessus (max entre cascade et 500 €). Pas touché.

## Changements

### 1. DB (1 migration)
- Ajouter une clé `global_default_mov_cents` (INTEGER, nullable, en cents) dans la table `site_config` existante (ou `admin_settings` selon laquelle héberge déjà ce type de réglage — à confirmer en lisant la table avant migration). Default `NULL` = pas de fallback (comportement actuel).
- Aucun nouveau GRANT/RLS : on réutilise la table existante.

### 2. Logique serveur — `supabase/functions/_shared/validate-cart.ts`
Étendre `resolveMovForVendor()` :
- Après avoir lu `vendor_buyer_overrides` → `vendor_profile_defaults` → `offers.mov`, si la valeur reste `0 / null` ET vendeur **non virtuel**, lire `site_config.global_default_mov_cents` et l'utiliser.
- L'ordre relatif est strictement : règles vendeur > global. Si le vendeur a un `offers.mov` > 0, le global est ignoré.
- Pour les vendeurs virtuels : la cascade reste identique mais le `max(cascade, 500€)` final s'applique toujours.

Le helper est déjà consommé par `validate-cart` ET `stripe-checkout` → un seul point de modification.

### 3. Admin UI
- Une seule entrée dans la page admin qui édite `site_config` (`/admin/...` — à localiser : probablement `AdminSettings` ou équivalent).
- Champ "MOV global de repli (EUR HTVA)" + helper text expliquant la cascade et le fait qu'il est ignoré si le vendeur a son propre MOV.
- Vide = pas de fallback.

### 4. Tests
Étendre `validate-cart.mov.test.ts` et `integration.test.ts` :
- vendeur sans aucune règle + global=20€ → MOV=20€
- vendeur avec `offers.mov=15€` + global=20€ → MOV=15€ (vendeur gagne)
- vendeur virtuel sans règle + global=20€ → MOV=500€ (floor gagne)
- global=NULL + vendeur sans règle → MOV=0 (comportement actuel)

## Hors scope (à ne PAS faire sans validation)
- Pas de changement sur le plancher 500 € virtuels.
- Pas de refonte de l'UI vendeur du MOV.
- Pas d'ajout d'un MOV global par pays/devise/profil (1 seul scalaire global).
- Pas de migration des MOV vendeurs existants.

## Validation attendue avant exécution
1. OK pour héberger le réglage dans `site_config` (sinon préciser la table).
2. OK pour un scalaire unique global (pas de granularité pays/profil).
3. Page admin cible : `/admin/parametres` ou autre — préciser si tu as une préférence, sinon je l'ajoute dans l'écran réglages site existant.
