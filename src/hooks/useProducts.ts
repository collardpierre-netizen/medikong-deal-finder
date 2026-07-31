import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPreferredProductImageUrls, isValidProductImage } from "@/lib/image-utils";
import { useCountry } from "@/contexts/CountryContext";
import { resolveVendorLabel, type VendorVisibilityRule } from "@/lib/vendor-display";
import { applyHiddenCategoryFilter } from "@/lib/catalog-filters";
import { useBuyerProfileId } from "@/hooks/useResolvedOfferPrice";
import { resolvePriceCascade, type PriceCascadeSource } from "@/lib/price-cascade";

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gtin: string;
  cnk: string;
  ean: string;
  price: number;
  pub: number;
  pct: number;
  sellers: number;
  rating: number;
  reviews: number;
  best: string;
  unit: string;
  stock: boolean;
  mk: boolean;
  category?: string;
  color?: string;
  iconName?: string;
  imageUrl?: string;
  imageUrls?: string[];
  categoryL1?: string;
  categoryL2?: string;
  categoryL3?: string;
  descriptionShort?: string;
  weightG?: number;
  brandId?: string;
  brandSlug?: string;
}

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function mapDbProduct(row: any, offersData?: any[]): Product {
  const productOffers = offersData?.filter((o: any) => o.product_id === row.id) || [];
  const validImageUrls = getPreferredProductImageUrls([
    ...(Array.isArray(row.image_urls) ? row.image_urls : []),
    row.image_url,
  ]);
  const fallbackImageUrl = isValidProductImage(row.image_url) ? row.image_url : undefined;
  const lowestPrice = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.price_excl_vat)))
    : Number(row.best_price_excl_vat) || 0;
  const bestInclVat = productOffers.length > 0
    ? Math.min(...productOffers.map((o: any) => Number(o.price_incl_vat)))
    : Number(row.best_price_incl_vat) || lowestPrice * 1.21;
  const pct = bestInclVat > 0 && lowestPrice > 0 ? Math.round(((bestInclVat - lowestPrice) / bestInclVat) * 100) : 0;

  return {
    id: row.id,
    slug: row.slug || slugify(row.name),
    name: row.name,
    brand: row.brand_name || "",
    gtin: row.gtin || "",
    cnk: row.cnk_code || "",
    ean: row.gtin || "",
    price: lowestPrice,
    pub: bestInclVat,
    pct: Math.max(0, pct),
    sellers: row.offer_count || productOffers.length || 0,
    rating: 0,
    reviews: 0,
    best: productOffers.length > 0 ? "Meilleur prix" : "",
    unit: "unité",
    stock: row.is_in_stock || productOffers.some((o: any) => o.stock_quantity > 0),
    mk: productOffers.length > 0,
    category: row.category_name || undefined,
    color: ["blue", "teal", "green", "amber", "rose", "purple", "orange", "cyan"][row.name.length % 8],
    iconName: "Package",
    imageUrl: validImageUrls[0] || fallbackImageUrl,
    imageUrls: validImageUrls.length > 0 ? validImageUrls : (fallbackImageUrl ? [fallbackImageUrl] : []),
    descriptionShort: row.short_description || undefined,
    brandId: row.brand_id || undefined,
    brandSlug: row.brands?.slug || (row.brand_name ? slugify(row.brand_name) : undefined),
  };
}

/** @deprecated Use useFeaturedProducts(limit) or useCatalogProducts instead */
export function useProducts() {
  return useFeaturedProducts(24);
}

/**
 * Lightweight hook: fetches only `limit` products with offers, no full table scan.
 */
