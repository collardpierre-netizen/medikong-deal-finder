
-- Favorites: users can favorite products
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Favorite lists: custom user lists
CREATE TABLE public.favorite_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Ma liste',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.favorite_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lists" ON public.favorite_lists
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Items in favorite lists
CREATE TABLE public.favorite_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.favorite_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, product_id)
);

ALTER TABLE public.favorite_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own list items" ON public.favorite_list_items
  FOR ALL TO authenticated
  USING (list_id IN (SELECT id FROM public.favorite_lists WHERE user_id = auth.uid()))
  WITH CHECK (list_id IN (SELECT id FROM public.favorite_lists WHERE user_id = auth.uid()));

-- Recent activity tracking
CREATE TABLE public.recent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'view_product', 'search', 'add_to_cart', 'order'
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recent_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activity" ON public.recent_activity
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for performance
CREATE INDEX idx_favorites_user ON public.favorites(user_id);
CREATE INDEX idx_favorite_lists_user ON public.favorite_lists(user_id);
CREATE INDEX idx_recent_activity_user ON public.recent_activity(user_id, created_at DESC);
