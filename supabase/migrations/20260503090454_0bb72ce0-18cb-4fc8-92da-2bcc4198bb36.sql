ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS admin_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_hidden_reason text,
  ADD COLUMN IF NOT EXISTS admin_hidden_by uuid;

CREATE INDEX IF NOT EXISTS idx_offers_admin_hidden ON public.offers(admin_hidden) WHERE admin_hidden = true;

CREATE OR REPLACE FUNCTION public.enforce_offer_admin_hidden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.admin_hidden = true THEN
    NEW.is_active := false;
    IF NEW.admin_hidden_at IS NULL THEN
      NEW.admin_hidden_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_offer_admin_hidden ON public.offers;
CREATE TRIGGER trg_enforce_offer_admin_hidden
  BEFORE INSERT OR UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_offer_admin_hidden();