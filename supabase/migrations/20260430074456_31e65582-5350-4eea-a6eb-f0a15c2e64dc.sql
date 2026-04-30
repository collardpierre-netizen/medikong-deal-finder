-- Templates de relance éditables
CREATE TABLE IF NOT EXISTS public.rfq_reminder_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_number smallint NOT NULL,
  delay_hours integer NOT NULL,
  subject_fr text NOT NULL,
  body_fr text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rfq_reminder_templates_wave_check CHECK (wave_number BETWEEN 1 AND 5),
  CONSTRAINT rfq_reminder_templates_delay_check CHECK (delay_hours > 0 AND delay_hours <= 720)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rfq_reminder_template_active_wave
  ON public.rfq_reminder_templates (wave_number) WHERE is_active = true;

ALTER TABLE public.rfq_reminder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active reminder templates"
  ON public.rfq_reminder_templates FOR SELECT TO authenticated
  USING (is_active = true OR is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins manage reminder templates"
  ON public.rfq_reminder_templates FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_rfq_reminder_templates_updated_at ON public.rfq_reminder_templates;
CREATE TRIGGER trg_rfq_reminder_templates_updated_at
  BEFORE UPDATE ON public.rfq_reminder_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.rfq_reminder_templates (wave_number, delay_hours, subject_fr, body_fr) VALUES
  (1, 24,
   'Rappel : nouvelle demande de prix pour {{product_name}}',
   E'Bonjour {{vendor_name}},\n\nVous avez reçu il y a 24h une demande de prix MediKong pour :\n\n• Produit : {{product_name}}\n• Quantité : {{quantity}}\n• Échéance : encore {{deadline_in_hours}}h pour répondre\n\nLes acheteurs MediKong privilégient les vendeurs réactifs. Quelques minutes suffisent pour soumettre votre prix.\n\nRépondre maintenant : {{respond_url}}\n\nL''équipe MediKong'),
  (2, 72,
   'Dernière chance : la demande de prix se clôture bientôt',
   E'Bonjour {{vendor_name}},\n\nLa demande de prix pour {{product_name}} (quantité : {{quantity}}) se clôture dans {{deadline_in_hours}}h.\n\nC''est votre dernière chance d''être pris en compte par l''acheteur. Sans réponse de votre part, le RFQ sera automatiquement attribué à un concurrent.\n\nSoumettre votre prix : {{respond_url}}\n\nL''équipe MediKong')
ON CONFLICT DO NOTHING;

-- Trace des relances envoyées (anti-doublon)
CREATE TABLE IF NOT EXISTS public.rfq_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  wave_number smallint NOT NULL,
  template_id uuid REFERENCES public.rfq_reminder_templates(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  email_message_id text,
  error text,
  CONSTRAINT rfq_reminder_log_wave_check CHECK (wave_number BETWEEN 1 AND 5),
  CONSTRAINT uq_rfq_reminder_log_rfq_vendor_wave UNIQUE (rfq_id, vendor_id, wave_number)
);

CREATE INDEX IF NOT EXISTS idx_rfq_reminder_log_rfq ON public.rfq_reminder_log (rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_reminder_log_vendor ON public.rfq_reminder_log (vendor_id);

ALTER TABLE public.rfq_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all reminder logs"
  ON public.rfq_reminder_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Buyers read reminders of their own RFQs"
  ON public.rfq_reminder_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM rfqs r WHERE r.id = rfq_reminder_log.rfq_id AND r.buyer_user_id = auth.uid()));

CREATE POLICY "Vendors read reminders sent to them"
  ON public.rfq_reminder_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM vendors v WHERE v.id = rfq_reminder_log.vendor_id AND v.auth_user_id = auth.uid()));

-- RPC : sélectionne les cibles éligibles à la prochaine relance
CREATE OR REPLACE FUNCTION public.rfq_select_reminder_targets(_max_per_run integer DEFAULT 200)
RETURNS TABLE (
  dispatch_id uuid,
  rfq_id uuid,
  vendor_id uuid,
  vendor_name text,
  vendor_email text,
  product_name text,
  quantity integer,
  deadline_in_hours integer,
  responses_deadline timestamptz,
  next_wave smallint,
  template_id uuid,
  subject_fr text,
  body_fr text,
  tracking_token uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT
      d.id AS dispatch_id,
      d.rfq_id,
      d.vendor_id,
      d.tracking_token,
      r.responses_deadline,
      r.quantity,
      COALESCE(p.name, b.name, 'Produit') AS product_name,
      v.name AS vendor_name,
      v.email AS vendor_email,
      COALESCE((
        SELECT MAX(wave_number) + 1
        FROM rfq_reminder_log l
        WHERE l.rfq_id = d.rfq_id AND l.vendor_id = d.vendor_id
      ), 1)::smallint AS next_wave,
      EXTRACT(EPOCH FROM (now() - d.dispatched_at)) / 3600.0 AS hours_since_dispatch,
      GREATEST(0, EXTRACT(EPOCH FROM (r.responses_deadline - now())) / 3600.0)::integer AS deadline_in_hours
    FROM rfq_dispatch_log d
    JOIN rfqs r ON r.id = d.rfq_id
    JOIN vendors v ON v.id = d.vendor_id
    LEFT JOIN products p ON p.id = r.product_id
    LEFT JOIN brands b ON b.id = r.brand_id
    WHERE
      r.status IN ('dispatched', 'in_followup', 'open')
      AND r.responses_deadline > now()
      AND d.status IN ('viewed', 'pending_review', 'reminded')
      AND d.responded_at IS NULL
      AND d.declined_at IS NULL
      AND v.email IS NOT NULL
  )
  SELECT
    e.dispatch_id, e.rfq_id, e.vendor_id, e.vendor_name, e.vendor_email,
    e.product_name, e.quantity, e.deadline_in_hours, e.responses_deadline,
    e.next_wave, t.id, t.subject_fr, t.body_fr, e.tracking_token
  FROM eligible e
  JOIN rfq_reminder_templates t
    ON t.wave_number = e.next_wave AND t.is_active = true
  WHERE e.hours_since_dispatch >= t.delay_hours
    AND NOT EXISTS (
      SELECT 1 FROM rfq_reminder_log l
      WHERE l.rfq_id = e.rfq_id AND l.vendor_id = e.vendor_id AND l.wave_number = e.next_wave
    )
  ORDER BY e.responses_deadline ASC
  LIMIT _max_per_run;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_select_reminder_targets(integer) TO authenticated, service_role;

-- Helper : marque une relance comme envoyée + met à jour dispatch_log et rfqs
CREATE OR REPLACE FUNCTION public.rfq_record_reminder_sent(
  _rfq_id uuid,
  _vendor_id uuid,
  _wave smallint,
  _template_id uuid,
  _email_message_id text DEFAULT NULL,
  _error text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO rfq_reminder_log (rfq_id, vendor_id, wave_number, template_id, email_message_id, error)
  VALUES (_rfq_id, _vendor_id, _wave, _template_id, _email_message_id, _error)
  ON CONFLICT (rfq_id, vendor_id, wave_number) DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NOT NULL AND _error IS NULL THEN
    UPDATE rfq_dispatch_log
    SET status = 'reminded', reminded_at = now()
    WHERE rfq_id = _rfq_id AND vendor_id = _vendor_id
      AND status IN ('viewed', 'pending_review');

    UPDATE rfqs
    SET last_reminded_at = now(),
        current_wave = GREATEST(current_wave, _wave + 1)
    WHERE id = _rfq_id;
  END IF;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rfq_record_reminder_sent(uuid, uuid, smallint, uuid, text, text) TO service_role;