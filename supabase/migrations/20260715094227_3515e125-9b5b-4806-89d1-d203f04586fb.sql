
-- History of order status / payment_status changes
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID NULL,
  field TEXT NOT NULL CHECK (field IN ('status', 'payment_status')),
  old_value TEXT NULL,
  new_value TEXT NULL,
  source TEXT NULL,
  note TEXT NULL
);

CREATE INDEX order_status_history_order_id_idx ON public.order_status_history(order_id, changed_at DESC);

GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "Admins can view all order status history"
ON public.order_status_history FOR SELECT TO authenticated
USING (public.is_admin());

-- Customers / vendors who can already see the order can see its history
CREATE POLICY "Users can view history of their orders"
ON public.order_status_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND (
        o.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.order_lines ol
          JOIN public.vendors v ON v.id = ol.vendor_id
          WHERE ol.order_id = o.id AND v.auth_user_id = auth.uid()
        )
      )
  )
);

-- Trigger to capture status / payment_status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NOT NULL THEN
      INSERT INTO public.order_status_history(order_id, field, old_value, new_value, changed_by, source)
      VALUES (NEW.id, 'status', NULL, NEW.status, auth.uid(), 'insert');
    END IF;
    IF NEW.payment_status IS NOT NULL THEN
      INSERT INTO public.order_status_history(order_id, field, old_value, new_value, changed_by, source)
      VALUES (NEW.id, 'payment_status', NULL, NEW.payment_status, auth.uid(), 'insert');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history(order_id, field, old_value, new_value, changed_by, source)
    VALUES (NEW.id, 'status', OLD.status, NEW.status, auth.uid(), 'update');
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.order_status_history(order_id, field, old_value, new_value, changed_by, source)
    VALUES (NEW.id, 'payment_status', OLD.payment_status, NEW.payment_status, auth.uid(), 'update');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
AFTER INSERT OR UPDATE OF status, payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Seed current state as a baseline entry so timelines are not empty for existing orders
INSERT INTO public.order_status_history(order_id, field, old_value, new_value, changed_at, source)
SELECT o.id, 'status', NULL, o.status, COALESCE(o.created_at, now()), 'baseline'
FROM public.orders o
WHERE o.status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.order_status_history h
    WHERE h.order_id = o.id AND h.field = 'status'
  );

INSERT INTO public.order_status_history(order_id, field, old_value, new_value, changed_at, source)
SELECT o.id, 'payment_status', NULL, o.payment_status, COALESCE(o.created_at, now()), 'baseline'
FROM public.orders o
WHERE o.payment_status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.order_status_history h
    WHERE h.order_id = o.id AND h.field = 'payment_status'
  );
