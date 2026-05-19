-- Le trigger BEFORE INSERT `trg_vendor_display_code` génère toujours un code,
-- mais sans DEFAULT SQL le générateur de types marque la colonne comme
-- obligatoire dans Insert<>, ce qui casse tous les .insert() vendeurs existants.
-- On pose un DEFAULT vide ; le trigger le remplace immédiatement.
ALTER TABLE public.vendors
  ALTER COLUMN display_code SET DEFAULT '';
