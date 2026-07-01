
-- ============================================================
-- WAVE 4 — Active-account RLS sweep (additive RESTRICTIVE policies)
-- ============================================================
-- Pattern: chaque policy est RESTRICTIVE, donc ANDée avec les
-- policies permissives existantes. Fallback intégré :
--   current_active_account_id() IS NULL  -> pas de header, pass-through
--   current_active_account_kind() <> ...  -> autre type de compte, pass-through
--   is_admin(auth.uid())                  -> admin bypass
-- ============================================================

-- ---------- BUYER-SIDE (SELECT + writes) ----------

DROP POLICY IF EXISTS active_account_buyer_scope ON public.customers;
CREATE POLICY active_account_buyer_scope ON public.customers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR id = public.current_active_account_id()
  )
  WITH CHECK (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR id = public.current_active_account_id()
  );

DROP POLICY IF EXISTS active_account_buyer_scope ON public.cart_items;
CREATE POLICY active_account_buyer_scope ON public.cart_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  )
  WITH CHECK (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  );

DROP POLICY IF EXISTS active_account_buyer_scope ON public.customer_shipping_addresses;
CREATE POLICY active_account_buyer_scope ON public.customer_shipping_addresses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  )
  WITH CHECK (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  );

DROP POLICY IF EXISTS active_account_buyer_scope ON public.orders;
CREATE POLICY active_account_buyer_scope ON public.orders
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  )
  WITH CHECK (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  );

DROP POLICY IF EXISTS active_account_buyer_scope ON public.delegate_callback_requests;
CREATE POLICY active_account_buyer_scope ON public.delegate_callback_requests
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  )
  WITH CHECK (
    public.current_active_account_id() IS NULL
    OR public.current_active_account_kind() <> 'buyer'
    OR public.is_admin(auth.uid())
    OR customer_id = public.current_active_account_id()
  );

-- ---------- VENDOR-SIDE (writes only; reads remain unrestricted) ----------
-- INSERT / UPDATE / DELETE separately so SELECT is not narrowed
-- (protects public catalog reads and cross-vendor read paths).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'offers','order_invoices','order_lines','price_adjustment_log',
    'price_alert_vendors','seller_contracts','shipments','shipping_invoices',
    'rfq_dispatch_log','rfq_reminder_log','rfq_responses'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS active_account_vendor_write_ins ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS active_account_vendor_write_upd ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS active_account_vendor_write_del ON public.%I', t);

    EXECUTE format($p$
      CREATE POLICY active_account_vendor_write_ins ON public.%I
        AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          public.current_active_account_id() IS NULL
          OR public.current_active_account_kind() <> 'vendor'
          OR public.is_admin(auth.uid())
          OR vendor_id = public.current_active_account_id()
        )
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY active_account_vendor_write_upd ON public.%I
        AS RESTRICTIVE FOR UPDATE TO authenticated
        USING (
          public.current_active_account_id() IS NULL
          OR public.current_active_account_kind() <> 'vendor'
          OR public.is_admin(auth.uid())
          OR vendor_id = public.current_active_account_id()
        )
        WITH CHECK (
          public.current_active_account_id() IS NULL
          OR public.current_active_account_kind() <> 'vendor'
          OR public.is_admin(auth.uid())
          OR vendor_id = public.current_active_account_id()
        )
    $p$, t);

    EXECUTE format($p$
      CREATE POLICY active_account_vendor_write_del ON public.%I
        AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          public.current_active_account_id() IS NULL
          OR public.current_active_account_kind() <> 'vendor'
          OR public.is_admin(auth.uid())
          OR vendor_id = public.current_active_account_id()
        )
    $p$, t);
  END LOOP;
END $$;
