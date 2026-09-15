-- =====================================================================
-- MediKong Care — catalogue/prix + transactionnel
-- FK produits : public.products (prod) — pas products_simple (dev)
-- FK commande marketplace : public.orders
-- =====================================================================

-- ------------------------------------------------- CATALOGUE & PRIX
CREATE TABLE IF NOT EXISTS public.nh_product_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  available_for_nursing_homes boolean DEFAULT false,
  billing_type public.nh_billing_type DEFAULT 'RESIDENT',
  mr_min_qty integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_product_settings TO authenticated;
GRANT ALL ON public.nh_product_settings TO service_role;
ALTER TABLE public.nh_product_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_product_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  billing_type text,
  fixed_price numeric(10,2),
  margin_rule_pct numeric(6,2),
  current_purchase_price numeric(10,2),
  min_order_qty integer,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (nursing_home_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_product_pricing TO authenticated;
GRANT ALL ON public.nh_product_pricing TO service_role;
ALTER TABLE public.nh_product_pricing ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_product_activation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nursing_home_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_product_activation TO authenticated;
GRANT ALL ON public.nh_product_activation TO service_role;
ALTER TABLE public.nh_product_activation ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_group_product_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.nh_groups(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  billing_type text NOT NULL DEFAULT 'FACILITY',
  fixed_price numeric(10,2),
  margin_rule_pct numeric(6,2),
  current_purchase_price numeric(10,2),
  min_order_qty integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (group_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_group_product_settings TO authenticated;
GRANT ALL ON public.nh_group_product_settings TO service_role;
ALTER TABLE public.nh_group_product_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_group_category_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.nh_groups(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'category',
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  universe_id uuid,
  billing_type text,
  margin_split_pct numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_group_category_settings TO authenticated;
GRANT ALL ON public.nh_group_category_settings TO service_role;
ALTER TABLE public.nh_group_category_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------- TRANSACTIONNEL
CREATE TABLE IF NOT EXISTS public.nh_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE
    DEFAULT 'NH-' || to_char(now(),'YYYYMMDD') || '-' || lpad(floor(random()*10000)::text,4,'0'),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE RESTRICT,
  room_id uuid REFERENCES public.nh_rooms(id) ON DELETE SET NULL,
  resident_id uuid REFERENCES public.nh_residents(id) ON DELETE SET NULL,
  ordered_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ordered_by_name text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  is_urgent boolean DEFAULT false,
  urgent_cost numeric(10,2) DEFAULT 0,
  shipping_cost numeric(10,2) DEFAULT 0,
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  resident_total_ht numeric(10,2) DEFAULT 0,
  resident_total_ttc numeric(10,2) DEFAULT 0,
  facility_total_ht numeric(10,2) DEFAULT 0,
  facility_total_ttc numeric(10,2) DEFAULT 0,
  notes text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_orders TO authenticated;
GRANT ALL ON public.nh_orders TO service_role;
ALTER TABLE public.nh_orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE RESTRICT,
  resident_id uuid REFERENCES public.nh_residents(id) ON DELETE SET NULL,
  invoice_type text NOT NULL DEFAULT 'resident',
  -- numéro attribué UNIQUEMENT au passage brouillon -> émise,
  -- via public.generate_document_number('INV-R')
  invoice_number text,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  billing_name text NOT NULL,
  billing_address text,
  billing_city text,
  billing_postal_code text,
  billing_country text DEFAULT 'BE',
  billing_email text,
  billing_vat_number text,
  total_ht numeric(10,2) NOT NULL DEFAULT 0,
  total_tva numeric(10,2) NOT NULL DEFAULT 0,
  total_ttc numeric(10,2) NOT NULL DEFAULT 0,
  file_url text,
  notes text,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS nh_invoices_invoice_number_key
  ON public.nh_invoices(invoice_number) WHERE invoice_number IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_invoices TO authenticated;
GRANT ALL ON public.nh_invoices TO service_role;
ALTER TABLE public.nh_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.nh_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  custom_description text,
  billing_type public.nh_billing_type NOT NULL,
  resident_id uuid REFERENCES public.nh_residents(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.nh_invoices(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_ht numeric(10,2) NOT NULL,
  vat_rate numeric(5,2),
  total_ht numeric(10,2) NOT NULL,
  total_tva numeric(10,2) NOT NULL,
  total_ttc numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_order_items TO authenticated;
GRANT ALL ON public.nh_order_items TO service_role;
ALTER TABLE public.nh_order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.nh_invoices(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.nh_orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.nh_order_items(id) ON DELETE SET NULL,
  product_code text,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_ht numeric(10,2) NOT NULL,
  vat_rate numeric(5,2) NOT NULL DEFAULT 21,
  total_ht numeric(10,2) NOT NULL,
  total_tva numeric(10,2) NOT NULL,
  total_ttc numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_invoice_lines TO authenticated;
GRANT ALL ON public.nh_invoice_lines TO service_role;
ALTER TABLE public.nh_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_order_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid NOT NULL REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.nh_groups(id) ON DELETE SET NULL,
  date date NOT NULL,
  total_orders integer DEFAULT 0,
  total_items integer DEFAULT 0,
  unique_residents integer DEFAULT 0,
  total_revenue_ht numeric(12,2) DEFAULT 0,
  resident_revenue_ht numeric(12,2) DEFAULT 0,
  facility_revenue_ht numeric(12,2) DEFAULT 0,
  savings_vs_public numeric(12,2) DEFAULT 0,
  category_breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nursing_home_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nh_order_analytics TO authenticated;
GRANT ALL ON public.nh_order_analytics TO service_role;
ALTER TABLE public.nh_order_analytics ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nh_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nursing_home_id uuid REFERENCES public.nursing_homes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.nh_audit_logs TO authenticated;
GRANT ALL ON public.nh_audit_logs TO service_role;
ALTER TABLE public.nh_audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------- TRIGGERS
DROP TRIGGER IF EXISTS trg_nh_product_settings_updated ON public.nh_product_settings;
CREATE TRIGGER trg_nh_product_settings_updated BEFORE UPDATE ON public.nh_product_settings
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_product_pricing_updated ON public.nh_product_pricing;
CREATE TRIGGER trg_nh_product_pricing_updated BEFORE UPDATE ON public.nh_product_pricing
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_group_product_settings_updated ON public.nh_group_product_settings;
CREATE TRIGGER trg_nh_group_product_settings_updated BEFORE UPDATE ON public.nh_group_product_settings
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_group_category_settings_updated ON public.nh_group_category_settings;
CREATE TRIGGER trg_nh_group_category_settings_updated BEFORE UPDATE ON public.nh_group_category_settings
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_orders_updated ON public.nh_orders;
CREATE TRIGGER trg_nh_orders_updated BEFORE UPDATE ON public.nh_orders
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_invoices_updated ON public.nh_invoices;
CREATE TRIGGER trg_nh_invoices_updated BEFORE UPDATE ON public.nh_invoices
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

DROP TRIGGER IF EXISTS trg_nh_order_analytics_updated ON public.nh_order_analytics;
CREATE TRIGGER trg_nh_order_analytics_updated BEFORE UPDATE ON public.nh_order_analytics
FOR EACH ROW EXECUTE FUNCTION public.nh_update_updated_at();

-- =====================================================================
-- POLICIES
-- =====================================================================
CREATE POLICY "Super admins can manage NH product settings" ON public.nh_product_settings
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view NH product settings" ON public.nh_product_settings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_user_roles r WHERE r.user_id = auth.uid() AND r.is_active = true)
       OR EXISTS (SELECT 1 FROM public.nh_group_user_roles g WHERE g.user_id = auth.uid() AND g.is_active = true));

CREATE POLICY "Super admins can manage NH pricing" ON public.nh_product_pricing
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view pricing" ON public.nh_product_pricing
FOR SELECT TO authenticated
USING (nursing_home_id IS NULL OR public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH admins can manage their pricing" ON public.nh_product_pricing
FOR ALL TO authenticated
USING (nursing_home_id IS NOT NULL AND public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (nursing_home_id IS NOT NULL AND public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins can manage product activation" ON public.nh_product_activation
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view product activation" ON public.nh_product_activation
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH admins can manage product activation" ON public.nh_product_activation
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins can manage group product settings" ON public.nh_group_product_settings
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "Group members can view group product settings" ON public.nh_group_product_settings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_product_settings.group_id AND g.user_id = auth.uid() AND g.is_active = true)
       OR EXISTS (SELECT 1 FROM public.nh_user_roles nu
                  JOIN public.nursing_homes nh ON nh.id = nu.nursing_home_id
                  WHERE nu.user_id = auth.uid() AND nu.is_active = true AND nh.group_id = nh_group_product_settings.group_id));

CREATE POLICY "Group admins can manage group product settings" ON public.nh_group_product_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_product_settings.group_id AND g.user_id = auth.uid()
                 AND g.is_active = true AND g.role = 'admin_groupe'))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_product_settings.group_id AND g.user_id = auth.uid()
                 AND g.is_active = true AND g.role = 'admin_groupe'));

CREATE POLICY "Super admins can manage group category settings" ON public.nh_group_category_settings
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "Group members can view group category settings" ON public.nh_group_category_settings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_category_settings.group_id AND g.user_id = auth.uid() AND g.is_active = true)
       OR EXISTS (SELECT 1 FROM public.nh_user_roles nu
                  JOIN public.nursing_homes nh ON nh.id = nu.nursing_home_id
                  WHERE nu.user_id = auth.uid() AND nu.is_active = true AND nh.group_id = nh_group_category_settings.group_id));

CREATE POLICY "Group admins can manage group category settings" ON public.nh_group_category_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_category_settings.group_id AND g.user_id = auth.uid()
                 AND g.is_active = true AND g.role = 'admin_groupe'))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_group_user_roles g
               WHERE g.group_id = nh_group_category_settings.group_id AND g.user_id = auth.uid()
                 AND g.is_active = true AND g.role = 'admin_groupe'));

