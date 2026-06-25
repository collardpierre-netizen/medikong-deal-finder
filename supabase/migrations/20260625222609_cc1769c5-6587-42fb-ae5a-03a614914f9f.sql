
-- ─── 1 & 2. delegates / vendor_delegates ────────────────────────────────────
DROP POLICY IF EXISTS "Verified buyers or admins view visible delegates" ON public.delegates;
DROP POLICY IF EXISTS "Verified buyers read active delegates" ON public.vendor_delegates;

CREATE OR REPLACE FUNCTION public.list_vendor_delegates_public(_vendor_id uuid)
RETURNS TABLE (
  id uuid, vendor_id uuid, first_name text, last_name text, job_title text,
  booking_url text, photo_url text, bio text,
  languages text[], country_codes text[], regions text[], postal_codes text[],
  target_profiles text[], primary_target_profiles text[],
  is_active boolean, display_order int, email text, phone text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.vendor_id, d.first_name, d.last_name, d.job_title,
         d.booking_url, d.photo_url, d.bio, d.languages, d.country_codes,
         d.regions, d.postal_codes, d.target_profiles, d.primary_target_profiles,
         d.is_active, d.display_order, NULL::text, NULL::text
  FROM public.vendor_delegates d
  WHERE d.vendor_id = _vendor_id AND d.is_active = true
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = d.vendor_id AND v.auth_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = auth.uid() AND c.is_verified = true)
    )
  ORDER BY d.display_order ASC;
$$;
REVOKE ALL ON FUNCTION public.list_vendor_delegates_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_vendor_delegates_public(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vendor_delegate_public(_id uuid)
RETURNS TABLE (
  id uuid, vendor_id uuid, first_name text, last_name text, job_title text,
  booking_url text, photo_url text, bio text,
  languages text[], country_codes text[], regions text[], postal_codes text[],
  target_profiles text[], primary_target_profiles text[],
  is_active boolean, display_order int, email text, phone text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.vendor_id, d.first_name, d.last_name, d.job_title,
         d.booking_url, d.photo_url, d.bio, d.languages, d.country_codes,
         d.regions, d.postal_codes, d.target_profiles, d.primary_target_profiles,
         d.is_active, d.display_order, NULL::text, NULL::text
  FROM public.vendor_delegates d
  WHERE d.id = _id AND d.is_active = true
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = d.vendor_id AND v.auth_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = auth.uid() AND c.is_verified = true)
    );
$$;
REVOKE ALL ON FUNCTION public.get_vendor_delegate_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_delegate_public(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vendor_delegate_contact(_id uuid)
RETURNS TABLE (email text, phone text, first_name text, last_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _allowed boolean;
BEGIN
  SELECT (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.vendor_delegates d
               JOIN public.vendors v ON v.id = d.vendor_id
               WHERE d.id = _id AND v.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = auth.uid() AND c.is_verified = true)
  ) INTO _allowed;
  IF NOT _allowed THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  BEGIN
    PERFORM public.log_security_event(
      'vendor_delegate_contact_access', 'info',
      jsonb_build_object('delegate_id', _id)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN QUERY
  SELECT d.email, d.phone, d.first_name, d.last_name
  FROM public.vendor_delegates d
  WHERE d.id = _id AND d.is_active = true;
END;
$$;
REVOKE ALL ON FUNCTION public.get_vendor_delegate_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_delegate_contact(uuid) TO authenticated;


-- ─── 3. external_offers : restrict SELECT to verified buyers / admins ──────
DROP POLICY IF EXISTS external_offers_read_authenticated ON public.external_offers;
CREATE POLICY external_offers_read_verified
  ON public.external_offers FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = auth.uid() AND c.is_verified = true)
  );


-- ─── 4. restock_transactions : view-based access for sellers (no PII) ──────
DROP POLICY IF EXISTS "Sellers see own transactions" ON public.restock_transactions;

CREATE OR REPLACE VIEW public.restock_seller_transactions_v
WITH (security_invoker = true) AS
SELECT
  rt.id, rt.offer_id, rt.seller_id, rt.buyer_id, rt.status,
  rt.quantity, rt.final_price, rt.commission_rate, rt.commission_amount,
  rt.shipping_cost, rt.delivery_mode,
  rt.created_at, rt.updated_at, rt.paid_at, rt.delivered_at,
  rt.escrow_released_at, rt.pickup_deadline_at, rt.pickup_confirmed_at,
  rt.tracking_number, rt.tracking_url, rt.sendcloud_parcel_id,
  rt.dispute_reason, rt.penalty_applied, rt.cancelled_reason,
  rt.buyer_name, rt.buyer_company, rt.buyer_street, rt.buyer_city,
  rt.buyer_postal_code, rt.buyer_country,
  rt.pickup_handover_code, rt.pickup_qr_token,
  rt.seller_pickup_address, rt.seller_pickup_city, rt.seller_pickup_phone
FROM public.restock_transactions rt;

GRANT SELECT ON public.restock_seller_transactions_v TO authenticated;

CREATE POLICY "Sellers read own transactions"
  ON public.restock_transactions FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

CREATE OR REPLACE FUNCTION public.restock_get_buyer_contact_for_seller(_tx_id uuid)
RETURNS TABLE (buyer_email text, buyer_phone text, buyer_vat_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restock_transactions t
    WHERE t.id = _tx_id
      AND (t.seller_id = auth.uid() OR public.is_admin(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  BEGIN
    PERFORM public.log_security_event(
      'restock_buyer_contact_access', 'info',
      jsonb_build_object('tx_id', _tx_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN QUERY
  SELECT t.buyer_email, t.buyer_phone, t.buyer_vat_number
  FROM public.restock_transactions t WHERE t.id = _tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public.restock_get_buyer_contact_for_seller(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restock_get_buyer_contact_for_seller(uuid) TO authenticated;


-- ─── 5. savings-uploads bucket: admin DELETE/UPDATE policies ───────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='savings-uploads admin delete') THEN
    CREATE POLICY "savings-uploads admin delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'savings-uploads' AND public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='savings-uploads admin update') THEN
    CREATE POLICY "savings-uploads admin update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'savings-uploads' AND public.is_admin(auth.uid()))
      WITH CHECK (bucket_id = 'savings-uploads' AND public.is_admin(auth.uid()));
  END IF;
END $$;
