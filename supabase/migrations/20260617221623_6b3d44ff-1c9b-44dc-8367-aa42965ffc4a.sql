CREATE OR REPLACE FUNCTION public._buyer_p2p_notify_admin_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_name text;
  v_target_name text;
  v_total_cents bigint;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT COALESCE(pharmacy_name, name, 'Buyer ' || id::text) INTO v_seller_name
      FROM public.buyers WHERE id = NEW.seller_buyer_id;
    SELECT COALESCE(pharmacy_name, name, 'Buyer ' || id::text) INTO v_target_name
      FROM public.buyers WHERE id = NEW.target_buyer_id;

    v_total_cents := NEW.unit_price_excl_vat_cents::bigint * NEW.quantity::bigint;

    INSERT INTO public.admin_notifications (
      type, severity, title, body, cta_url, payload, source_type, source_id
    ) VALUES (
      'buyer_p2p_accepted',
      'warning',
      'Vente privée P2P acceptée — facturation manuelle requise',
      format('%s a accepté l''offre de %s (%s × %s, total HTVA %s EUR). Facture MediKong à émettre manuellement (V1 sans Stripe Connect).',
        v_target_name, v_seller_name, NEW.quantity, NEW.product_name,
        to_char((v_total_cents::numeric / 100), 'FM999G999G990D00')),
      '/admin/ventes-privees',
      jsonb_build_object(
        'listing_id', NEW.id,
        'seller_buyer_id', NEW.seller_buyer_id,
        'target_buyer_id', NEW.target_buyer_id,
        'product_name', NEW.product_name,
        'gtin', NEW.gtin,
        'cnk_code', NEW.cnk_code,
        'quantity', NEW.quantity,
        'unit_price_excl_vat_cents', NEW.unit_price_excl_vat_cents,
        'vat_rate', NEW.vat_rate,
        'total_excl_vat_cents', v_total_cents,
        'commission_enabled', NEW.commission_enabled,
        'commission_rate_bps', NEW.commission_rate_bps,
        'commission_payer', NEW.commission_payer
      ),
      'buyer_p2p_listing',
      NEW.id
    )
    ON CONFLICT (source_type, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_p2p_notify_admin_on_accept ON public.buyer_p2p_listings;
CREATE TRIGGER trg_buyer_p2p_notify_admin_on_accept
  AFTER UPDATE OF status ON public.buyer_p2p_listings
  FOR EACH ROW EXECUTE FUNCTION public._buyer_p2p_notify_admin_on_accept();