CREATE OR REPLACE FUNCTION public.guard_brand_reviews_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service_role bypass
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Preserve server-computed / trust-signal columns from client tampering
  NEW.verified_buyer_orders_count := COALESCE(OLD.verified_buyer_orders_count, 0);
  NEW.is_published := OLD.is_published;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_brand_reviews_privileged_columns ON public.brand_reviews;
CREATE TRIGGER trg_guard_brand_reviews_privileged_columns
BEFORE UPDATE ON public.brand_reviews
FOR EACH ROW
EXECUTE FUNCTION public.guard_brand_reviews_privileged_columns();