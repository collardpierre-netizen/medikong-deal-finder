-- ── Traçabilité des demandes d'export catalogue ────────────────────────────
CREATE TABLE public.qogita_catalog_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_request_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'requested',
  scope TEXT NOT NULL DEFAULT 'full',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  generation_ms INTEGER,
  filename TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  csv_columns TEXT[] NOT NULL DEFAULT '{}',
  error_code TEXT,
  error_message TEXT,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.qogita_catalog_downloads TO service_role;
GRANT SELECT ON public.qogita_catalog_downloads TO authenticated;
ALTER TABLE public.qogita_catalog_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read catalog downloads"
  ON public.qogita_catalog_downloads FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── Référentiel catalogue (1 ligne / produit fournisseur) ───────────────────
-- ⚠️ indicative_price_* = prix plancher indicatif (gros volume + shipping).
-- NE JAMAIS l'utiliser comme coût d'achat / base de marge : le coût réel vient
-- de l'endpoint offres (Lot 1) via offers.qogita_base_price.
CREATE TABLE public.qogita_catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gtin TEXT NOT NULL UNIQUE,
  qogita_fid TEXT,
  name TEXT,
  brand_name TEXT,
  category_slug TEXT,
  category_name TEXT,
  indicative_price NUMERIC(12,4),
  indicative_price_currency TEXT DEFAULT 'EUR',
  indicative_price_includes_shipping BOOLEAN NOT NULL DEFAULT true,
  inventory INTEGER,
  supplier_alias TEXT,
  supplier_url TEXT,
  unit_size INTEGER,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  is_present_in_catalog BOOLEAN NOT NULL DEFAULT true,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disappeared_at TIMESTAMPTZ,
  last_download_id UUID REFERENCES public.qogita_catalog_downloads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qogita_catalog_items_brand ON public.qogita_catalog_items (brand_name);
CREATE INDEX idx_qogita_catalog_items_last_seen ON public.qogita_catalog_items (last_seen_at);
CREATE INDEX idx_qogita_catalog_items_product ON public.qogita_catalog_items (product_id);

GRANT ALL ON public.qogita_catalog_items TO service_role;
GRANT SELECT ON public.qogita_catalog_items TO authenticated;
ALTER TABLE public.qogita_catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read catalog items"
  ON public.qogita_catalog_items FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_qogita_catalog_downloads_updated_at
  BEFORE UPDATE ON public.qogita_catalog_downloads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_qogita_catalog_items_updated_at
  BEFORE UPDATE ON public.qogita_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();