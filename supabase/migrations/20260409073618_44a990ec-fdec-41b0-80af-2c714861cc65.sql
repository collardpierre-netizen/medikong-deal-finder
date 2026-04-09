
ALTER TABLE public.restock_offers
  ADD COLUMN IF NOT EXISTS pieces_per_pack integer,
  ADD COLUMN IF NOT EXISTS packs_per_box integer,
  ADD COLUMN IF NOT EXISTS boxes_per_pallet integer;
