
-- 1. ENUM statut d'approbation
DO $$ BEGIN
  CREATE TYPE public.commission_override_status AS ENUM (
    'draft','pending_approval','approved','rejected','expired'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Colonnes override sur offers
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS commission_model text,
  ADD COLUMN IF NOT EXISTS commission_rate numeric,
  ADD COLUMN IF NOT EXISTS margin_split_pct numeric,
  ADD COLUMN IF NOT EXISTS fixed_commission_amount numeric,
  ADD COLUMN IF NOT EXISTS commission_override_status public.commission_override_status,
  ADD COLUMN IF NOT EXISTS commission_valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS commission_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS commission_override_reason text,
  ADD COLUMN IF NOT EXISTS commission_override_updated_by uuid,
  ADD COLUMN IF NOT EXISTS commission_override_updated_at timestamptz;

ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_commission_model_chk;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_commission_model_chk
  CHECK (commission_model IS NULL OR commission_model IN ('flat_percentage','margin_split','fixed_amount'));

-- 3. Table vendor_product_commissions
CREATE TABLE IF NOT EXISTS public.vendor_product_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  commission_model text NOT NULL CHECK (commission_model IN ('flat_percentage','margin_split','fixed_amount')),
  commission_rate numeric,
  margin_split_pct numeric,
  fixed_commission_amount numeric,
  status public.commission_override_status NOT NULL DEFAULT 'pending_approval',
  valid_from timestamptz,
  valid_until timestamptz,
  note text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_vpc_vendor ON public.vendor_product_commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vpc_product ON public.vendor_product_commissions(product_id);
CREATE INDEX IF NOT EXISTS idx_vpc_status ON public.vendor_product_commissions(status);

ALTER TABLE public.vendor_product_commissions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_vpc_updated_at ON public.vendor_product_commissions;
CREATE TRIGGER trg_vpc_updated_at
  BEFORE UPDATE ON public.vendor_product_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Vendors view own commission overrides" ON public.vendor_product_commissions;
CREATE POLICY "Vendors view own commission overrides"
  ON public.vendor_product_commissions FOR SELECT
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Vendors create own commission overrides" ON public.vendor_product_commissions;
CREATE POLICY "Vendors create own commission overrides"
  ON public.vendor_product_commissions FOR INSERT
  WITH CHECK (
    (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
      AND status = 'pending_approval')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Vendors update own pending overrides" ON public.vendor_product_commissions;
CREATE POLICY "Vendors update own pending overrides"
  ON public.vendor_product_commissions FOR UPDATE
  USING (
    (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid())
      AND status IN ('pending_approval','draft','rejected'))
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins delete commission overrides" ON public.vendor_product_commissions;
CREATE POLICY "Admins delete commission overrides"
  ON public.vendor_product_commissions FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 4. Audit log
CREATE TABLE IF NOT EXISTS public.commission_overrides_audit (
  id bigserial PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('offer','product')),
  offer_id uuid,
  vendor_id uuid,
  product_id uuid,
  action text NOT NULL CHECK (action IN ('create','update','approve','reject','delete','expire')),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coa_vendor ON public.commission_overrides_audit(vendor_id);
CREATE INDEX IF NOT EXISTS idx_coa_product ON public.commission_overrides_audit(product_id);
CREATE INDEX IF NOT EXISTS idx_coa_offer ON public.commission_overrides_audit(offer_id);

ALTER TABLE public.commission_overrides_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view commission audit" ON public.commission_overrides_audit;
CREATE POLICY "Admins view commission audit"
  ON public.commission_overrides_audit FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 5. Trigger d'audit sur vendor_product_commissions
CREATE OR REPLACE FUNCTION public.audit_vendor_product_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commission_overrides_audit (scope, vendor_id, product_id, action, after_data)
    VALUES ('product', NEW.vendor_id, NEW.product_id, 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.commission_overrides_audit (scope, vendor_id, product_id, action, before_data, after_data)
    VALUES (
      'product', NEW.vendor_id, NEW.product_id,
      CASE
        WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved' THEN 'approve'
        WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN 'reject'
        ELSE 'update'
      END,
      to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.commission_overrides_audit (scope, vendor_id, product_id, action, before_data)
    VALUES ('product', OLD.vendor_id, OLD.product_id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_vpc ON public.vendor_product_commissions;
CREATE TRIGGER trg_audit_vpc
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_product_commissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_vendor_product_commission();

-- 6. Trigger d'audit sur offers (champs commission)
CREATE OR REPLACE FUNCTION public.audit_offer_commission_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.commission_model IS DISTINCT FROM NEW.commission_model
    OR OLD.commission_rate IS DISTINCT FROM NEW.commission_rate
    OR OLD.margin_split_pct IS DISTINCT FROM NEW.margin_split_pct
    OR OLD.fixed_commission_amount IS DISTINCT FROM NEW.fixed_commission_amount
    OR OLD.commission_override_status IS DISTINCT FROM NEW.commission_override_status
    OR OLD.commission_valid_from IS DISTINCT FROM NEW.commission_valid_from
    OR OLD.commission_valid_until IS DISTINCT FROM NEW.commission_valid_until
  ) THEN
    NEW.commission_override_updated_by := auth.uid();
    NEW.commission_override_updated_at := now();
    INSERT INTO public.commission_overrides_audit (
      scope, offer_id, vendor_id, product_id, action, before_data, after_data
    ) VALUES (
      'offer', NEW.id, NEW.vendor_id, NEW.product_id,
      CASE
        WHEN OLD.commission_override_status IS DISTINCT FROM NEW.commission_override_status
             AND NEW.commission_override_status = 'approved' THEN 'approve'
        WHEN OLD.commission_override_status IS DISTINCT FROM NEW.commission_override_status
             AND NEW.commission_override_status = 'rejected' THEN 'reject'
        ELSE 'update'
      END,
      jsonb_build_object(
        'commission_model', OLD.commission_model,
        'commission_rate', OLD.commission_rate,
        'margin_split_pct', OLD.margin_split_pct,
        'fixed_commission_amount', OLD.fixed_commission_amount,
        'commission_override_status', OLD.commission_override_status,
        'commission_valid_from', OLD.commission_valid_from,
        'commission_valid_until', OLD.commission_valid_until
      ),
      jsonb_build_object(
        'commission_model', NEW.commission_model,
        'commission_rate', NEW.commission_rate,
        'margin_split_pct', NEW.margin_split_pct,
        'fixed_commission_amount', NEW.fixed_commission_amount,
        'commission_override_status', NEW.commission_override_status,
        'commission_valid_from', NEW.commission_valid_from,
        'commission_valid_until', NEW.commission_valid_until
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_offer_commission ON public.offers;
CREATE TRIGGER trg_audit_offer_commission
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.audit_offer_commission_override();

-- 7. RPC resolve_effective_commission
CREATE OR REPLACE FUNCTION public.resolve_effective_commission(_offer_id uuid)
RETURNS TABLE (
  source text,
  commission_model text,
  commission_rate numeric,
  margin_split_pct numeric,
  fixed_commission_amount numeric,
  valid_from timestamptz,
  valid_until timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  o record;
  vpc record;
  v record;
  now_ts timestamptz := now();
BEGIN
  SELECT id, vendor_id, product_id,
         commission_model, commission_rate, margin_split_pct, fixed_commission_amount,
         commission_override_status, commission_valid_from, commission_valid_until
    INTO o
    FROM public.offers WHERE id = _offer_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF o.commission_model IS NOT NULL
     AND o.commission_override_status = 'approved'
     AND (o.commission_valid_from IS NULL OR o.commission_valid_from <= now_ts)
     AND (o.commission_valid_until IS NULL OR o.commission_valid_until > now_ts)
  THEN
    RETURN QUERY SELECT
      'offer'::text,
      o.commission_model, o.commission_rate, o.margin_split_pct, o.fixed_commission_amount,
      o.commission_valid_from, o.commission_valid_until;
    RETURN;
  END IF;

  SELECT * INTO vpc
    FROM public.vendor_product_commissions
   WHERE vendor_id = o.vendor_id
     AND product_id = o.product_id
     AND status = 'approved'
     AND (valid_from IS NULL OR valid_from <= now_ts)
     AND (valid_until IS NULL OR valid_until > now_ts)
   LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      'product'::text,
      vpc.commission_model, vpc.commission_rate, vpc.margin_split_pct, vpc.fixed_commission_amount,
      vpc.valid_from, vpc.valid_until;
    RETURN;
  END IF;

  SELECT commission_model::text, commission_rate, margin_split_pct, fixed_commission_amount
    INTO v
    FROM public.vendors WHERE id = o.vendor_id;

  RETURN QUERY SELECT
    'vendor'::text,
    COALESCE(v.commission_model, 'flat_percentage'),
    v.commission_rate, v.margin_split_pct, v.fixed_commission_amount,
    NULL::timestamptz, NULL::timestamptz;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_effective_commission(uuid) TO authenticated, anon;

-- 8. RPC admin approve/reject
CREATE OR REPLACE FUNCTION public.admin_review_product_commission(
  _id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
RETURNS public.vendor_product_commissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.vendor_product_commissions;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  UPDATE public.vendor_product_commissions
     SET status = CASE WHEN _decision = 'approve' THEN 'approved'::commission_override_status
                       ELSE 'rejected'::commission_override_status END,
         approved_by = auth.uid(),
         approved_at = CASE WHEN _decision = 'approve' THEN now() ELSE approved_at END,
         rejected_reason = CASE WHEN _decision = 'reject' THEN _reason ELSE rejected_reason END,
         updated_at = now()
   WHERE id = _id
   RETURNING * INTO row_out;

  IF NOT FOUND THEN RAISE EXCEPTION 'override not found'; END IF;
  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_product_commission(uuid, text, text) TO authenticated;
