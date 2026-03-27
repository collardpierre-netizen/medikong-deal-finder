
-- =============================================
-- SECURITY DEFINER FUNCTION for admin role checks
-- =============================================
CREATE OR REPLACE FUNCTION public.get_admin_role(_user_id uuid)
RETURNS admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_users WHERE user_id = _user_id AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id AND role = 'super_admin' AND is_active = true);
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- ADMIN_USERS: only super_admins can manage, admins can read
CREATE POLICY "Super admins full access" ON public.admin_users FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Admins can read admin_users" ON public.admin_users FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- VENDORS: public read, vendors manage own, admins full
CREATE POLICY "Vendors publicly readable" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Vendors manage own profile" ON public.vendors FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Vendors insert own" ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- MANUFACTURERS: public read, admin write
CREATE POLICY "Manufacturers publicly readable" ON public.manufacturers FOR SELECT USING (true);
CREATE POLICY "Admins manage manufacturers" ON public.manufacturers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- BRANDS: public read, admin write
CREATE POLICY "Brands publicly readable" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Admins manage brands" ON public.brands FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- CATEGORIES: public read, admin write
CREATE POLICY "Categories publicly readable" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- PRODUCTS: keep existing public read, add admin write
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- OFFERS_DIRECT: public read, vendor manage own, admin full
CREATE POLICY "Offers direct publicly readable" ON public.offers_direct FOR SELECT USING (true);
CREATE POLICY "Vendors manage own offers" ON public.offers_direct FOR ALL TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage offers direct" ON public.offers_direct FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- OFFERS_INDIRECT: admin only
CREATE POLICY "Admins manage offers indirect" ON public.offers_indirect FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Offers indirect publicly readable" ON public.offers_indirect FOR SELECT USING (true);

-- OFFERS_MARKET: admin read/write, public read
CREATE POLICY "Offers market publicly readable" ON public.offers_market FOR SELECT USING (true);
CREATE POLICY "Admins manage offers market" ON public.offers_market FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- BUYERS: own read, admin full
CREATE POLICY "Buyers read own" ON public.buyers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Buyers insert own" ON public.buyers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage buyers" ON public.buyers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- ORDERS: existing policies + admin read
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- DISPUTES: admin + involved parties
CREATE POLICY "Admins manage disputes" ON public.disputes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Involved parties read disputes" ON public.disputes FOR SELECT TO authenticated
  USING (
    buyer_id IN (SELECT id FROM public.buyers WHERE user_id = auth.uid())
    OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- COMPLIANCE_RECORDS: public read, admin write
CREATE POLICY "Compliance publicly readable" ON public.compliance_records FOR SELECT USING (true);
CREATE POLICY "Admins manage compliance" ON public.compliance_records FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- VENDOR_ONBOARDING: vendor own + admin
CREATE POLICY "Vendor reads own onboarding" ON public.vendor_onboarding FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage onboarding" ON public.vendor_onboarding FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- IMPORT_JOBS: admin only
CREATE POLICY "Admins manage import jobs" ON public.import_jobs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- INVOICES: admin + comptable read, admin write
CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- LEADS_PARTNERS: admin only
CREATE POLICY "Admins manage leads partners" ON public.leads_partners FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- AUDIT_LOGS: admin read, system write
CREATE POLICY "Admins read audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "System inserts audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