-- Commandes : lecture pour tout rôle actif (soignant, admin_mr, comptabilite),
-- création pour soignant/admin_mr, mise à jour admin_mr, tout pour SUPERADMIN
CREATE POLICY "NH users can view orders" ON public.nh_orders
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH users can create orders" ON public.nh_orders
FOR INSERT TO authenticated
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'soignant')
            OR public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "NH admins can update orders" ON public.nh_orders
FOR UPDATE TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins can manage all orders" ON public.nh_orders
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view order items" ON public.nh_order_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_orders o
               WHERE o.id = order_id AND public.has_any_nh_role(auth.uid(), o.nursing_home_id)));

CREATE POLICY "NH users can insert order items" ON public.nh_order_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_orders o
               WHERE o.id = order_id
                 AND (public.has_nh_role(auth.uid(), o.nursing_home_id, 'soignant')
                      OR public.has_nh_role(auth.uid(), o.nursing_home_id, 'admin_mr'))));

CREATE POLICY "Super admins can manage all order items" ON public.nh_order_items
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

-- Factures : lecture pour tout rôle actif (dont comptabilite),
-- écriture réservée admin_mr / comptabilite, tout pour SUPERADMIN
CREATE POLICY "NH users can view invoices" ON public.nh_invoices
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH accounting can manage invoices" ON public.nh_invoices
FOR ALL TO authenticated
USING (public.has_nh_role(auth.uid(), nursing_home_id, 'comptabilite')
       OR public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'))
WITH CHECK (public.has_nh_role(auth.uid(), nursing_home_id, 'comptabilite')
       OR public.has_nh_role(auth.uid(), nursing_home_id, 'admin_mr'));

CREATE POLICY "Super admins can manage all invoices" ON public.nh_invoices
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view invoice lines" ON public.nh_invoice_lines
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_invoices i
               WHERE i.id = invoice_id AND public.has_any_nh_role(auth.uid(), i.nursing_home_id)));

