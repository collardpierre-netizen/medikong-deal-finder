
-- =========================================================================
-- 1. Table privée des points d'enlèvement vendeur
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.restock_seller_pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text DEFAULT 'BE',
  contact_name text,
  contact_phone text,
  contact_email text,
  -- jsonb format: {"mon":[{"from":"09:00","to":"12:00"}], "tue":[...], ...}
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.restock_seller_pickup_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers manage own pickup location"
  ON public.restock_seller_pickup_locations
  FOR ALL
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins manage all pickup locations"
  ON public.restock_seller_pickup_locations
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER set_restock_pickup_loc_updated
  BEFORE UPDATE ON public.restock_seller_pickup_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2. Extension restock_transactions : champs pickup + nouveaux statuts
-- =========================================================================
ALTER TABLE public.restock_transactions
  ADD COLUMN IF NOT EXISTS pickup_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_handover_code text,
  ADD COLUMN IF NOT EXISTS pickup_qr_token uuid,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS pickup_confirmation_method text,
  ADD COLUMN IF NOT EXISTS pickup_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

-- Étendre le check sur status pour inclure les nouveaux statuts pickup
ALTER TABLE public.restock_transactions DROP CONSTRAINT IF EXISTS restock_tx_status_check;
ALTER TABLE public.restock_transactions
  ADD CONSTRAINT restock_tx_status_check
  CHECK (status = ANY (ARRAY[
    'confirmed'::text,
    'awaiting_pickup'::text,
    'picked_up'::text,
    'shipped'::text,
    'delivered'::text,
    'cancelled_no_show'::text
  ]));

ALTER TABLE public.restock_transactions DROP CONSTRAINT IF EXISTS restock_tx_pickup_method_check;
ALTER TABLE public.restock_transactions
  ADD CONSTRAINT restock_tx_pickup_method_check
  CHECK (pickup_confirmation_method IS NULL OR pickup_confirmation_method = ANY (ARRAY[
    'code_by_seller'::text,
    'code_by_buyer'::text,
    'qr_scan'::text
  ]));

-- =========================================================================
-- 3. Journal d'événements pickup
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.restock_pickup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.restock_transactions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restock_pickup_events_tx ON public.restock_pickup_events(transaction_id, created_at DESC);

ALTER TABLE public.restock_pickup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer/seller/admin can read pickup events of their tx"
  ON public.restock_pickup_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restock_transactions t
      LEFT JOIN public.restock_buyers b ON b.id = t.buyer_id
      WHERE t.id = transaction_id
        AND (t.seller_id = auth.uid() OR b.auth_user_id = auth.uid())
    )
  );

-- Insertions uniquement via SECURITY DEFINER RPC (pas de policy INSERT directe).

-- =========================================================================
-- 4. Trigger : génère code + QR token quand commande pickup passe au paiement
-- =========================================================================
CREATE OR REPLACE FUNCTION public.restock_generate_pickup_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NEW.delivery_mode = 'pickup'
     AND NEW.paid_at IS NOT NULL
     AND (OLD.paid_at IS NULL OR OLD.paid_at IS DISTINCT FROM NEW.paid_at)
     AND NEW.pickup_handover_code IS NULL
  THEN
    -- Code à 6 chiffres
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    NEW.pickup_handover_code := v_code;
    NEW.pickup_qr_token := gen_random_uuid();
    NEW.pickup_deadline_at := COALESCE(NEW.paid_at, now()) + interval '10 days';
    IF NEW.status = 'confirmed' THEN
      NEW.status := 'awaiting_pickup';
    END IF;

    INSERT INTO public.restock_pickup_events (transaction_id, event_type, metadata)
    VALUES (NEW.id, 'coords_revealed', jsonb_build_object('deadline_at', NEW.pickup_deadline_at));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restock_pickup_credentials ON public.restock_transactions;
CREATE TRIGGER trg_restock_pickup_credentials
  BEFORE INSERT OR UPDATE OF paid_at ON public.restock_transactions
  FOR EACH ROW EXECUTE FUNCTION public.restock_generate_pickup_credentials();

