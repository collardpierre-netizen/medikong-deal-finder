DO $$ BEGIN
  CREATE TYPE public.buyer_p2p_status AS ENUM (
    'draft','sent','accepted','declined','expired','cancelled',
    'paid','shipped','completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.buyer_p2p_commission_payer AS ENUM ('seller','buyer','split');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.buyer_p2p_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  default_commission_bps integer NOT NULL DEFAULT 0 CHECK (default_commission_bps BETWEEN 0 AND 10000),
  commission_payer public.buyer_p2p_commission_payer NOT NULL DEFAULT 'seller',
  max_validity_days integer NOT NULL DEFAULT 14 CHECK (max_validity_days BETWEEN 1 AND 90),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.buyer_p2p_settings TO authenticated;
GRANT ALL ON public.buyer_p2p_settings TO service_role;

ALTER TABLE public.buyer_p2p_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p2p_settings_select_authenticated"
  ON public.buyer_p2p_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "p2p_settings_admin_write"
  ON public.buyer_p2p_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.buyer_p2p_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public._current_user_buyer_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id FROM public.buyers b WHERE b.user_id = auth.uid()
  UNION
  SELECT account_id FROM public.account_memberships
  WHERE user_id = auth.uid() AND account_kind = 'buyer' AND status = 'active'
$$;

CREATE TABLE IF NOT EXISTS public.buyer_p2p_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  target_buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  gtin text,
  cnk_code text,
  product_name text NOT NULL,
  brand_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_excl_vat_cents integer NOT NULL CHECK (unit_price_excl_vat_cents >= 0),
  vat_rate numeric(5,2) NOT NULL DEFAULT 21.00 CHECK (vat_rate BETWEEN 0 AND 100),
  currency_code text NOT NULL DEFAULT 'EUR',
  batch_number text,
  expiry_date date,
  status public.buyer_p2p_status NOT NULL DEFAULT 'draft',
  valid_until timestamptz NOT NULL,
  notes text,
  commission_enabled boolean NOT NULL DEFAULT false,
  commission_rate_bps integer NOT NULL DEFAULT 0 CHECK (commission_rate_bps BETWEEN 0 AND 10000),
  commission_payer public.buyer_p2p_commission_payer NOT NULL DEFAULT 'seller',
  sub_order_id uuid REFERENCES public.sub_orders(id) ON DELETE SET NULL,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT p2p_seller_target_distinct CHECK (seller_buyer_id <> target_buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_p2p_listings_seller ON public.buyer_p2p_listings(seller_buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_p2p_listings_target ON public.buyer_p2p_listings(target_buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_p2p_listings_status ON public.buyer_p2p_listings(status);
CREATE INDEX IF NOT EXISTS idx_buyer_p2p_listings_valid_until ON public.buyer_p2p_listings(valid_until) WHERE status = 'sent';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_p2p_listings TO authenticated;
GRANT ALL ON public.buyer_p2p_listings TO service_role;

ALTER TABLE public.buyer_p2p_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p2p_listings_select_party_or_admin"
  ON public.buyer_p2p_listings FOR SELECT TO authenticated
  USING (
    seller_buyer_id IN (SELECT public._current_user_buyer_ids())
    OR target_buyer_id IN (SELECT public._current_user_buyer_ids())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "p2p_listings_insert_seller"
  ON public.buyer_p2p_listings FOR INSERT TO authenticated
  WITH CHECK (seller_buyer_id IN (SELECT public._current_user_buyer_ids()));

CREATE POLICY "p2p_listings_update_party_or_admin"
  ON public.buyer_p2p_listings FOR UPDATE TO authenticated
  USING (
    seller_buyer_id IN (SELECT public._current_user_buyer_ids())
    OR target_buyer_id IN (SELECT public._current_user_buyer_ids())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "p2p_listings_delete_seller_draft_or_admin"
  ON public.buyer_p2p_listings FOR DELETE TO authenticated
  USING (
    (seller_buyer_id IN (SELECT public._current_user_buyer_ids()) AND status = 'draft')
    OR public.is_admin(auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.buyer_p2p_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.buyer_p2p_listings(id) ON DELETE CASCADE,
  author_buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  counter_unit_price_excl_vat_cents integer CHECK (counter_unit_price_excl_vat_cents IS NULL OR counter_unit_price_excl_vat_cents >= 0),
  counter_quantity integer CHECK (counter_quantity IS NULL OR counter_quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_p2p_messages_listing ON public.buyer_p2p_messages(listing_id);

GRANT SELECT, INSERT ON public.buyer_p2p_messages TO authenticated;
GRANT ALL ON public.buyer_p2p_messages TO service_role;

ALTER TABLE public.buyer_p2p_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p2p_messages_select_party_or_admin"
  ON public.buyer_p2p_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_p2p_listings l
      WHERE l.id = listing_id
        AND (
          l.seller_buyer_id IN (SELECT public._current_user_buyer_ids())
          OR l.target_buyer_id IN (SELECT public._current_user_buyer_ids())
          OR public.is_admin(auth.uid())
        )
    )
  );

CREATE POLICY "p2p_messages_insert_party"
  ON public.buyer_p2p_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_buyer_id IN (SELECT public._current_user_buyer_ids())
    AND EXISTS (
      SELECT 1 FROM public.buyer_p2p_listings l
      WHERE l.id = listing_id
        AND (l.seller_buyer_id = author_buyer_id OR l.target_buyer_id = author_buyer_id)
        AND l.status IN ('sent','draft')
    )
  );

CREATE OR REPLACE FUNCTION public._buyer_p2p_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_p2p_listings_touch ON public.buyer_p2p_listings;
CREATE TRIGGER trg_buyer_p2p_listings_touch
  BEFORE UPDATE ON public.buyer_p2p_listings
  FOR EACH ROW EXECUTE FUNCTION public._buyer_p2p_touch_updated_at();

DROP TRIGGER IF EXISTS trg_buyer_p2p_settings_touch ON public.buyer_p2p_settings;
CREATE TRIGGER trg_buyer_p2p_settings_touch
  BEFORE UPDATE ON public.buyer_p2p_settings
  FOR EACH ROW EXECUTE FUNCTION public._buyer_p2p_touch_updated_at();

CREATE OR REPLACE FUNCTION public._buyer_p2p_status_transitions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  _max_days integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT max_validity_days INTO _max_days FROM public.buyer_p2p_settings WHERE id = true;
    IF _max_days IS NOT NULL AND NEW.valid_until > now() + (_max_days || ' days')::interval THEN
      RAISE EXCEPTION 'valid_until dépasse la validité maximale (% jours)', _max_days;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'      AND NEW.status IN ('sent','cancelled'))
      OR (OLD.status = 'sent'    AND NEW.status IN ('accepted','declined','expired','cancelled'))
      OR (OLD.status = 'accepted' AND NEW.status IN ('paid','cancelled'))
      OR (OLD.status = 'paid'    AND NEW.status IN ('shipped','completed'))
      OR (OLD.status = 'shipped' AND NEW.status IN ('completed'))
    ) THEN
      RAISE EXCEPTION 'Transition de statut invalide : % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'sent'      AND NEW.sent_at      IS NULL THEN NEW.sent_at = now();      END IF;
    IF NEW.status = 'accepted'  AND NEW.accepted_at  IS NULL THEN NEW.accepted_at = now();  END IF;
    IF NEW.status = 'declined'  AND NEW.declined_at  IS NULL THEN NEW.declined_at = now();  END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at = now(); END IF;
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN NEW.completed_at = now(); END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_p2p_listings_transitions ON public.buyer_p2p_listings;
CREATE TRIGGER trg_buyer_p2p_listings_transitions
  BEFORE INSERT OR UPDATE ON public.buyer_p2p_listings
  FOR EACH ROW EXECUTE FUNCTION public._buyer_p2p_status_transitions();