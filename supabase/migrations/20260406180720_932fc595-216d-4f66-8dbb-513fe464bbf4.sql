
-- Function to delete user account (GDPR compliant)
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow users to delete their own account
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Delete user data from all tables
  DELETE FROM public.product_alerts WHERE user_id = _user_id;
  DELETE FROM public.favorite_list_items WHERE list_id IN (SELECT id FROM public.favorite_lists WHERE user_id = _user_id);
  DELETE FROM public.favorite_lists WHERE user_id = _user_id;
  DELETE FROM public.favorites WHERE user_id = _user_id;
  DELETE FROM public.cart_items WHERE customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = _user_id);
  DELETE FROM public.customers WHERE auth_user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- Delete auth user (cascades sessions etc.)
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
