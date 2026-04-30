-- Statut RFQ
DO $$ BEGIN
  CREATE TYPE public.rfq_status AS ENUM ('open','closed','awarded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rfq_target_scope AS ENUM ('product_only','brand_only','product_and_brand');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  target_scope public.rfq_target_scope NOT NULL DEFAULT 'product_only',
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  target_price_excl_vat_cents INTEGER CHECK (target_price_excl_vat_cents IS NULL OR target_price_excl_vat_cents >= 0),
  desired_delivery_date DATE,
  destination_country_code TEXT NOT NULL CHECK (char_length(destination_country_code) = 2),
  delivery_address JSONB,
  payment_terms TEXT CHECK (payment_terms IS NULL OR char_length(payment_terms) <= 500),
  required_offer_validity_days INTEGER CHECK (required_offer_validity_days IS NULL OR (required_offer_validity_days BETWEEN 1 AND 365)),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 4000),
  status public.rfq_status NOT NULL DEFAULT 'open',
  responses_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  admin_curated BOOLEAN NOT NULL DEFAULT false,
  is_paid_feature BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rfq_at_least_one_target CHECK (product_id IS NOT NULL OR brand_id IS NOT NULL),
  CONSTRAINT rfq_scope_consistent CHECK (
    (target_scope = 'product_only' AND product_id IS NOT NULL)
    OR (target_scope = 'brand_only' AND brand_id IS NOT NULL)
    OR (target_scope = 'product_and_brand' AND product_id IS NOT NULL AND brand_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rfqs_buyer ON public.rfqs(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfqs_product ON public.rfqs(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rfqs_brand ON public.rfqs(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON public.rfqs(status, responses_deadline);

CREATE TABLE IF NOT EXISTS public.rfq_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  unit_price_excl_vat_cents INTEGER NOT NULL CHECK (unit_price_excl_vat_cents > 0),
  moq INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
  delivery_days INTEGER NOT NULL CHECK (delivery_days BETWEEN 0 AND 365),
  offer_validity_days INTEGER CHECK (offer_validity_days IS NULL OR (offer_validity_days BETWEEN 1 AND 365)),
  payment_terms TEXT CHECK (payment_terms IS NULL OR char_length(payment_terms) <= 500),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 4000),
  rank_position INTEGER,
  is_visible_to_buyer BOOLEAN NOT NULL DEFAULT false,
  admin_override_visible BOOLEAN NOT NULL DEFAULT false,
  awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_responses_rfq ON public.rfq_responses(rfq_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_rfq_responses_vendor ON public.rfq_responses(vendor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rfq_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  rfq_response_id UUID REFERENCES public.rfq_responses(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('buyer','vendor','admin')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL CHECK (char_length(file_name) <= 255),
  mime_type TEXT NOT NULL CHECK (char_length(mime_type) <= 100),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfq_attachments_rfq ON public.rfq_attachments(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_attachments_response ON public.rfq_attachments(rfq_response_id) WHERE rfq_response_id IS NOT NULL;

-- updated_at triggers (réutilise un helper si déjà présent)
CREATE OR REPLACE FUNCTION public.touch_updated_at_rfq()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_rfqs_touch ON public.rfqs;
CREATE TRIGGER trg_rfqs_touch BEFORE UPDATE ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_rfq();

DROP TRIGGER IF EXISTS trg_rfq_responses_touch ON public.rfq_responses;
CREATE TRIGGER trg_rfq_responses_touch BEFORE UPDATE ON public.rfq_responses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_rfq();

-- Top-3 ranking auto
CREATE OR REPLACE FUNCTION public.recompute_rfq_response_ranks(_rfq_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (ORDER BY unit_price_excl_vat_cents ASC, delivery_days ASC, created_at ASC) AS rn
    FROM public.rfq_responses
    WHERE rfq_id = _rfq_id
  )
  UPDATE public.rfq_responses r
     SET rank_position = CASE WHEN ranked.rn <= 3 THEN ranked.rn::int ELSE NULL END,
         is_visible_to_buyer = (ranked.rn <= 3) OR r.admin_override_visible
    FROM ranked
   WHERE r.id = ranked.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_rfq_response_recompute_ranks()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_rfq_response_ranks(COALESCE(NEW.rfq_id, OLD.rfq_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rfq_responses_rank ON public.rfq_responses;
CREATE TRIGGER trg_rfq_responses_rank
AFTER INSERT OR UPDATE OF unit_price_excl_vat_cents, delivery_days, admin_override_visible
OR DELETE
ON public.rfq_responses
FOR EACH ROW EXECUTE FUNCTION public.trg_rfq_response_recompute_ranks();

-- Vendeurs ciblés par une RFQ
CREATE OR REPLACE FUNCTION public.get_rfq_target_vendor_ids(_rfq_id UUID)
RETURNS TABLE(vendor_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r public.rfqs%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.rfqs WHERE id = _rfq_id;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY
  SELECT DISTINCT v.id FROM public.vendors v
  WHERE
    (
      _r.target_scope IN ('product_only','product_and_brand')
      AND _r.product_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.offers o
        WHERE o.vendor_id = v.id AND o.product_id = _r.product_id AND o.is_active = true
      )
    )
    OR
    (
      _r.target_scope IN ('brand_only','product_and_brand')
      AND _r.brand_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.offers o
        JOIN public.products p ON p.id = o.product_id
        WHERE o.vendor_id = v.id AND o.is_active = true AND p.brand_id = _r.brand_id
      )
    );
END;
$$;

-- RLS rfqs
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can create their own RFQs"
ON public.rfqs FOR INSERT TO authenticated
WITH CHECK (buyer_user_id = auth.uid());

CREATE POLICY "Buyers can view their own RFQs"
ON public.rfqs FOR SELECT TO authenticated
USING (buyer_user_id = auth.uid());

CREATE POLICY "Buyers can update their own RFQs"
ON public.rfqs FOR UPDATE TO authenticated
USING (buyer_user_id = auth.uid())
WITH CHECK (buyer_user_id = auth.uid());

CREATE POLICY "Vendors can view RFQs targeting them"
ON public.rfqs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_rfq_target_vendor_ids(id) t
    JOIN public.vendors v ON v.id = t.vendor_id
    WHERE v.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all RFQs"
ON public.rfqs FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- RLS rfq_responses
ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can submit responses to RFQs targeting them"
ON public.rfq_responses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = rfq_responses.vendor_id AND v.auth_user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.get_rfq_target_vendor_ids(rfq_responses.rfq_id) t WHERE t.vendor_id = rfq_responses.vendor_id)
);

CREATE POLICY "Vendors can view & update their own responses"
ON public.rfq_responses FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = rfq_responses.vendor_id AND v.auth_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = rfq_responses.vendor_id AND v.auth_user_id = auth.uid()));

CREATE POLICY "Buyers see only top responses to their RFQs"
ON public.rfq_responses FOR SELECT TO authenticated
USING (
  is_visible_to_buyer = true
  AND EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_responses.rfq_id AND r.buyer_user_id = auth.uid())
);

CREATE POLICY "Admins manage all responses"
ON public.rfq_responses FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- RLS rfq_attachments
ALTER TABLE public.rfq_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uploader can insert their own attachments"
ON public.rfq_attachments FOR INSERT TO authenticated
WITH CHECK (uploaded_by_user_id = auth.uid());

CREATE POLICY "Buyer reads attachments of own RFQ"
ON public.rfq_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_attachments.rfq_id AND r.buyer_user_id = auth.uid()));

CREATE POLICY "Vendor reads attachments of RFQs targeting them"
ON public.rfq_attachments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.get_rfq_target_vendor_ids(rfq_attachments.rfq_id) t
    JOIN public.vendors v ON v.id = t.vendor_id
    WHERE v.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all attachments"
ON public.rfq_attachments FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rfq-attachments', 'rfq-attachments', false, 20971520,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/csv','text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

CREATE POLICY "rfq_attach_uploader_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rfq-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "rfq_attach_uploader_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rfq-attachments' AND owner = auth.uid());

CREATE POLICY "rfq_attach_admin_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'rfq-attachments' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())))
WITH CHECK (bucket_id = 'rfq-attachments' AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())));

COMMENT ON TABLE public.rfqs IS
  'Demandes de prix B2B (RFQ). Acheteur saisit qte/prix cible/delai/pays/conditions. MediKong dispatche aux vendeurs cibles (produit OU marque) et auto-classe top 3 reponses.';
COMMENT ON TABLE public.rfq_responses IS
  'Reponses vendeurs aux RFQ. Trigger trg_rfq_responses_rank recalcule rank_position (1..3) et is_visible_to_buyer apres chaque INSERT/UPDATE/DELETE. admin_override_visible permet a un admin de forcer une reponse hors top.';
COMMENT ON TABLE public.rfq_attachments IS
  'Pieces jointes RFQ (cahier des charges acheteur, devis PDF vendeur). Bucket prive rfq-attachments.';