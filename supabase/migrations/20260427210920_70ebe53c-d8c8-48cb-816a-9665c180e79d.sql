-- Permettre la lecture publique des offres actives (cohérent avec products)
-- Le masquage des prix HTVA reste géré côté UI via isVerifiedBuyer.
DROP POLICY IF EXISTS "Offers read active public" ON public.offers;
CREATE POLICY "Offers read active public"
  ON public.offers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- L'ancienne policy restreinte à authenticated devient redondante, on la supprime.
DROP POLICY IF EXISTS "Offers read active authenticated" ON public.offers;