CREATE OR REPLACE FUNCTION public.calculate_offer_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rule RECORD;
  _margin numeric;
  _extra_delay integer;
  _round_to numeric;
BEGIN
  IF NOT NEW.is_qogita_backed OR NEW.qogita_base_price IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sélection de la règle la plus spécifique.
  -- Ordre de spécificité : vendeur > marque > catégorie > règle globale.
  -- La priority ne sert que de départage à spécificité égale.
  SELECT * INTO _rule FROM public.margin_rules
  WHERE is_active = true
    AND (category_id IS NULL OR category_id = (SELECT category_id FROM public.products WHERE id = NEW.product_id))
    AND (brand_id IS NULL OR brand_id = (SELECT brand_id FROM public.products WHERE id = NEW.product_id))
    AND (vendor_id IS NULL OR vendor_id = NEW.vendor_id)
    AND (min_base_price IS NULL OR NEW.qogita_base_price >= min_base_price)
    AND (max_base_price IS NULL OR NEW.qogita_base_price <= max_base_price)
  ORDER BY
    (vendor_id IS NOT NULL)::int DESC,
    (brand_id IS NOT NULL)::int DESC,
    (category_id IS NOT NULL)::int DESC,
    priority DESC,
    created_at DESC NULLS LAST
  LIMIT 1;

  IF _rule IS NULL THEN
    _margin := 25.00;
    _extra_delay := 2;
    _round_to := 0.01;
    NEW.applied_margin_rule_id := NULL;
    NEW.applied_margin_percentage := _margin;
  ELSE
    _margin := _rule.margin_percentage;
    _extra_delay := _rule.extra_delay_days;
    _round_to := _rule.round_price_to;
    NEW.applied_margin_rule_id := _rule.id;
    NEW.applied_margin_percentage := _margin;
  END IF;

  NEW.price_excl_vat := ROUND(NEW.qogita_base_price * (1 + _margin / 100) / _round_to) * _round_to;
  NEW.price_incl_vat := ROUND(NEW.price_excl_vat * (1 + NEW.vat_rate / 100), 2);
  NEW.margin_amount := NEW.price_excl_vat - NEW.qogita_base_price;

  IF NEW.qogita_base_delay_days IS NOT NULL THEN
    NEW.delivery_days := NEW.qogita_base_delay_days + _extra_delay;
  END IF;

  RETURN NEW;
END;
$function$;