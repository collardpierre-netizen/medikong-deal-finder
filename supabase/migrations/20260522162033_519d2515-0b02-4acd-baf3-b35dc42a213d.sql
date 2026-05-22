-- Backfill one-shot des colonnes legacy vers restock_offers.photos[]
-- Stratégie : pour chaque ligne où photos est vide/null, on agrège dans cet ordre
--   product_image_url (1 URL) > photo_url (1 URL) > packaging_photos[] (N URLs)
-- en dédoublonnant et en conservant l'ordre.
UPDATE public.restock_offers
SET photos = COALESCE(
  (
    SELECT array_agg(DISTINCT url ORDER BY url)
    FROM (
      SELECT unnest(
        ARRAY_REMOVE(
          ARRAY[product_image_url, photo_url] || COALESCE(packaging_photos, ARRAY[]::text[]),
          NULL
        )
      ) AS url
    ) sub
    WHERE url IS NOT NULL AND url <> ''
  ),
  ARRAY[]::text[]
)
WHERE (photos IS NULL OR array_length(photos, 1) IS NULL)
  AND (
    product_image_url IS NOT NULL
    OR photo_url IS NOT NULL
    OR (packaging_photos IS NOT NULL AND array_length(packaging_photos, 1) > 0)
  );

-- Aucun ALTER / DROP : les colonnes legacy restent en place pour rollback éventuel.
-- Aucune écriture future n'est faite par le code applicatif vers ces colonnes
-- (audit du 22 mai 2026, RestockSellerNewOffer.tsx + EditRestockOfferDialog.tsx + edge functions).