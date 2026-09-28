ALTER TABLE public.qo_campaigns
  ADD COLUMN IF NOT EXISTS headline_nl text,
  ADD COLUMN IF NOT EXISTS allocation_note_nl text,
  ADD COLUMN IF NOT EXISTS vendor_label_nl text,
  ADD COLUMN IF NOT EXISTS market_price_label_nl text,
  ADD COLUMN IF NOT EXISTS margin_note_nl text,
  ADD COLUMN IF NOT EXISTS delivery_label_nl text,
  ADD COLUMN IF NOT EXISTS carrier_label_nl text,
  ADD COLUMN IF NOT EXISTS carrier_short_label_nl text,
  ADD COLUMN IF NOT EXISTS returns_label_nl text,
  ADD COLUMN IF NOT EXISTS returns_short_label_nl text,
  ADD COLUMN IF NOT EXISTS origin_label_nl text,
  ADD COLUMN IF NOT EXISTS payment_terms_label_nl text,
  ADD COLUMN IF NOT EXISTS contact_label_nl text;

ALTER TABLE public.qo_offer_items
  ADD COLUMN IF NOT EXISTS name_nl text,
  ADD COLUMN IF NOT EXISTS category_nl text,
  ADD COLUMN IF NOT EXISTS eta_label_nl text;

ALTER TABLE public.qo_orders
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr';