-- RPC admin pour approuver/rejeter un override de commission au niveau OFFRE
CREATE OR REPLACE FUNCTION public.admin_review_offer_commission(
  _offer_id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
RETURNS public.offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.offers;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  UPDATE public.offers
     SET commission_override_status = CASE
           WHEN _decision = 'approve' THEN 'approved'::commission_override_status
           ELSE 'rejected'::commission_override_status
         END,
         commission_override_reason = CASE
           WHEN _decision = 'reject' THEN COALESCE(_reason, commission_override_reason)
           ELSE commission_override_reason
         END
   WHERE id = _offer_id
   RETURNING * INTO row_out;

  IF NOT FOUND THEN RAISE EXCEPTION 'offer not found'; END IF;
  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_offer_commission(uuid, text, text) TO authenticated;