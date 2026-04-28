-- Cache mutualisé des traductions live générées par AI
CREATE TABLE IF NOT EXISTS public.translation_cache (
  source_hash text PRIMARY KEY,
  source_lang text NOT NULL,
  target_lang text NOT NULL,
  source_text text NOT NULL,
  translated_text text NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_target_lastused
  ON public.translation_cache (target_lang, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_translation_cache_hits
  ON public.translation_cache (hits DESC);

ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

-- Lecture publique (anon + authenticated) pour bénéficier des traductions déjà payées
DROP POLICY IF EXISTS "translation_cache_public_read" ON public.translation_cache;
CREATE POLICY "translation_cache_public_read"
  ON public.translation_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Pas de policy INSERT/UPDATE/DELETE → seul service_role peut écrire (edge function)

-- RPC sécurisé pour incrémenter les hits sans permission INSERT côté client
CREATE OR REPLACE FUNCTION public.bump_translation_cache_hit(_source_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.translation_cache
  SET hits = hits + 1, last_used_at = now()
  WHERE source_hash = _source_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_translation_cache_hit(text) TO anon, authenticated;