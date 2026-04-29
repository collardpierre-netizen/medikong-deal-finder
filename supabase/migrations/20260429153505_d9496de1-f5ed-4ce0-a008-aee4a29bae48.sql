CREATE OR REPLACE FUNCTION public.resolve_buyer_profile_for_user(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN pt.name ILIKE '%pharmacie%' THEN 'pharmacie_independante'
    WHEN pt.name ILIKE '%hopital%' OR pt.name ILIKE '%hôpital%' OR pt.name ILIKE '%clinique%' OR pt.name ILIKE '%mrs%' OR pt.name ILIKE '%maison de repos%' THEN 'hopital'
    ELSE 'autre'
  END
  FROM public.profiles p
  LEFT JOIN public.profession_types pt ON pt.id = p.profession_type_id
  WHERE p.user_id = _user_id
  UNION ALL
  SELECT 'autre'
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_buyer_profile_for_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_buyer_profile_for_user(uuid) TO authenticated;