-- Table de liaison offre <-> catégories MediKong (visibilité multi-catégories)
CREATE TABLE IF NOT EXISTS public.offer_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_categories_offer ON public.offer_categories(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_categories_category ON public.offer_categories(category_id);

ALTER TABLE public.offer_categories ENABLE ROW LEVEL SECURITY;

-- Lecture publique (la visibilité de l'offre est déjà gouvernée par offers.is_active)
CREATE POLICY "Offer categories readable by all"
  ON public.offer_categories FOR SELECT
  USING (true);

-- Vendeurs gèrent les liaisons de leurs propres offres
CREATE POLICY "Vendors manage own offer categories"
  ON public.offer_categories FOR ALL
  USING (
    offer_id IN (
      SELECT o.id FROM public.offers o
      JOIN public.vendors v ON v.id = o.vendor_id
      WHERE v.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    offer_id IN (
      SELECT o.id FROM public.offers o
      JOIN public.vendors v ON v.id = o.vendor_id
      WHERE v.auth_user_id = auth.uid()
    )
  );

-- Admins gèrent toutes les liaisons
CREATE POLICY "Admins manage offer categories"
  ON public.offer_categories FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Service role
CREATE POLICY "Service role manages offer categories"
  ON public.offer_categories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');