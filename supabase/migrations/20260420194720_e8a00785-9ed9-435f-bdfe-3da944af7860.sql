-- Shadow table miroir de offer_price_tiers pour dry-run sans toucher la prod
CREATE TABLE IF NOT EXISTS public.offer_price_tiers_shadow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  tier_index integer NOT NULL,
  mov_threshold numeric NOT NULL,
  qogita_unit_price numeric NOT NULL,
  price_excl_vat numeric NOT NULL,
  price_incl_vat numeric NOT NULL,
  margin_amount numeric,
  mov_currency text DEFAULT 'EUR',
  mov_progress numeric,
  is_active boolean DEFAULT true,
  cohort text NOT NULL,
  qogita_payload_sample jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opt_shadow_offer ON public.offer_price_tiers_shadow(offer_id);
CREATE INDEX IF NOT EXISTS idx_opt_shadow_cohort ON public.offer_price_tiers_shadow(cohort);

ALTER TABLE public.offer_price_tiers_shadow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read shadow tiers"
ON public.offer_price_tiers_shadow FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));