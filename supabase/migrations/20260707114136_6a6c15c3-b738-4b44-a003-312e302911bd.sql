
-- ============================================================
-- Phase 1 : Confirmation de livraison client (magic-link + auth)
-- ============================================================

-- 1. Enum statut par ligne
DO $$ BEGIN
  CREATE TYPE public.buyer_line_confirmation_status AS ENUM ('confirmed','partial','damaged','refused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Colonnes sur order_lines
ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS buyer_confirmation_status public.buyer_line_confirmation_status,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_quantity integer,
  ADD COLUMN IF NOT EXISTS buyer_confirmation_note text,
  ADD COLUMN IF NOT EXISTS buyer_confirmation_source text;

-- 3. Colonnes sur orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_confirmation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_confirmation_completed_at timestamptz;

-- 4. Table buyer_order_tokens (magic-link client, 1 par commande, 30 jours)
CREATE TABLE IF NOT EXISTS public.buyer_order_tokens (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_order_tokens_hash ON public.buyer_order_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_buyer_order_tokens_customer ON public.buyer_order_tokens(customer_id);

GRANT ALL ON public.buyer_order_tokens TO service_role;
ALTER TABLE public.buyer_order_tokens ENABLE ROW LEVEL SECURITY;
-- Aucune policy : deny all pour anon/authenticated ; accès via service_role uniquement.

-- 5. Génération / récupération du token (renvoie le raw token base64url ; ne stocke que le hash SHA-256)
CREATE OR REPLACE FUNCTION public.create_buyer_delivery_token(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _order record;
  _raw text;
  _hash text;
BEGIN
  SELECT id, order_number, customer_id
    INTO _order
    FROM public.orders
   WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  _raw := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+','-'), '/','_'), '=','');
  _hash := encode(extensions.digest(_raw, 'sha256'), 'hex');

  INSERT INTO public.buyer_order_tokens(order_id, order_number, customer_id, token_hash, expires_at)
  VALUES (_order.id, _order.order_number, _order.customer_id, _hash, now() + interval '30 days')
  ON CONFLICT (order_id) DO UPDATE
     SET token_hash = EXCLUDED.token_hash,
         expires_at = EXCLUDED.expires_at,
         used_at    = NULL,
         created_at = now();

  RETURN _raw;
END;
$$;
REVOKE ALL ON FUNCTION public.create_buyer_delivery_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_buyer_delivery_token(uuid) TO service_role;

-- 6. Lecture publique par token
CREATE OR REPLACE FUNCTION public.buyer_get_delivery_confirmation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _tok record;
  _order jsonb;
  _lines jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 20 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  SELECT * INTO _tok FROM public.buyer_order_tokens WHERE token_hash = _hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.expires_at < now() THEN RAISE EXCEPTION 'token_expired'; END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'delivery_confirmation_requested_at', o.delivery_confirmation_requested_at,
    'delivery_confirmation_completed_at', o.delivery_confirmation_completed_at,
    'customer', jsonb_build_object('company_name', c.company_name, 'email', c.email)
  )
  INTO _order
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = _tok.order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'quantity', l.quantity,
    'unit_price_incl_vat', l.unit_price_incl_vat,
    'line_total_incl_vat', l.line_total_incl_vat,
    'fulfillment_status', l.fulfillment_status,
    'buyer_confirmation_status', l.buyer_confirmation_status,
    'buyer_confirmed_at', l.buyer_confirmed_at,
    'buyer_confirmed_quantity', l.buyer_confirmed_quantity,
    'buyer_confirmation_note', l.buyer_confirmation_note,
    'product', jsonb_build_object('name', p.name, 'gtin', p.gtin, 'cnk_code', p.cnk_code),
    'vendor', jsonb_build_object('display_code', v.display_code, 'name', v.name)
  ) ORDER BY l.id), '[]'::jsonb)
  INTO _lines
  FROM public.order_lines l
  LEFT JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.vendors  v ON v.id = l.vendor_id
  WHERE l.order_id = _tok.order_id;

  RETURN jsonb_build_object('order', _order, 'lines', _lines);
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_get_delivery_confirmation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_get_delivery_confirmation(text) TO anon, authenticated;

-- 7. Lecture pour client connecté (sans token, sur sa propre commande)
CREATE OR REPLACE FUNCTION public.buyer_get_delivery_confirmation_by_auth(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order jsonb;
  _lines jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'delivery_confirmation_requested_at', o.delivery_confirmation_requested_at,
    'delivery_confirmation_completed_at', o.delivery_confirmation_completed_at,
    'customer', jsonb_build_object('company_name', c.company_name, 'email', c.email)
  )
  INTO _order
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = _order_id
    AND c.auth_user_id = _uid;
  IF _order IS NULL THEN RAISE EXCEPTION 'not_found_or_forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'quantity', l.quantity,
    'unit_price_incl_vat', l.unit_price_incl_vat,
    'line_total_incl_vat', l.line_total_incl_vat,
    'fulfillment_status', l.fulfillment_status,
    'buyer_confirmation_status', l.buyer_confirmation_status,
    'buyer_confirmed_at', l.buyer_confirmed_at,
    'buyer_confirmed_quantity', l.buyer_confirmed_quantity,
    'buyer_confirmation_note', l.buyer_confirmation_note,
    'product', jsonb_build_object('name', p.name, 'gtin', p.gtin, 'cnk_code', p.cnk_code),
    'vendor', jsonb_build_object('display_code', v.display_code, 'name', v.name)
  ) ORDER BY l.id), '[]'::jsonb)
  INTO _lines
  FROM public.order_lines l
  LEFT JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.vendors  v ON v.id = l.vendor_id
  WHERE l.order_id = _order_id;

  RETURN jsonb_build_object('order', _order, 'lines', _lines);
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_get_delivery_confirmation_by_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_get_delivery_confirmation_by_auth(uuid) TO authenticated;

