
-- =========================================================================
-- 1) product_submissions : WITH CHECK + trigger pour empêcher auto-approbation
-- =========================================================================
DROP POLICY IF EXISTS "ps_vendor_update_own_pending" ON public.product_submissions;

CREATE POLICY "ps_vendor_update_own_pending"
ON public.product_submissions
FOR UPDATE
TO authenticated
USING (
  (
    vendor_id = current_vendor_id()
    AND status = ANY (ARRAY['submitted'::product_submission_status, 'needs_changes'::product_submission_status])
  )
  OR is_admin(auth.uid())
)
WITH CHECK (
  is_admin(auth.uid())
  OR (
    vendor_id = current_vendor_id()
    AND status = ANY (ARRAY['submitted'::product_submission_status, 'needs_changes'::product_submission_status])
    AND resulting_product_id IS NULL
    AND resulting_brand_id IS NULL
    AND resulting_manufacturer_id IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_comment IS NULL
  )
);

-- Immutabilité côté OLD -> NEW pour les champs de revue quand ce n'est pas un admin.
CREATE OR REPLACE FUNCTION public.guard_product_submissions_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin : verrouille tous les champs pilotés par la revue admin.
  NEW.status                    := OLD.status;
  NEW.resulting_product_id      := OLD.resulting_product_id;
  NEW.resulting_brand_id        := OLD.resulting_brand_id;
  NEW.resulting_manufacturer_id := OLD.resulting_manufacturer_id;
  NEW.reviewed_by               := OLD.reviewed_by;
  NEW.reviewed_at               := OLD.reviewed_at;
  NEW.review_comment            := OLD.review_comment;
  NEW.vendor_id                 := OLD.vendor_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_submissions_privileged
  ON public.product_submissions;
CREATE TRIGGER trg_guard_product_submissions_privileged
BEFORE UPDATE ON public.product_submissions
FOR EACH ROW
EXECUTE FUNCTION public.guard_product_submissions_privileged_columns();


-- =========================================================================
-- 2) vendor_kyc_submissions : ajoute WITH CHECK explicite (trigger déjà présent)
-- =========================================================================
DROP POLICY IF EXISTS "Vendors update own submissions" ON public.vendor_kyc_submissions;

CREATE POLICY "Vendors update own submissions"
ON public.vendor_kyc_submissions
FOR UPDATE
TO authenticated
USING (
  vendor_id IN (
    SELECT vendors.id FROM public.vendors WHERE vendors.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  vendor_id IN (
    SELECT vendors.id FROM public.vendors WHERE vendors.auth_user_id = auth.uid()
  )
  AND status = ANY (ARRAY['pending'::text, 'submitted'::text])
  AND admin_notes IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);


-- =========================================================================
-- 3) restock_counter_offers : WITH CHECK côté vendeur + trigger d'immutabilité
-- =========================================================================
DROP POLICY IF EXISTS "Sellers update counter offers on own offers"
  ON public.restock_counter_offers;

CREATE POLICY "Sellers update counter offers on own offers"
ON public.restock_counter_offers
FOR UPDATE
USING (
  offer_id IN (
    SELECT ro.id
    FROM public.restock_offers ro
    JOIN public.restock_buyers rb ON rb.id = ro.seller_id
    WHERE rb.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  offer_id IN (
    SELECT ro.id
    FROM public.restock_offers ro
    JOIN public.restock_buyers rb ON rb.id = ro.seller_id
    WHERE rb.auth_user_id = auth.uid()
  )
  AND status = ANY (ARRAY['pending'::text, 'accepted'::text, 'refused'::text])
);

-- Empêche le vendeur de modifier prix / quantité / acheteur / offre attachée.
CREATE OR REPLACE FUNCTION public.guard_restock_counter_offers_seller_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_seller boolean;
  is_buyer  boolean;
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.restock_offers ro
    JOIN public.restock_buyers rb ON rb.id = ro.seller_id
    WHERE ro.id = OLD.offer_id
      AND rb.auth_user_id = auth.uid()
  ) INTO is_seller;

  SELECT EXISTS (
    SELECT 1 FROM public.restock_buyers
    WHERE id = OLD.buyer_id
      AND auth_user_id = auth.uid()
  ) INTO is_buyer;

  IF is_seller AND NOT is_buyer THEN
    -- Le vendeur ne peut répondre qu'en changeant le statut.
    NEW.proposed_price    := OLD.proposed_price;
    NEW.proposed_quantity := OLD.proposed_quantity;
    NEW.buyer_id          := OLD.buyer_id;
    NEW.offer_id          := OLD.offer_id;

    IF NEW.status NOT IN ('pending', 'accepted', 'refused') THEN
      RAISE EXCEPTION 'Invalid counter-offer status transition';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_restock_counter_offers_seller
  ON public.restock_counter_offers;
CREATE TRIGGER trg_guard_restock_counter_offers_seller
BEFORE UPDATE ON public.restock_counter_offers
FOR EACH ROW
EXECUTE FUNCTION public.guard_restock_counter_offers_seller_update();
