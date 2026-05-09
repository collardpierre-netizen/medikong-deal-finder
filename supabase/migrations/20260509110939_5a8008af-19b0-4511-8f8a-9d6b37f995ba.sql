
-- History of admin actions on category anomalies
CREATE TABLE IF NOT EXISTS public.product_category_anomaly_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id uuid NOT NULL REFERENCES public.product_category_anomalies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('detected','apply_suggestion','reassign','dismiss','reopen','note')),
  from_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  to_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  note text,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcaa_anomaly ON public.product_category_anomaly_actions(anomaly_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcaa_product ON public.product_category_anomaly_actions(product_id, performed_at DESC);

ALTER TABLE public.product_category_anomaly_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_pcaa" ON public.product_category_anomaly_actions;
CREATE POLICY "admins_select_pcaa" ON public.product_category_anomaly_actions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Wrap dismiss to log the action
CREATE OR REPLACE FUNCTION public.dismiss_product_category_anomaly(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anom record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  SELECT * INTO v_anom FROM product_category_anomalies WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anomalie introuvable';
  END IF;
  UPDATE product_category_anomalies
    SET status = 'dismissed', dismissed_by = auth.uid(), dismiss_note = _note, resolved_at = now()
    WHERE id = _id;
  INSERT INTO product_category_anomaly_actions
    (anomaly_id, product_id, action, from_category_id, to_category_id, note, performed_by)
  VALUES
    (_id, v_anom.product_id, 'dismiss', v_anom.current_category_id, NULL, _note, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_product_category_anomaly(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_product_category_anomaly(uuid, text) TO authenticated;

-- Wrap apply_suggestion to log
CREATE OR REPLACE FUNCTION public.apply_product_category_anomaly_suggestion(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anom record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  SELECT * INTO v_anom FROM product_category_anomalies WHERE id = _id;
  IF NOT FOUND OR v_anom.suggested_category_id IS NULL THEN
    RAISE EXCEPTION 'Anomalie introuvable ou sans suggestion';
  END IF;
  UPDATE products
    SET primary_category_id = v_anom.suggested_category_id, manual_mapping_validated = true
    WHERE id = v_anom.product_id;
  INSERT INTO product_category_anomaly_actions
    (anomaly_id, product_id, action, from_category_id, to_category_id, note, performed_by)
  VALUES
    (_id, v_anom.product_id, 'apply_suggestion', v_anom.current_category_id, v_anom.suggested_category_id, NULL, auth.uid());
  UPDATE product_category_anomalies
    SET status = 'resolved', resolved_at = now()
    WHERE product_id = v_anom.product_id AND status = 'open';
END;
$$;

REVOKE ALL ON FUNCTION public.apply_product_category_anomaly_suggestion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_product_category_anomaly_suggestion(uuid) TO authenticated;

-- Helper: admin client logs a manual reassign performed via admin_apply_product_mapping
CREATE OR REPLACE FUNCTION public.log_product_category_anomaly_action(
  _anomaly_id uuid,
  _action text,
  _to_category_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anom record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  IF _action NOT IN ('reassign','reopen','note') THEN
    RAISE EXCEPTION 'Action non supportée: %', _action;
  END IF;
  SELECT * INTO v_anom FROM product_category_anomalies WHERE id = _anomaly_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anomalie introuvable';
  END IF;
  INSERT INTO product_category_anomaly_actions
    (anomaly_id, product_id, action, from_category_id, to_category_id, note, performed_by)
  VALUES
    (_anomaly_id, v_anom.product_id, _action, v_anom.current_category_id, _to_category_id, _note, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.log_product_category_anomaly_action(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_product_category_anomaly_action(uuid, text, uuid, text) TO authenticated;