CREATE POLICY "NH accounting can manage invoice lines" ON public.nh_invoice_lines
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.nh_invoices i
               WHERE i.id = invoice_id
                 AND (public.has_nh_role(auth.uid(), i.nursing_home_id, 'comptabilite')
                      OR public.has_nh_role(auth.uid(), i.nursing_home_id, 'admin_mr'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.nh_invoices i
               WHERE i.id = invoice_id
                 AND (public.has_nh_role(auth.uid(), i.nursing_home_id, 'comptabilite')
                      OR public.has_nh_role(auth.uid(), i.nursing_home_id, 'admin_mr'))));

CREATE POLICY "Super admins can manage all invoice lines" ON public.nh_invoice_lines
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view analytics" ON public.nh_order_analytics
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "Super admins can manage analytics" ON public.nh_order_analytics
FOR ALL TO authenticated
USING (public.is_nh_super_admin(auth.uid())) WITH CHECK (public.is_nh_super_admin(auth.uid()));

CREATE POLICY "NH users can view audit logs" ON public.nh_audit_logs
FOR SELECT TO authenticated USING (public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "NH users can insert audit logs" ON public.nh_audit_logs
FOR INSERT TO authenticated
WITH CHECK (nursing_home_id IS NULL OR public.has_any_nh_role(auth.uid(), nursing_home_id));

CREATE POLICY "Super admins can view all audit logs" ON public.nh_audit_logs
FOR SELECT TO authenticated USING (public.is_nh_super_admin(auth.uid()));

-- ---------------------------------------------------------------- INDEX
CREATE INDEX IF NOT EXISTS idx_nh_product_pricing_nh ON public.nh_product_pricing(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_product_pricing_product ON public.nh_product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_nh_product_activation_nh ON public.nh_product_activation(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_group_product_settings_group ON public.nh_group_product_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_nh_group_category_settings_group ON public.nh_group_category_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_nh_orders_nh ON public.nh_orders(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_orders_resident ON public.nh_orders(resident_id);
CREATE INDEX IF NOT EXISTS idx_nh_orders_marketplace ON public.nh_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_nh_order_items_order ON public.nh_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_nh_order_items_invoice ON public.nh_order_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_nh_invoices_nh ON public.nh_invoices(nursing_home_id);
CREATE INDEX IF NOT EXISTS idx_nh_invoices_resident ON public.nh_invoices(resident_id);
CREATE INDEX IF NOT EXISTS idx_nh_invoice_lines_invoice ON public.nh_invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_nh_order_analytics_nh_date ON public.nh_order_analytics(nursing_home_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_nh_audit_logs_nh ON public.nh_audit_logs(nursing_home_id, created_at DESC);