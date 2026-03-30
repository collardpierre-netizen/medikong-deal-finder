
-- Drop the constraint first, then the redundant indexes
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_qogita_offer_qid_key;
DROP INDEX IF EXISTS idx_offers_unique;
DROP INDEX IF EXISTS offers_qogita_offer_qid_unique;

-- Create one clean partial unique index (allows multiple NULLs)
CREATE UNIQUE INDEX offers_qogita_offer_qid_unique 
  ON public.offers (qogita_offer_qid) 
  WHERE qogita_offer_qid IS NOT NULL;
