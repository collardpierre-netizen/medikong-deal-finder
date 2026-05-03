ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS vendor_note text;

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_vendor_note_length_chk;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_vendor_note_length_chk
  CHECK (vendor_note IS NULL OR length(vendor_note) <= 500);

COMMENT ON COLUMN public.offers.vendor_note IS
  'Note libre du vendeur affichée à l''acheteur en tooltip (ex: "Packaging FR + arabe sur une face"). Max 500 caractères.';