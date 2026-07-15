
-- 1) Référentiel pharmacies belges
CREATE TABLE public.be_pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apb_number text NOT NULL UNIQUE,
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  province text,
  country_code text NOT NULL DEFAULT 'BE',
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  source text,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_be_pharmacies_postal ON public.be_pharmacies(postal_code);
CREATE INDEX idx_be_pharmacies_city ON public.be_pharmacies(city);
CREATE INDEX idx_be_pharmacies_name_trgm ON public.be_pharmacies USING gin (name gin_trgm_ops);

GRANT SELECT ON public.be_pharmacies TO authenticated;
GRANT ALL ON public.be_pharmacies TO service_role;

ALTER TABLE public.be_pharmacies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "be_pharmacies_read_authenticated"
  ON public.be_pharmacies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "be_pharmacies_admin_all"
  ON public.be_pharmacies FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_be_pharmacies_updated_at
  BEFORE UPDATE ON public.be_pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Rapports sell-in manuel (hors plateforme)
CREATE TABLE public.vendor_manual_sell_in_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  pharmacy_id uuid REFERENCES public.be_pharmacies(id) ON DELETE SET NULL,
  customer_label text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency_code text NOT NULL DEFAULT 'EUR',
  source text NOT NULL DEFAULT 'manual',
  file_name text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_manual_sell_in_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX idx_manual_sell_in_reports_vendor ON public.vendor_manual_sell_in_reports(vendor_id, period_start DESC);
CREATE INDEX idx_manual_sell_in_reports_pharmacy ON public.vendor_manual_sell_in_reports(pharmacy_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_manual_sell_in_reports TO authenticated;
GRANT ALL ON public.vendor_manual_sell_in_reports TO service_role;

ALTER TABLE public.vendor_manual_sell_in_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_sell_in_reports_vendor_owner"
  ON public.vendor_manual_sell_in_reports FOR ALL
  TO authenticated
  USING (vendor_id = public.current_vendor_id() OR public.is_admin())
  WITH CHECK (vendor_id = public.current_vendor_id() OR public.is_admin());

CREATE TRIGGER trg_manual_sell_in_reports_updated_at
  BEFORE UPDATE ON public.vendor_manual_sell_in_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Lignes de rapport
CREATE TABLE public.vendor_manual_sell_in_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.vendor_manual_sell_in_reports(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  gtin text,
  cnk_code text,
  raw_label text,
  units integer NOT NULL DEFAULT 0,
  gross_revenue_cents integer NOT NULL DEFAULT 0,
  net_revenue_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_sell_in_lines_report ON public.vendor_manual_sell_in_lines(report_id);
CREATE INDEX idx_manual_sell_in_lines_product ON public.vendor_manual_sell_in_lines(product_id);
CREATE INDEX idx_manual_sell_in_lines_gtin ON public.vendor_manual_sell_in_lines(gtin);
CREATE INDEX idx_manual_sell_in_lines_cnk ON public.vendor_manual_sell_in_lines(cnk_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_manual_sell_in_lines TO authenticated;
GRANT ALL ON public.vendor_manual_sell_in_lines TO service_role;

ALTER TABLE public.vendor_manual_sell_in_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_sell_in_lines_vendor_owner"
  ON public.vendor_manual_sell_in_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_manual_sell_in_reports r
      WHERE r.id = report_id
        AND (r.vendor_id = public.current_vendor_id() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_manual_sell_in_reports r
      WHERE r.id = report_id
        AND (r.vendor_id = public.current_vendor_id() OR public.is_admin())
    )
  );
