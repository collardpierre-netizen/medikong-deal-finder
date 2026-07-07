-- Drop older overloads of admin_list_orders keeping only the latest one (with billing_updated_from/to)
DROP FUNCTION IF EXISTS public.admin_list_orders(text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, integer, integer);
DROP FUNCTION IF EXISTS public.admin_list_orders(text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public.admin_list_orders(text, timestamptz, timestamptz, uuid[], text, boolean, text, boolean, boolean, integer, integer, text, text, text, text, text);