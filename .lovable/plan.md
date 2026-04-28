# Pourquoi certaines parties ne sont pas traduites

## Diagnostic

En inspectant `HomePage.tsx` et `HeroImageGallery.tsx`, j'ai trouvé **3 catégories distinctes** de zones non traduites — chacune avec une cause différente :

### 1. Le H1 du hero — texte codé en dur dans le JSX
Lignes 235-240 de `HomePage.tsx` :
```tsx
<span>Tout le médical</span>, tous les prix,
<br />un seul endroit
```
Ce texte n'utilise PAS `t()` → i18next ne le voit jamais → aucune traduction possible (ni statique, ni live).
La clé `hero.title` existe pourtant déjà dans les 4 fichiers de locale, elle n'est juste pas utilisée. Bug pur.

### 2. Le label "Marques" dans les stats hero (ligne 290)
Codé en dur : `<div>Marques</div>` au lieu de `{t("stats.brands")}`. Idem : la clé existe dans les locales mais n'est pas appelée.

### 3. Le slider (HeroImageGallery) — contenu CMS dynamique
Le slider affiche `currentImage.title` et `currentImage.subtitle` qui viennent de la **base de données** (table `cms_hero_images`). Ces strings ne sont pas dans les fichiers JSON i18next, et le composant n'utilise pas `useAutoTranslate` → reste en français.
Cas spécial : les fallbacks (lignes 70-71) `"MediKong.pro"` et `"Le marketplace médical de référence en Belgique"` sont aussi en dur.

## Récapitulatif

| Zone | Type | Cause | Solution |
|---|---|---|---|
| H1 hero "Tout le médical…" | UI statique | `t()` oublié | Remplacer par `t("hero.title")` |
| Label "Marques" stats | UI statique | `t()` oublié | Remplacer par `t("stats.brands")` |
| Slider title/subtitle/cta | Contenu CMS (DB) | Pas de traduction | Brancher `useAutoTranslate` (cache write-through, gratuit après 1er affichage) |
| Slider fallbacks "MediKong.pro" / "Le marketplace…" | UI statique | `t()` oublié | Ajouter clés + `t()` |

## Modifications proposées

### `src/pages/HomePage.tsx`
- Lignes 234-240 : remplacer le H1 hardcodé par `{t("hero.title")}` (avec gestion du `<br/>` et du soulignement via Trans component ou split sur `\n`).
- Ligne 290 : remplacer `Marques` par `{t("stats.brands", "Marques")}`.

### `src/components/home/HeroImageGallery.tsx`
- Importer `useAutoTranslate` et `useTranslation`.
- Pour `currentImage.title`, `currentImage.subtitle`, `currentImage.cta_text` : passer chacun dans `useAutoTranslate(text)` → traduction automatique mise en cache global (`translation_cache`) dès la 1re vue. Coût AI : 1× par slide × langue, ensuite gratuit pour tous.
- Remplacer les 2 fallbacks hardcodés par des clés i18n (`hero.slideFallbackTitle`, `hero.slideFallbackSubtitle`).

### `src/i18n/locales/{fr,nl,en,de}.json`
- Ajouter `stats.brands` ("Marques" / "Merken" / "Brands" / "Marken").
- Ajouter `hero.slideFallbackTitle` et `hero.slideFallbackSubtitle` dans les 4 langues.
- Vérifier que `hero.title` est bien rendu correctement avec le saut de ligne (déjà présent en FR avec `\n`).

## Note sur les coûts AI

Les éléments du slider (#3) déclencheront 1 appel AI par slide × langue cible la 1re fois — puis tout est servi depuis le cache write-through (`translation_cache` table) sans recoût. Pour 4 slides × 3 langues non-FR = max ~12 appels AI une seule fois. Négligeable.

Veux-tu que je procède ?
