---
name: CERP pack suffix convention
description: CERP encode le pack soit en suffixe "/N" soit en nombre nu en fin de libellé (ex "FRESUBIN ... PECHE 4") — reconnu par extractPackSizeFromName
type: feature
---

CERP (et certains imports grossistes) encodent le conditionnement de **deux façons** en fin de libellé brut :

1. **Suffixe `/N`** : `"FRESUBIN 2 KCAL CAPPUCCINO /4"` → 4
2. **Nombre nu en fin de libellé** : `"FRESUBIN 2 KCAL FIBRE PECHE 4"` → 4

`extractPackSizeFromName` (src/lib/pack-size.ts) gère les deux patterns en **priorité 0** (avant les regex `4x200ml`, gélules, "pack de N") :

- **Règle 0 (slash)** : `/(?:^|\s)\/\s*(\d{1,3})\b\s*$/` — exige séparateur avant `/` et fin de chaîne pour éviter fractions/dates `12/04`.
- **Règle 0 bis (nombre nu)** : `/(?:^|\s)([A-Za-zÀ-ÿ./]+)\s+(\d{1,3})\s*$/` avec garde-fous :
  - le token précédent ne doit pas être une unité (mg, ml, g, kg, cl, l, kcal, cc, oz, mcg, µg, ui, iu, mm, cm, m, %)
  - bornes strictes 2..50 (pack vendeur réaliste, évite dosages/années)

Sans ces patterns, l'écart MK CERP était calculé sur le prix pack divisé par 1 → écart négatif faux. Exemple Fresubin 2 KCAL Fibre Pêche : -56 % affiché au lieu de +61 % (équivalent Febelco qui livre exactement le même pack 4×200 ml).
