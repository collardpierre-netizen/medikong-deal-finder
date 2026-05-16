DROP TRIGGER IF EXISTS update_order_lines_updated_at ON public.order_lines;

CREATE TRIGGER update_order_lines_updated_at
BEFORE UPDATE ON public.order_lines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();