export function useFeaturedProducts(limit = 10, options?: { promotion?: boolean; brandSlug?: string; categoryName?: string }) {
  const { country } = useCountry();
  return useQuery({
    queryKey: ["featured-products", limit, country, options?.promotion, options?.brandSlug, options?.categoryName],
    queryFn: async () => {
      let query = applyHiddenCategoryFilter(
        supabase
          .from("products")
          .select("id, slug, name, brand_name, brand_id, gtin, cnk_code, image_urls, short_description, is_promotion, promotion_label, best_price_excl_vat, best_price_incl_vat, offer_count, total_stock, is_in_stock, category_name, brands(slug)")
          .eq("is_active", true)
      );

      // Only filter on offers/price when NOT browsing a specific brand
      if (!options?.brandSlug) {
        query = query.gt("offer_count", 0).gt("best_price_excl_vat", 0);
      }

      if (options?.promotion) query = query.eq("is_promotion", true);
      if (options?.brandSlug) {
        const { data: brand } = await supabase.from("brands").select("id").eq("slug", options.brandSlug).maybeSingle();
        if (brand) {
          query = query.eq("brand_id", brand.id);
        } else {
          return [];
        }
      }
      if (options?.categoryName) {
        query = query.eq("category_name", options.categoryName);
      }

      const { data, error } = await query
        .order("offer_count", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((row: any) => mapDbProduct(row));
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useProduct(slug: string | undefined) {
  const { country } = useCountry();
  return useQuery({
    queryKey: ["product", slug, country],
    queryFn: async () => {
      // First get the product (needed for ID)
      const { data, error } = await supabase.from("products").select("*").eq("slug", slug!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Offers fetched separately by useProductOffers — no need to duplicate here
      return mapDbProduct(data);
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export interface DiscountTier {
  id: string;
  mov_amount: number;
  mov_currency: string;
  unit_price: number;
  price_currency: string;
  is_active: boolean;
  mov_progress: number;
}

export interface OfferPriceTier {
  id: string;
  offer_id: string;
  tier_index: number;
  mov_threshold: number;
  mov_currency: string;
  qogita_unit_price: number;
  price_excl_vat: number;
  price_incl_vat: number;
  margin_amount: number;
  is_active: boolean;
  mov_progress: number;
}

export interface Offer {
  id: string;
  productId: string;
  sellerId: string;
  unitPriceEur: number;
  unitPriceInclVat: number;
  stockQuantity: number;
  movEur: number;
  bundleSize: number;
  packSizeOverride?: number | null;
  deliveryDays: number;
  shipFromCountry: string;
  priceTiers: any[] | null;
  discountTiers: DiscountTier[];
  offerPriceTiers: OfferPriceTier[];
  isActive: boolean;
  updatedAt?: string | null;
  syncedAt?: string | null;
  isQogitaBacked?: boolean;
  sellerName?: string;
  sellerSlug?: string;
  isVerified?: boolean;
  isTopRated?: boolean;
  isTopSeller?: boolean;
  displayCode?: string;
  isTraceable?: boolean;
  hasExtendedDelivery?: boolean;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  estimatedDeliveryDays?: number;
  vendorNote?: string | null;
  cartonSizeOverride?: number | null;
  packagingLanguages?: string[] | null;
  isExclusiveWinner?: boolean;
  isShowcaseDimmed?: boolean;
}

export function useProductOffers(productId: string | undefined) {
  const { country } = useCountry();
  const buyerProfileId = useBuyerProfileId();
  return useQuery({
    queryKey: ["offers", productId, country, buyerProfileId],
    queryFn: async () => {
      // Colonnes explicites (jamais "*") : la table `offers` expose des champs
      // internes sensibles (coûts d'achat, marge, commission, notes admin) qui
      // ne doivent jamais être lisibles côté anon. Les grants colonnes côté DB
      // refusent déjà ces colonnes au rôle anon ; on aligne le SELECT ici pour
      // éviter une erreur de permission lors d'un browse anonyme.
      const { data: offers, error } = await supabase
        .from("offers")
        .select(
          "id, product_id, vendor_id, price_excl_vat, price_incl_vat, vat_rate, stock_quantity, stock_status, moq, mov, mov_amount, mov_currency, delivery_days, shipping_from_country, price_tiers, is_active, synced_at, updated_at, country_code, is_traceable, has_extended_delivery, min_delivery_days, max_delivery_days, estimated_delivery_days, is_qogita_backed, qogita_offer_qid, is_top_seller, pack_size_override, suggested_retail_price_cents, suggested_retail_price_source, carton_size_override, packaging_languages, campaign_id"
        )
        .eq("product_id", productId!)
        .eq("is_active", true)
        .eq("country_code", country)
        .order("price_excl_vat", { ascending: true });
      if (error) {
        // Track explicite des permission denied (42501) sur public.offers,
        // avec URL + produit + pays + profil, côté client console ET côté
        // serveur (insert dans public.client_error_logs via errorReporter).
        const code = (error as any)?.code || "";
        const msg = String((error as any)?.message || "");
        const isOffersPermDenied =
          code === "42501" ||
          /permission denied for (table |relation )?"?offers"?/i.test(msg);
        if (isOffersPermDenied) {
          try {
            const { report } = await import("@/lib/errorReporter");
            await report({
              source: "manual",
              level: "error",
              component: "useProductOffers",
              message: `PostgREST 42501 on public.offers — ${msg || "permission denied"}`,
              metadata: {
                table: "public.offers",
                pg_code: code,
                pg_details: (error as any)?.details ?? null,
                pg_hint: (error as any)?.hint ?? null,
                product_id: productId ?? null,
                country,
                buyer_profile_id: buyerProfileId ?? null,
                url: typeof window !== "undefined" ? window.location.href : null,
                pathname: typeof window !== "undefined" ? window.location.pathname : null,
              },
            });
          } catch {
            // never break the query on logging failure
          }
        }
        throw error;
      }

      // Résolution exclusivité produit×pays×profil (Lot 1b) : masque les offres
      // concurrentes en mode hide/block, tague le vendeur exclusif en showcase.
      const { data: exclRows } = await supabase.rpc("resolve_offer_exclusivity" as any, {
        _product_id: productId!,
        _country: country,
        _buyer_profile_id: buyerProfileId ?? null,
      });
      const exclusivity = Array.isArray(exclRows) && exclRows.length > 0 ? (exclRows[0] as any) : null;
      const exclVendorId: string | null = exclusivity?.vendor_id ?? null;
      const exclMode: "showcase" | "hide" | "block" | null = (exclusivity?.mode as any) ?? null;

      const visibleOffers = (offers || []).filter((o: any) => {
        if (!exclMode || exclMode === "showcase") return true;
        return o.vendor_id === exclVendorId; // hide + block
      });

      const offerIds = visibleOffers.map((o: any) => o.id);
      const vendorIds = [...new Set(visibleOffers.map((o: any) => o.vendor_id))];

      // Cascade prix utilisateur (DB-driven) :
      // Lecture unique de la vue `effective_offer_prices_v` qui applique côté
      // serveur la cascade complète : offer_buyer_profile_prices >
      // vendor_profile_defaults > product_prices (legacy) > prix de base offre.
      // -> 1 round-trip au lieu de N appels RPC.
      const resolvedPriceMap = new Map<string, { price_excl_vat: number; source: string }>();
      if (buyerProfileId && offerIds.length > 0) {
        const { data: effRows } = await supabase
          .from("effective_offer_prices_v" as any)
          .select("offer_id, effective_price_excl_vat, price_source")
          .in("offer_id", offerIds)
          .eq("buyer_profile_id", buyerProfileId);
        for (const row of (effRows || []) as any[]) {
          const src = String(row.price_source ?? "offer_base");
          // Ne mémorise que les vrais overrides (RPC ou legacy_level).
          // Si la cascade DB retombe sur offer_base, on laisse le prix brut de l'offre s'afficher.
          if (src === "offer_base") continue;
          const price = Number(row.effective_price_excl_vat);
          if (Number.isFinite(price) && price > 0) {
            resolvedPriceMap.set(row.offer_id, { price_excl_vat: price, source: src });
          }
        }
      }

      // legacyLevelPrice n'est plus calculé côté front : la cascade DB ci-dessus
      // intègre déjà la résolution legacy product_prices. Conservé à null pour
      // compat de signature avec resolvePriceCascade.
      const legacyLevelPrice: number | null = null;


      // Fetch vendors, discount tiers, price tiers AND visibility rules in parallel.
      // 🟢 CMS-driven : `vendor_visibility_rules` (gérées dans /admin/vendeurs → onglet
      // Visibilité) déterminent si le vrai nom peut s'afficher sur les cards offres,
      // selon le pays + profil acheteur. Cf. resolveVendorLabel.
      const [vendorsResult, tiersResult, priceTiersResult, rulesResult] = await Promise.all([
        vendorIds.length > 0
          ? supabase.from("vendors_public" as any).select("id, display_name, slug, is_verified, rating, display_code, is_top_seller, type, name, company_name, show_real_name").in("id", vendorIds)
          : Promise.resolve({ data: [] }),
        offerIds.length > 0
          ? supabase.from("discount_tiers").select("*").in("offer_id", offerIds).order("mov_amount", { ascending: true })
          : Promise.resolve({ data: [] }),
        offerIds.length > 0
          ? supabase.from("offer_price_tiers").select("id, offer_id, tier_index, mov_threshold, mov_currency, price_excl_vat, price_incl_vat, is_active, mov_progress, created_at").in("offer_id", offerIds).order("tier_index", { ascending: true })
          : Promise.resolve({ data: [] }),
        vendorIds.length > 0
          ? supabase.from("vendor_visibility_rules" as any).select("vendor_id, country_code, customer_type, show_real_name, priority").in("vendor_id", vendorIds)
          : Promise.resolve({ data: [] }),
      ]);

      const vendorMap = new Map((vendorsResult.data || []).map((v: any) => [v.id, v]));

      // Masquage front des vendeurs désactivés : `vendors_public` ne renvoie que
      // les vendeurs `is_active = true`. Une offre encore active rattachée à un
      // vendeur désactivé (ex. vendeur retiré côté source) n'a donc pas de ligne
      // vendeur → on la retire de l'affichage. Garde-fou : si la lecture vendeurs
      // a échoué, on n'applique pas le filtre (sinon on masquerait tout).
      const vendorsReadFailed = !!(vendorsResult as any)?.error;
      const publishableOffers =
        vendorsReadFailed || vendorIds.length === 0
          ? visibleOffers
          : visibleOffers.filter((o: any) => vendorMap.has(o.vendor_id));

      const visibilityRules: VendorVisibilityRule[] = (rulesResult.data || []) as any[];
      const visibilityContext = { country, customerType: buyerProfileId || undefined };
      const tiersMap = new Map<string, any[]>();
      for (const t of (tiersResult.data || [])) {
        const arr = tiersMap.get(t.offer_id) || [];
        arr.push(t);
        tiersMap.set(t.offer_id, arr);
      }
      const priceTiersMap = new Map<string, any[]>();
      for (const t of (priceTiersResult.data || [])) {
        const arr = priceTiersMap.get(t.offer_id) || [];
        arr.push(t);
        priceTiersMap.set(t.offer_id, arr);
      }

      const mapped = visibleOffers.map((o: any): Offer => {
        const vendor = vendorMap.get(o.vendor_id);
        const safeVendorId: string = o.vendor_id || "";
        const resolved = resolvedPriceMap.get(o.id);
        const cascade = resolvePriceCascade({
          basePriceExclVat: o.price_excl_vat,
          basePriceInclVat: o.price_incl_vat,
          profileOverride: resolved
            ? {
                price_excl_vat: resolved.price_excl_vat,
                source: resolved.source as PriceCascadeSource,
              }
            : null,
          legacyLevelPrice: legacyLevelPrice,
        });
        return {
          id: o.id,
          productId: o.product_id,
          sellerId: safeVendorId,
          unitPriceEur: cascade.unitPriceEur,
          unitPriceInclVat: cascade.unitPriceInclVat,
          stockQuantity: Number(o.stock_quantity) || 0,
          movEur: Number(o.mov || o.mov_amount || 0),
          bundleSize: Number(o.moq) || 1,
          packSizeOverride: o.pack_size_override ?? null,
          deliveryDays: o.delivery_days ?? null,
          shipFromCountry: o.shipping_from_country || 'BE',
          priceTiers: o.price_tiers || null,
          discountTiers: tiersMap.get(o.id) || [],
          offerPriceTiers: priceTiersMap.get(o.id) || [],
          isActive: o.is_active,
          updatedAt: o.updated_at ?? null,
          syncedAt: o.synced_at ?? null,
          isQogitaBacked: !!o.is_qogita_backed,
          sellerName: resolveVendorLabel(
            {
              id: o.vendor_id,
              display_code: vendor?.display_code,
              name: vendor?.name,
              company_name: vendor?.company_name,
              show_real_name: vendor?.show_real_name,
            },
            visibilityRules,
            visibilityContext,
          ),
          sellerSlug: vendor?.slug || undefined,
          isVerified: vendor?.is_verified || false,
          isTopRated: (vendor?.rating || 0) >= 4.5,
          isTopSeller: vendor?.is_top_seller || false,
          displayCode: vendor?.display_code || undefined,
          isTraceable: o.is_traceable || false,
          hasExtendedDelivery: o.has_extended_delivery || false,
          minDeliveryDays: o.min_delivery_days || undefined,
          maxDeliveryDays: o.max_delivery_days || undefined,
          estimatedDeliveryDays: o.estimated_delivery_days || undefined,
          vendorNote: null,
          cartonSizeOverride: o.carton_size_override ?? null,
          packagingLanguages: Array.isArray(o.packaging_languages) ? o.packaging_languages : null,
          isExclusiveWinner: !!exclMode && o.vendor_id === exclVendorId,
          isShowcaseDimmed: exclMode === "showcase" && exclVendorId != null && o.vendor_id !== exclVendorId,
        };
      });

      // Re-tri après application des prix résolus par profil (les overrides
      // peuvent modifier l'ordre best-offer).
      mapped.sort((a, b) => (a.unitPriceEur || 0) - (b.unitPriceEur || 0));
      return mapped;
    },
    enabled: !!productId,
    staleTime: 3 * 60 * 1000,
  });
}
