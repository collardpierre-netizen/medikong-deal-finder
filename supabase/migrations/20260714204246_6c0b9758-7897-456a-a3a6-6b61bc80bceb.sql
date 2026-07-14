CREATE TABLE public.geocode_cache (
  cache_key text PRIMARY KEY,
  country_code text,
  postal_code text,
  city text,
  query text NOT NULL,
  lat double precision,
  lng double precision,
  provider text NOT NULL DEFAULT 'nominatim',
  hit_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read geocode cache"
  ON public.geocode_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_geocode_cache_updated_at
  BEFORE UPDATE ON public.geocode_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_geocode_cache_last_used ON public.geocode_cache(last_used_at DESC);