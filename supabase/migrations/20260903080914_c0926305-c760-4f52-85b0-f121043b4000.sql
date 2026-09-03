CREATE OR REPLACE FUNCTION public._guard_offers_commission_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;
  IF NEW.commission_model IS DISTINCT FROM OLD.commission_model
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.margin_split_pct IS DISTINCT FROM OLD.margin_split_pct
     OR NEW.fixed_commission_amount IS DISTINCT FROM OLD.fixed_commission_amount
     OR NEW.applied_margin_percentage IS DISTINCT FROM OLD.applied_margin_percentage
     OR NEW.purchase_price IS DISTINCT FROM OLD.purchase_price
  THEN
    RAISE EXCEPTION 'Not allowed to modify commission, margin or purchase price fields on offers' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_offers_commission_cols ON public.offers;
CREATE TRIGGER trg_guard_offers_commission_cols
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public._guard_offers_commission_cols();