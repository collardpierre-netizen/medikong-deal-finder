CREATE OR REPLACE FUNCTION public._guard_restock_offers_seller_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public._is_admin_or_service() THEN
    RETURN NEW;
  END IF;

  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Not allowed to modify moderation fields on a ReStock offer' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('draft','published','sold','counter_offer','expired')
  THEN
    RAISE EXCEPTION 'Not allowed to set this moderation status' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_restock_offers_seller_status ON public.restock_offers;
CREATE TRIGGER trg_guard_restock_offers_seller_status
BEFORE UPDATE ON public.restock_offers
FOR EACH ROW EXECUTE FUNCTION public._guard_restock_offers_seller_status();