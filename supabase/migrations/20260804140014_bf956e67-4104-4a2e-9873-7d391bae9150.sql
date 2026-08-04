ALTER TABLE public.savings_simulations
  ADD COLUMN IF NOT EXISTS commercial_status text NOT NULL DEFAULT 'to_contact';

DO $$ BEGIN
  ALTER TABLE public.savings_simulations
    ADD CONSTRAINT savings_simulations_commercial_status_check
    CHECK (commercial_status IN ('to_contact','contacted','converted','lost'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le pharmacien connecté retrouve ses analyses faites avec son email (sans compte à l'époque)
DROP POLICY IF EXISTS "Owners read own savings_simulations by email" ON public.savings_simulations;
CREATE POLICY "Owners read own savings_simulations by email"
ON public.savings_simulations
FOR SELECT
TO authenticated
USING (
  email IS NOT NULL
  AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);

CREATE OR REPLACE FUNCTION public.admin_savings_by_pharmacy()
RETURNS TABLE (
  group_key text,
  pharmacy_name text,
  emails text[],
  analyses_count bigint,
  total_savings numeric,
  last_analysis_at timestamptz,
  commercial_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(nullif(btrim(s.pharmacy_name), ''), lower(coalesce(s.email, 'inconnu'))) AS group_key,
    max(coalesce(nullif(btrim(s.pharmacy_name), ''), '')) AS pharmacy_name,
    array_agg(DISTINCT s.email) FILTER (WHERE s.email IS NOT NULL) AS emails,
    count(*) AS analyses_count,
    coalesce(sum(s.savings_amount), 0) AS total_savings,
    max(s.created_at) AS last_analysis_at,
    (array_agg(s.commercial_status ORDER BY s.created_at DESC))[1] AS commercial_status
  FROM public.savings_simulations s
  WHERE public.is_admin(auth.uid())
  GROUP BY 1
  ORDER BY max(s.created_at) DESC
$$;

REVOKE ALL ON FUNCTION public.admin_savings_by_pharmacy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_savings_by_pharmacy() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_savings_commercial_status(_group_key text, _status text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('to_contact','contacted','converted','lost') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.savings_simulations s
  SET commercial_status = _status, updated_at = now()
  WHERE coalesce(nullif(btrim(s.pharmacy_name), ''), lower(coalesce(s.email, 'inconnu'))) = _group_key;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_savings_commercial_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_savings_commercial_status(text, text) TO authenticated;