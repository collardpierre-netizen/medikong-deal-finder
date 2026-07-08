-- Activer la Belgique pour tous les vendeurs qui ne l'ont pas encore dans ships_to_countries
UPDATE public.vendors
SET ships_to_countries = 
  CASE 
    WHEN ships_to_countries IS NULL OR array_length(ships_to_countries, 1) IS NULL THEN ARRAY['BE']
    WHEN NOT ('BE' = ANY(ships_to_countries)) THEN array_append(ships_to_countries, 'BE')
    ELSE ships_to_countries
  END
WHERE ships_to_countries IS NULL 
   OR array_length(ships_to_countries, 1) IS NULL 
   OR NOT ('BE' = ANY(ships_to_countries));