-- =========================================================================
-- 5. RPC get_pickup_details — révèle les coordonnées à l'acheteur après paiement
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_pickup_details(_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.restock_transactions%ROWTYPE;
  v_buyer_uid uuid;
  v_loc public.restock_seller_pickup_locations%ROWTYPE;
BEGIN
  SELECT * INTO v_tx FROM public.restock_transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found';
  END IF;

  SELECT b.auth_user_id INTO v_buyer_uid FROM public.restock_buyers b WHERE b.id = v_tx.buyer_id;

  IF NOT (
    public.is_admin(auth.uid())
    OR v_tx.seller_id = auth.uid()
    OR v_buyer_uid = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tx.delivery_mode <> 'pickup' THEN
    RAISE EXCEPTION 'not_a_pickup_transaction';
  END IF;

  IF v_tx.paid_at IS NULL THEN
    RAISE EXCEPTION 'payment_required';
  END IF;

  SELECT * INTO v_loc FROM public.restock_seller_pickup_locations WHERE seller_id = v_tx.seller_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx.id,
    'status', v_tx.status,
    'paid_at', v_tx.paid_at,
    'pickup_deadline_at', v_tx.pickup_deadline_at,
    'pickup_handover_code', v_tx.pickup_handover_code,
    'pickup_qr_token', v_tx.pickup_qr_token,
    'pickup_confirmed_at', v_tx.pickup_confirmed_at,
    'address_line1', COALESCE(v_loc.address_line1, v_tx.seller_pickup_address),
    'address_line2', v_loc.address_line2,
    'postal_code', v_loc.postal_code,
    'city', COALESCE(v_loc.city, v_tx.seller_pickup_city),
    'country_code', COALESCE(v_loc.country_code, 'BE'),
    'contact_name', v_loc.contact_name,
    'contact_phone', COALESCE(v_loc.contact_phone, v_tx.seller_pickup_phone),
    'contact_email', v_loc.contact_email,
    'hours', COALESCE(v_loc.hours, '{}'::jsonb),
    'instructions', COALESCE(v_loc.instructions, v_tx.seller_pickup_instructions)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pickup_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pickup_details(uuid) TO authenticated;

-- =========================================================================
-- 6. RPC confirm_pickup — valide le retrait via code OU qr_token
-- =========================================================================
CREATE OR REPLACE FUNCTION public.confirm_pickup(
  _transaction_id uuid,
  _code text DEFAULT NULL,
  _qr_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.restock_transactions%ROWTYPE;
  v_buyer_uid uuid;
  v_recent_failures int;
  v_method text;
  v_actor uuid := auth.uid();
BEGIN
  SELECT * INTO v_tx FROM public.restock_transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  SELECT b.auth_user_id INTO v_buyer_uid FROM public.restock_buyers b WHERE b.id = v_tx.buyer_id;

  IF NOT (
    public.is_admin(v_actor)
    OR v_tx.seller_id = v_actor
    OR v_buyer_uid = v_actor
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tx.delivery_mode <> 'pickup' THEN RAISE EXCEPTION 'not_a_pickup_transaction'; END IF;
  IF v_tx.paid_at IS NULL THEN RAISE EXCEPTION 'payment_required'; END IF;
  IF v_tx.pickup_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'already_confirmed'; END IF;
  IF v_tx.status = 'cancelled_no_show' THEN RAISE EXCEPTION 'transaction_cancelled'; END IF;

  -- Rate limit : max 5 tentatives échouées / 10 min
  SELECT count(*) INTO v_recent_failures
  FROM public.restock_pickup_events
  WHERE transaction_id = _transaction_id
    AND event_type = 'code_attempt'
    AND (metadata->>'success')::boolean IS NOT TRUE
    AND created_at > now() - interval '10 minutes';

  IF v_recent_failures >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  IF _qr_token IS NOT NULL AND _qr_token = v_tx.pickup_qr_token THEN
    v_method := 'qr_scan';
  ELSIF _code IS NOT NULL AND _code = v_tx.pickup_handover_code THEN
    -- Acheteur tape le code côté vendeur OU vendeur tape côté acheteur
    IF v_actor = v_tx.seller_id THEN
      v_method := 'code_by_buyer';  -- code de l'acheteur saisi sur écran vendeur
    ELSE
      v_method := 'code_by_seller'; -- code du vendeur saisi sur écran acheteur
    END IF;
  ELSE
    INSERT INTO public.restock_pickup_events (transaction_id, event_type, actor_user_id, metadata)
    VALUES (_transaction_id, 'code_attempt', v_actor, jsonb_build_object('success', false));
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  UPDATE public.restock_transactions
  SET pickup_confirmed_at = now(),
      pickup_confirmed_by = v_actor,
      pickup_confirmation_method = v_method,
      status = 'picked_up',
      delivered_at = now()
  WHERE id = _transaction_id;

  INSERT INTO public.restock_pickup_events (transaction_id, event_type, actor_user_id, metadata)
  VALUES (_transaction_id, CASE WHEN v_method = 'qr_scan' THEN 'qr_scan_success' ELSE 'code_success' END,
          v_actor, jsonb_build_object('method', v_method));

  RETURN jsonb_build_object('success', true, 'method', v_method, 'confirmed_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_pickup(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_pickup(uuid, text, uuid) TO authenticated;

-- =========================================================================
-- 7. RPC auto_cancel_pickup_transaction — appelée par cron à J+10
-- =========================================================================
CREATE OR REPLACE FUNCTION public.auto_cancel_pickup_transaction(_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.restock_transactions%ROWTYPE;
BEGIN
  -- Réservé admin/service_role
  IF NOT public.is_admin(auth.uid()) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_tx FROM public.restock_transactions WHERE id = _transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  IF v_tx.delivery_mode <> 'pickup' THEN RAISE EXCEPTION 'not_a_pickup_transaction'; END IF;
  IF v_tx.pickup_confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'already_confirmed'; END IF;
  IF v_tx.status = 'cancelled_no_show' THEN RAISE EXCEPTION 'already_cancelled'; END IF;
  IF v_tx.pickup_deadline_at IS NULL OR v_tx.pickup_deadline_at > now() THEN
    RAISE EXCEPTION 'deadline_not_reached';
  END IF;

  UPDATE public.restock_transactions
  SET status = 'cancelled_no_show',
      cancelled_reason = 'pickup_no_show',
      penalty_applied = true
  WHERE id = _transaction_id;

  -- Remettre l'offre en vente
  UPDATE public.restock_offers
  SET status = 'published'
  WHERE id = v_tx.offer_id AND status = 'sold';

  INSERT INTO public.restock_pickup_events (transaction_id, event_type, metadata)
  VALUES (_transaction_id, 'auto_cancelled',
    jsonb_build_object('penalty_cents', 2000, 'reason', 'no_show_after_10_days'));

  RETURN jsonb_build_object('success', true, 'cancelled_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.auto_cancel_pickup_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_cancel_pickup_transaction(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_cancel_pickup_transaction(uuid) TO authenticated;

-- =========================================================================
-- 8. Helper RPC pour le cron watchdog : liste les commandes à rappeler / annuler
-- =========================================================================
CREATE OR REPLACE FUNCTION public.restock_pickup_watchdog_targets()
RETURNS TABLE (
  transaction_id uuid,
  action text,
  pickup_deadline_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, 'reminder'::text, pickup_deadline_at
  FROM public.restock_transactions
  WHERE delivery_mode = 'pickup'
    AND pickup_confirmed_at IS NULL
    AND status = 'awaiting_pickup'
    AND pickup_reminder_sent_at IS NULL
    AND pickup_deadline_at IS NOT NULL
    AND pickup_deadline_at <= now() + interval '48 hours'
    AND pickup_deadline_at > now()
  UNION ALL
  SELECT id, 'cancel'::text, pickup_deadline_at
  FROM public.restock_transactions
  WHERE delivery_mode = 'pickup'
    AND pickup_confirmed_at IS NULL
    AND status = 'awaiting_pickup'
    AND pickup_deadline_at IS NOT NULL
    AND pickup_deadline_at <= now();
$$;

REVOKE ALL ON FUNCTION public.restock_pickup_watchdog_targets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restock_pickup_watchdog_targets() TO service_role;
