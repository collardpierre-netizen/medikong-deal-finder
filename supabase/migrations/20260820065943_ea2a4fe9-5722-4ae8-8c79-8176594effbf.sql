ALTER TABLE public.restock_buyers
  ADD COLUMN IF NOT EXISTS restock_moq_min integer;

INSERT INTO public.restock_settings (key, label, description, value)
VALUES ('moq_min', 'MOQ minimum (unités)', 'Quantité minimum de commande imposée aux offres partielles (0 = désactivé)', '0')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.restock_global_moq_min()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(regexp_replace(COALESCE((SELECT value FROM public.restock_settings WHERE key = 'moq_min'), '0'), '[^0-9]', '', 'g'), '')::integer, 0)
$$;

CREATE OR REPLACE FUNCTION public.restock_resolve_moq_min(_seller_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller integer;
  v_global integer := public.restock_global_moq_min();
BEGIN
  IF _seller_id IS NOT NULL THEN
    SELECT restock_moq_min INTO v_seller FROM public.restock_buyers WHERE id = _seller_id;
  END IF;

  IF v_seller IS NOT NULL THEN
    RETURN jsonb_build_object('moq_min', GREATEST(v_seller, 0), 'source', 'seller');
  END IF;

  RETURN jsonb_build_object('moq_min', GREATEST(COALESCE(v_global, 0), 0), 'source', 'global');
END;
$$;

GRANT EXECUTE ON FUNCTION public.restock_global_moq_min() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restock_resolve_moq_min(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.restock_enforce_moq_min()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min integer;
BEGIN
  IF COALESCE(NEW.allow_partial, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_min := COALESCE((public.restock_resolve_moq_min(NEW.seller_id) ->> 'moq_min')::integer, 0);

  IF v_min > 0 AND COALESCE(NEW.moq, 1) < v_min THEN
    RAISE EXCEPTION 'RESTOCK_MOQ_MIN_NOT_REACHED: minimum de commande requis = % unités (reçu %)', v_min, COALESCE(NEW.moq, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restock_enforce_moq_min ON public.restock_offers;
CREATE TRIGGER trg_restock_enforce_moq_min
  BEFORE INSERT OR UPDATE OF moq, allow_partial, seller_id ON public.restock_offers
  FOR EACH ROW EXECUTE FUNCTION public.restock_enforce_moq_min();