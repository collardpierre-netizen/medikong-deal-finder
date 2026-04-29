DROP INDEX IF EXISTS public.offers_qogita_offer_qid_unique;

ALTER TABLE public.offers
  ADD CONSTRAINT offers_qogita_offer_qid_key UNIQUE (qogita_offer_qid);