-- 8. Soumission (interne, appelée par les 2 wrappers ci-dessous)
CREATE OR REPLACE FUNCTION public._apply_buyer_delivery_confirmation(
  _order_id uuid, _lines jsonb, _source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry jsonb;
  _line_id uuid;
  _status public.buyer_line_confirmation_status;
  _qty int;
  _note text;
  _line record;
  _updated_count int := 0;
  _total_lines int;
  _confirmed_lines int;
BEGIN
  IF jsonb_typeof(_lines) <> 'array' THEN RAISE EXCEPTION 'invalid_payload'; END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    _line_id := (_entry->>'line_id')::uuid;
    _status  := (_entry->>'status')::public.buyer_line_confirmation_status;
    _qty     := NULLIF(_entry->>'quantity_received','')::int;
    _note    := NULLIF(_entry->>'note','');

    IF _line_id IS NULL OR _status IS NULL THEN CONTINUE; END IF;

    SELECT id, quantity, fulfillment_status
      INTO _line
      FROM public.order_lines
     WHERE id = _line_id AND order_id = _order_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- garde-fous quantité
    IF _qty IS NOT NULL THEN
      IF _qty < 0 THEN _qty := 0; END IF;
      IF _qty > _line.quantity THEN _qty := _line.quantity; END IF;
    ELSE
      _qty := CASE WHEN _status = 'confirmed' THEN _line.quantity ELSE 0 END;
    END IF;

    UPDATE public.order_lines
       SET buyer_confirmation_status  = _status,
           buyer_confirmed_at         = now(),
           buyer_confirmed_quantity   = _qty,
           buyer_confirmation_note    = _note,
           buyer_confirmation_source  = _source,
           updated_at                 = now()
     WHERE id = _line_id;
    _updated_count := _updated_count + 1;
  END LOOP;

  -- Marque la commande "confirmée client" si toutes les lignes ont un statut
  SELECT count(*), count(buyer_confirmation_status)
    INTO _total_lines, _confirmed_lines
    FROM public.order_lines
   WHERE order_id = _order_id;

  IF _total_lines > 0 AND _confirmed_lines = _total_lines THEN
    UPDATE public.orders
       SET delivery_confirmation_completed_at = COALESCE(delivery_confirmation_completed_at, now()),
           updated_at = now()
     WHERE id = _order_id;
  END IF;

  RETURN jsonb_build_object(
    'updated_lines', _updated_count,
    'all_confirmed', (_total_lines > 0 AND _confirmed_lines = _total_lines)
  );
END;
$$;
REVOKE ALL ON FUNCTION public._apply_buyer_delivery_confirmation(uuid, jsonb, text) FROM PUBLIC;

-- 9. Wrapper par token
CREATE OR REPLACE FUNCTION public.buyer_submit_delivery_confirmation(_token text, _lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
  _tok record;
  _res jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 20 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  SELECT * INTO _tok FROM public.buyer_order_tokens WHERE token_hash = _hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.expires_at < now() THEN RAISE EXCEPTION 'token_expired'; END IF;

  _res := public._apply_buyer_delivery_confirmation(_tok.order_id, _lines, 'magic_link');

  UPDATE public.buyer_order_tokens
     SET used_at = COALESCE(used_at, now())
   WHERE order_id = _tok.order_id;

  RETURN _res;
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_submit_delivery_confirmation(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_submit_delivery_confirmation(text, jsonb) TO anon, authenticated;

-- 10. Wrapper compte
CREATE OR REPLACE FUNCTION public.buyer_submit_delivery_confirmation_by_auth(_order_id uuid, _lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ok boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = _order_id AND c.auth_user_id = _uid
  ) INTO _ok;
  IF NOT _ok THEN RAISE EXCEPTION 'not_found_or_forbidden'; END IF;

  RETURN public._apply_buyer_delivery_confirmation(_order_id, _lines, 'auth');
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_submit_delivery_confirmation_by_auth(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_submit_delivery_confirmation_by_auth(uuid, jsonb) TO authenticated;

-- 11. Trigger : au passage à "delivered", appelle l'edge function request-delivery-confirmation
CREATE OR REPLACE FUNCTION public.trg_orders_request_delivery_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _cron_secret text;
  _base_url text := 'https://iokwqxhhpblcbkrxgcje.supabase.co/functions/v1';
  _req_id bigint;
BEGIN
  IF (TG_OP = 'UPDATE')
     AND NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered')
     AND NEW.delivery_confirmation_requested_at IS NULL
  THEN
    SELECT decrypted_secret INTO _cron_secret
      FROM vault.decrypted_secrets
     WHERE name = 'cron_shared_secret'
     LIMIT 1;

    IF _cron_secret IS NOT NULL THEN
      SELECT net.http_post(
        url := _base_url || '/request-delivery-confirmation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', _cron_secret
        ),
        body := jsonb_build_object('orderId', NEW.id)
      ) INTO _req_id;
    END IF;

    NEW.delivery_confirmation_requested_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_request_delivery_confirmation ON public.orders;
CREATE TRIGGER trg_orders_request_delivery_confirmation
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_request_delivery_confirmation();
