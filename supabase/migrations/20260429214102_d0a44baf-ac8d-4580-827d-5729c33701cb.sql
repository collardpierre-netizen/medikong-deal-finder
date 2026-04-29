
CREATE TABLE IF NOT EXISTS public.user_price_watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  watch_id uuid,
  action text NOT NULL CHECK (action IN ('created','updated','deleted')),
  price_excl_vat numeric,
  previous_price_excl_vat numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uphw_user_product ON public.user_price_watch_history(user_id, product_id, created_at DESC);

ALTER TABLE public.user_price_watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own price watch history" ON public.user_price_watch_history;
CREATE POLICY "Users read own price watch history"
  ON public.user_price_watch_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Pas de policy INSERT/UPDATE/DELETE : seules les fonctions SECURITY DEFINER (trigger) écrivent.

CREATE OR REPLACE FUNCTION public.log_user_price_watch_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_price_watch_history(user_id, product_id, watch_id, action, price_excl_vat, notes)
    VALUES (NEW.user_id, NEW.product_id, NEW.id, 'created', NEW.user_price_excl_vat, NEW.notes);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.user_price_excl_vat IS DISTINCT FROM OLD.user_price_excl_vat
       OR COALESCE(NEW.notes,'') IS DISTINCT FROM COALESCE(OLD.notes,'') THEN
      INSERT INTO public.user_price_watch_history(user_id, product_id, watch_id, action, price_excl_vat, previous_price_excl_vat, notes)
      VALUES (NEW.user_id, NEW.product_id, NEW.id, 'updated', NEW.user_price_excl_vat, OLD.user_price_excl_vat, NEW.notes);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.user_price_watch_history(user_id, product_id, watch_id, action, previous_price_excl_vat, notes)
    VALUES (OLD.user_id, OLD.product_id, OLD.id, 'deleted', OLD.user_price_excl_vat, OLD.notes);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_price_watch_change ON public.user_price_watches;
CREATE TRIGGER trg_log_user_price_watch_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_price_watches
FOR EACH ROW EXECUTE FUNCTION public.log_user_price_watch_change();
