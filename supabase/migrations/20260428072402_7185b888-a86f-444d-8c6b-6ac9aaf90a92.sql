-- Permettre la lecture publique de la config (1 seule ligne, pas de donnée sensible)
CREATE POLICY "Public can read site_config"
ON public.site_config
FOR SELECT
TO anon, authenticated
USING (true);

-- S'assurer que la ligne par défaut existe
INSERT INTO public.site_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;