-- 1. Add columns to restock_offers for photos, grading, seller city
ALTER TABLE restock_offers
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS packaging_photos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS seller_city text;

-- Add check constraint for grade
ALTER TABLE restock_offers ADD CONSTRAINT restock_offers_grade_check CHECK (grade IN ('A', 'B', 'C', 'D'));

-- 2. Create restock_settings table
CREATE TABLE IF NOT EXISTS public.restock_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  label text,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.restock_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read restock settings"
  ON public.restock_settings FOR SELECT USING (true);

CREATE POLICY "Admins can manage restock settings"
  ON public.restock_settings FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Insert default settings
INSERT INTO public.restock_settings (key, value, label, description) VALUES
  ('commission_buyer_pct', '5', 'Commission acheteur (%)', 'Pourcentage de commission à charge de l''acheteur (0-20)'),
  ('shipping_margin_pct', '15', 'Marge livraison (%)', 'Marge sur le forfait livraison (0-30)'),
  ('shipping_base_rate_eur_per_kg', '2.50', 'Tarif base livraison (€/kg)', 'Tarif de base par kilogramme'),
  ('shipping_minimum_fee_eur', '8', 'Frais livraison minimum (€)', 'Montant minimum des frais de livraison'),
  ('dlu_minimum_months', '1', 'DLU minimum (mois)', 'Nombre de mois minimum avant expiration'),
  ('exclusivity_days', '14', 'Jours d''exclusivité', 'Durée d''exclusivité après publication'),
  ('cancellation_penalty_eur', '20', 'Pénalité annulation (€)', 'Pénalité si l''acheteur annule après confirmation'),
  ('escrow_release_days', '7', 'Jours avant libération escrow', 'Nombre de jours après livraison pour libérer les fonds'),
  ('exclusivity_text', 'En publiant cette offre, vous vous engagez à ne pas vendre ce lot ailleurs pendant la période d''exclusivité.', 'Texte clause exclusivité', 'Texte affiché lors de l''encodage')
ON CONFLICT (key) DO NOTHING;

-- 3. Create restock_drops table
CREATE TABLE IF NOT EXISTS public.restock_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  theme text,
  offer_ids uuid[] DEFAULT '{}',
  hero_image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.restock_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active drops"
  ON public.restock_drops FOR SELECT USING (true);

CREATE POLICY "Admins can manage drops"
  ON public.restock_drops FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Create restock_questions table
CREATE TABLE IF NOT EXISTS public.restock_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES public.restock_offers(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid,
  seller_id uuid NOT NULL,
  question text NOT NULL,
  answer text,
  asked_at timestamptz DEFAULT now(),
  answered_at timestamptz
);

ALTER TABLE public.restock_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and sellers can read their questions"
  ON public.restock_questions FOR SELECT USING (true);

CREATE POLICY "Anyone can insert questions"
  ON public.restock_questions FOR INSERT WITH CHECK (true);

CREATE POLICY "Sellers can answer questions"
  ON public.restock_questions FOR UPDATE USING (true);

-- 5. Create restock_ratings table
CREATE TABLE IF NOT EXISTS public.restock_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.restock_transactions(id) ON DELETE CASCADE NOT NULL,
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  rater_role text NOT NULL CHECK (rater_role IN ('buyer', 'seller')),
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.restock_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings"
  ON public.restock_ratings FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ratings"
  ON public.restock_ratings FOR INSERT WITH CHECK (true);

-- 6. Update demo data with grades and cities
UPDATE restock_offers SET grade = 'A', seller_city = 'Bruxelles' WHERE product_state = 'intact' AND seller_city IS NULL;
UPDATE restock_offers SET grade = 'B', seller_city = 'Liège' WHERE product_state = 'damaged_packaging' AND seller_city IS NULL;
UPDATE restock_offers SET grade = 'C', seller_city = 'Namur' WHERE product_state = 'near_expiry' AND seller_city IS NULL;

-- Create storage bucket for restock packaging photos
INSERT INTO storage.buckets (id, name, public) VALUES ('restock-photos', 'restock-photos', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view restock photos"
  ON storage.objects FOR SELECT USING (bucket_id = 'restock-photos');

CREATE POLICY "Authenticated users can upload restock photos"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'restock-photos');

CREATE POLICY "Users can delete their restock photos"
  ON storage.objects FOR DELETE USING (bucket_id = 'restock-photos');