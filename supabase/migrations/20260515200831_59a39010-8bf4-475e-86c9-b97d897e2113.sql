
CREATE TABLE public.buyer_comparator_sourcing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  gtin TEXT,
  cnk TEXT,
  raw_name TEXT,
  raw_brand TEXT,
  status TEXT NOT NULL CHECK (status IN ('unmatched','inactive_product','no_active_offer')),
  admin_status TEXT NOT NULL DEFAULT 'todo' CHECK (admin_status IN ('todo','sourcing','refused','resolved')),
  admin_notes TEXT,
  import_count INTEGER NOT NULL DEFAULT 0,
  user_count INTEGER NOT NULL DEFAULT 0,
  distinct_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  total_quantity NUMERIC NOT NULL DEFAULT 0,
  buyer_price_min_cents INTEGER,
  buyer_price_avg_cents INTEGER,
  buyer_price_max_cents INTEGER,
  buyer_price_sum_cents BIGINT NOT NULL DEFAULT 0,
  buyer_price_samples INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sourcing_items_status ON public.buyer_comparator_sourcing_items(status);
CREATE INDEX idx_sourcing_items_admin_status ON public.buyer_comparator_sourcing_items(admin_status);
CREATE INDEX idx_sourcing_items_brand ON public.buyer_comparator_sourcing_items(brand_id);
CREATE INDEX idx_sourcing_items_product ON public.buyer_comparator_sourcing_items(product_id);
CREATE INDEX idx_sourcing_items_total_qty ON public.buyer_comparator_sourcing_items(total_quantity DESC);
CREATE INDEX idx_sourcing_items_last_seen ON public.buyer_comparator_sourcing_items(last_seen_at DESC);

ALTER TABLE public.buyer_comparator_sourcing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sourcing items"
  ON public.buyer_comparator_sourcing_items FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update sourcing items"
  ON public.buyer_comparator_sourcing_items FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete sourcing items"
  ON public.buyer_comparator_sourcing_items FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_sourcing_items_updated_at
  BEFORE UPDATE ON public.buyer_comparator_sourcing_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_sourcing_item(
  _dedupe_key TEXT,
  _product_id UUID,
  _brand_id UUID,
  _gtin TEXT,
  _cnk TEXT,
  _raw_name TEXT,
  _raw_brand TEXT,
  _status TEXT,
  _user_id UUID,
  _quantity NUMERIC,
  _buyer_price_cents INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  INSERT INTO public.buyer_comparator_sourcing_items (
    dedupe_key, product_id, brand_id, gtin, cnk, raw_name, raw_brand, status,
    import_count, user_count, distinct_user_ids,
    total_quantity,
    buyer_price_min_cents, buyer_price_max_cents, buyer_price_sum_cents, buyer_price_samples, buyer_price_avg_cents,
    first_seen_at, last_seen_at
  ) VALUES (
    _dedupe_key, _product_id, _brand_id, _gtin, _cnk, _raw_name, _raw_brand, _status,
    1,
    CASE WHEN _user_id IS NULL THEN 0 ELSE 1 END,
    CASE WHEN _user_id IS NULL THEN ARRAY[]::UUID[] ELSE ARRAY[_user_id] END,
    COALESCE(_quantity, 0),
    _buyer_price_cents, _buyer_price_cents,
    COALESCE(_buyer_price_cents, 0)::BIGINT,
    CASE WHEN _buyer_price_cents IS NULL THEN 0 ELSE 1 END,
    _buyer_price_cents,
    now(), now()
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    product_id = COALESCE(EXCLUDED.product_id, public.buyer_comparator_sourcing_items.product_id),
    brand_id = COALESCE(EXCLUDED.brand_id, public.buyer_comparator_sourcing_items.brand_id),
    gtin = COALESCE(public.buyer_comparator_sourcing_items.gtin, EXCLUDED.gtin),
    cnk = COALESCE(public.buyer_comparator_sourcing_items.cnk, EXCLUDED.cnk),
    raw_name = COALESCE(public.buyer_comparator_sourcing_items.raw_name, EXCLUDED.raw_name),
    raw_brand = COALESCE(public.buyer_comparator_sourcing_items.raw_brand, EXCLUDED.raw_brand),
    status = EXCLUDED.status,
    import_count = public.buyer_comparator_sourcing_items.import_count + 1,
    distinct_user_ids = CASE
      WHEN _user_id IS NULL THEN public.buyer_comparator_sourcing_items.distinct_user_ids
      WHEN _user_id = ANY(public.buyer_comparator_sourcing_items.distinct_user_ids)
        THEN public.buyer_comparator_sourcing_items.distinct_user_ids
      ELSE array_append(public.buyer_comparator_sourcing_items.distinct_user_ids, _user_id)
    END,
    user_count = CASE
      WHEN _user_id IS NULL THEN public.buyer_comparator_sourcing_items.user_count
      WHEN _user_id = ANY(public.buyer_comparator_sourcing_items.distinct_user_ids)
        THEN public.buyer_comparator_sourcing_items.user_count
      ELSE public.buyer_comparator_sourcing_items.user_count + 1
    END,
    total_quantity = public.buyer_comparator_sourcing_items.total_quantity + COALESCE(_quantity, 0),
    buyer_price_min_cents = LEAST(public.buyer_comparator_sourcing_items.buyer_price_min_cents, _buyer_price_cents),
    buyer_price_max_cents = GREATEST(public.buyer_comparator_sourcing_items.buyer_price_max_cents, _buyer_price_cents),
    buyer_price_sum_cents = public.buyer_comparator_sourcing_items.buyer_price_sum_cents + COALESCE(_buyer_price_cents, 0)::BIGINT,
    buyer_price_samples = public.buyer_comparator_sourcing_items.buyer_price_samples + CASE WHEN _buyer_price_cents IS NULL THEN 0 ELSE 1 END,
    buyer_price_avg_cents = CASE
      WHEN public.buyer_comparator_sourcing_items.buyer_price_samples + CASE WHEN _buyer_price_cents IS NULL THEN 0 ELSE 1 END = 0 THEN NULL
      ELSE ((public.buyer_comparator_sourcing_items.buyer_price_sum_cents + COALESCE(_buyer_price_cents, 0)::BIGINT)
            / (public.buyer_comparator_sourcing_items.buyer_price_samples + CASE WHEN _buyer_price_cents IS NULL THEN 0 ELSE 1 END))::INTEGER
    END,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE VIEW public.admin_sourcing_items_by_brand_v
WITH (security_invoker = true) AS
SELECT
  COALESCE(b.id::TEXT, 'raw:' || lower(trim(s.raw_brand)), 'unknown') AS brand_key,
  b.id AS brand_id,
  COALESCE(b.name, NULLIF(trim(s.raw_brand), ''), '— Marque inconnue —') AS brand_label,
  COUNT(*)::INTEGER AS items_count,
  SUM(s.import_count)::INTEGER AS total_imports,
  SUM(s.user_count)::INTEGER AS total_users,
  SUM(s.total_quantity)::NUMERIC AS total_quantity,
  MAX(s.last_seen_at) AS last_seen_at,
  COUNT(*) FILTER (WHERE s.status = 'unmatched')::INTEGER AS unmatched_count,
  COUNT(*) FILTER (WHERE s.status = 'inactive_product')::INTEGER AS inactive_count,
  COUNT(*) FILTER (WHERE s.status = 'no_active_offer')::INTEGER AS no_offer_count
FROM public.buyer_comparator_sourcing_items s
LEFT JOIN public.brands b ON b.id = s.brand_id
WHERE s.admin_status IN ('todo','sourcing')
GROUP BY 1, 2, 3;
