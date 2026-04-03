ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS qogita_seller_fid text,
  ADD COLUMN IF NOT EXISTS qogita_order_status text NOT NULL DEFAULT 'pending';