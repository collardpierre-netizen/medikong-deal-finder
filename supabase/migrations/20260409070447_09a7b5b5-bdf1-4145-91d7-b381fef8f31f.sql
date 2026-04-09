
-- 1. Vendors: restrict to authenticated + create safe public view
DROP POLICY IF EXISTS "Vendors publicly readable" ON public.vendors;

CREATE POLICY "Vendors readable by authenticated"
ON public.vendors FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE VIEW public.public_vendors AS
SELECT id, name, slug, description, logo_url, is_active
FROM public.vendors
WHERE is_active = true;

GRANT SELECT ON public.public_vendors TO anon;

-- 2. restock_ratings: remove permissive public INSERT + duplicate SELECT
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.restock_ratings;
DROP POLICY IF EXISTS "Anyone can read ratings" ON public.restock_ratings;

-- 3. Offers: restrict to authenticated + safe public view
DROP POLICY IF EXISTS "Offers read active" ON public.offers;

CREATE POLICY "Offers read active authenticated"
ON public.offers FOR SELECT
TO authenticated
USING (is_active = true);

CREATE OR REPLACE VIEW public.public_offers AS
SELECT id, product_id, vendor_id, price_excl_vat, price_incl_vat,
       vat_rate, stock_quantity, stock_status, moq, mov, mov_amount, mov_currency,
       delivery_days, min_delivery_days, max_delivery_days, estimated_delivery_days,
       shipping_from_country, country_code, is_active, is_top_seller,
       has_extended_delivery, down_payment_pct, created_at, updated_at
FROM public.offers
WHERE is_active = true;

GRANT SELECT ON public.public_offers TO anon, authenticated;

-- 4. Email-assets: add admin check
DROP POLICY IF EXISTS "Admin upload access for email assets" ON storage.objects;

CREATE POLICY "Admin upload access for email assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND public.is_admin(auth.uid())
);

-- 5. external_leads: restrict INSERT to authenticated
DROP POLICY IF EXISTS "external_leads_insert" ON public.external_leads;

CREATE POLICY "external_leads_insert_authenticated"
ON public.external_leads FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Fix search_path on email queue functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- 7. Move pg_trgm from public to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
