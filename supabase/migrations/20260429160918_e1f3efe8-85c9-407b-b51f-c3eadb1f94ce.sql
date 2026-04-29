ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_profile_id text REFERENCES public.buyer_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_buyer_profile_id 
  ON public.profiles(buyer_profile_id) 
  WHERE buyer_profile_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.buyer_profile_id IS 
  'Profil acheteur explicite utilisé pour résoudre les prix par profil via offer_buyer_profile_prices et la RPC resolve_offer_price_for_profile.';