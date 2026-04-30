CREATE OR REPLACE FUNCTION public.rfq_routing_self_test_admin()
RETURNS TABLE(scenario text, expected int, actual int, ok boolean, details text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY SELECT * FROM public.rfq_routing_self_test();
END;
$$;

REVOKE ALL ON FUNCTION public.rfq_routing_self_test_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rfq_routing_self_test_admin() TO authenticated;