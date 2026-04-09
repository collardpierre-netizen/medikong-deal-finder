
-- Commission model enum
CREATE TYPE public.commission_model_enum AS ENUM ('flat_percentage', 'margin_split', 'fixed_amount');

-- Add commission model + margin split to vendors
ALTER TABLE public.vendors
  ADD COLUMN commission_model public.commission_model_enum NOT NULL DEFAULT 'flat_percentage',
  ADD COLUMN margin_split_pct numeric NOT NULL DEFAULT 50,
  ADD COLUMN fixed_commission_amount numeric;

COMMENT ON COLUMN public.vendors.commission_model IS 'flat_percentage = classic %, margin_split = split net margin, fixed_amount = fixed € per unit';
COMMENT ON COLUMN public.vendors.margin_split_pct IS 'Vendor share of net margin in margin_split mode (e.g. 50 = 50/50)';
COMMENT ON COLUMN public.vendors.fixed_commission_amount IS 'Fixed € commission per unit sold in fixed_amount mode';

-- Add purchase price to offers for margin calculation
ALTER TABLE public.offers
  ADD COLUMN purchase_price numeric;

COMMENT ON COLUMN public.offers.purchase_price IS 'Vendor cost/purchase price (HTVA) for net margin calculation';
