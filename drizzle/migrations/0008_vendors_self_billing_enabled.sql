ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS self_billing_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vendors.self_billing_enabled IS
  'Active la facturation « au nom et pour le compte de » ce fournisseur (virement encaissé par MediKong). Exige mandate_signed_at.';