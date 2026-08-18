ALTER TABLE public.flash_deals
  ADD COLUMN IF NOT EXISTS vendor_display_mode text NOT NULL DEFAULT 'inherit';

ALTER TABLE public.flash_deals
  DROP CONSTRAINT IF EXISTS flash_deals_vendor_display_mode_check;

ALTER TABLE public.flash_deals
  ADD CONSTRAINT flash_deals_vendor_display_mode_check
  CHECK (vendor_display_mode IN ('inherit', 'anonymous', 'real'));

COMMENT ON COLUMN public.flash_deals.vendor_display_mode IS
  'Affichage du vendeur sur la vente flash publique : inherit = suit la fiche vendeur / vendor_visibility_rules, anonymous = force "Fournisseur <code>", real = force le nom réel.';