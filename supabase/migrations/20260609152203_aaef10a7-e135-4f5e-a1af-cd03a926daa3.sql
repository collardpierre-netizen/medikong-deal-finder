
-- ============================================================================
-- 1) offer_price_tiers: hide sensitive columns from anon/authenticated
-- ============================================================================
REVOKE SELECT ON public.offer_price_tiers FROM anon;
REVOKE SELECT ON public.offer_price_tiers FROM authenticated;

GRANT SELECT (
  id, offer_id, tier_index, mov_threshold, mov_currency,
  price_excl_vat, price_incl_vat, is_active, mov_progress, created_at
) ON public.offer_price_tiers TO anon, authenticated;

-- service_role keeps full access (granted by default via ALL grant earlier);
-- ensure it explicitly:
GRANT ALL ON public.offer_price_tiers TO service_role;

-- ============================================================================
-- 2) realtime.messages: restrict subscriptions to own topics
-- ============================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read own realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated users read own realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    realtime.topic() LIKE 'vendor-price-alerts-%'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
        AND v.id::text = substring(realtime.topic() from 'vendor-price-alerts-(.+)$')
    )
  )
  OR (
    realtime.topic() LIKE 'import-job-%'
    AND EXISTS (
      SELECT 1 FROM public.import_jobs ij
      WHERE ij.user_id = auth.uid()
        AND realtime.topic() LIKE ('import-job-' || ij.id::text || '-%')
    )
  )
);
