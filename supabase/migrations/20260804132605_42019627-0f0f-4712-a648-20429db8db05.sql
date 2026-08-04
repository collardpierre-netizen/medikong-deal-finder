SELECT * FROM public.flag_low_price_outliers();
GRANT EXECUTE ON FUNCTION public.flag_low_price_outliers(uuid[]) TO postgres;