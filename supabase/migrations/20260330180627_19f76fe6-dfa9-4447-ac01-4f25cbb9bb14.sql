
-- Add unique index on qogita_offer_qid for API offer upserts (only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS offers_qogita_offer_qid_unique 
ON offers (qogita_offer_qid) WHERE qogita_offer_qid IS NOT NULL;
