---
name: CERP pack suffix convention
description: CERP encode le pack en suffixe "/N" du libellé (ex "FRESUBIN 2 KCAL CAPPUCCINO /4") — reconnu en priorité 0 par extractPackSizeFromName
type: feature
---

CERP (et certains imports grossistes) encode le conditionnement en **suffixe `/N`** du libellé brut, ex : `"FRESUBIN 2 KCAL CAPPUCCINO /4"` = pack de 4.

`extractPackSizeFromName` (src/lib/pack-size.ts) gère ce pattern en **priorité 0** (avant les regex `4x200ml`, gélules, "pack de N") via la regex `/(?:^|\s)\/\s*(\d{1,3})\b\s*$/` qui exige un séparateur avant `/` et la fin de chaîne — pour éviter les faux positifs sur fractions ou dates `12/04`.

Sans ce pattern, l'écart MK CERP était calculé sur le prix pack divisé par 1 → écart négatif faux (ex Fresubin 2 KCAL : -53 % au lieu de +44 % vs MediKong).
