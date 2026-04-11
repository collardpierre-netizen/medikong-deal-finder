
CREATE TABLE public.vendor_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  invoice_number TEXT,
  base_cost_cents INTEGER NOT NULL DEFAULT 0,
  margin_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_vendor_invoices_period ON public.vendor_invoices (vendor_id, period_start);

ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own invoices"
ON public.vendor_invoices FOR SELECT
TO authenticated
USING (vendor_id IN (SELECT id FROM public.vendors WHERE auth_user_id = auth.uid()));

CREATE POLICY "Admins can manage all invoices"
ON public.vendor_invoices FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_vendor_invoices_updated_at
BEFORE UPDATE ON public.vendor_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
