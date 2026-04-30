-- ============================================================
-- RFQ State Model: enrichir rfq_status + rfq_dispatch_status
-- ============================================================

-- 1) Étendre rfq_status (Postgres ne permet pas DROP VALUE → on ADD)
ALTER TYPE public.rfq_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'open';
ALTER TYPE public.rfq_status ADD VALUE IF NOT EXISTS 'dispatched' AFTER 'open';
ALTER TYPE public.rfq_status ADD VALUE IF NOT EXISTS 'in_followup' AFTER 'dispatched';

-- 2) Étendre rfq_dispatch_status
ALTER TYPE public.rfq_dispatch_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'viewed';
ALTER TYPE public.rfq_dispatch_status ADD VALUE IF NOT EXISTS 'awarded' AFTER 'expired';
ALTER TYPE public.rfq_dispatch_status ADD VALUE IF NOT EXISTS 'lost' AFTER 'awarded';