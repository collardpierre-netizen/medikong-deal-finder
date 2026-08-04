import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductCagnotteStatus } from "@/hooks/useProductCagnotteStatus";
import { useCagnotteSettings } from "@/hooks/useCagnotte";

/**
 * Bandeau fin sur la page détail produit, juste sous le nom du produit.
 * Affiché uniquement si au moins une offre du produit est éligible à la cagnotte.
 * Aucun message négatif si aucune offre n'est éligible.
 */
export function ProductDetailCagnotteBanner({
  productId,
  bestPriceExclVat,
}: {
  productId?: string;
  /** Meilleur prix HTVA du produit, pour exprimer la cagnotte en valeur (€). */
  bestPriceExclVat?: number | null;
}) {
  const { data: status } = useProductCagnotteStatus(productId);
  const { data: settings } = useCagnotteSettings();

  const propPrice = Number(bestPriceExclVat || 0);
  const needsFallback = !(propPrice > 0);

  // Filet de sécurité : si la page n'a pas (encore) de meilleur prix,
  // on récupère le prix HTVA le plus bas parmi les offres actives du produit
  // afin d'afficher malgré tout la valeur en € de la cagnotte.
  const { data: fallbackPrice } = useQuery({
    queryKey: ["product-cagnotte-fallback-price", productId],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("offers")
        .select("price_excl_vat")
        .eq("product_id", productId!)
        .eq("is_active", true)
        .order("price_excl_vat", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      const p = Number((data as any)?.price_excl_vat);
      return Number.isFinite(p) && p > 0 ? p : null;
    },
    enabled: !!productId && needsFallback,
    staleTime: 5 * 60 * 1000,
  });

  if (!status?.has_eligible_offer) return null;

  const rate = settings?.rate ?? 0.02;
  const pct = Math.round(rate * 100);
  const nb = status.nb_eligible_offers;
  const total = status.nb_total_offers;
  const unitPrice = needsFallback ? Number(fallbackPrice || 0) : propPrice;
  const value = unitPrice * rate;

  return (
    <div
      className="flex items-center gap-2 text-sm rounded-md"
      style={{
        padding: "10px 16px",
        background: "linear-gradient(90deg, rgba(244,185,66,0.15) 0%, transparent 100%)",
        borderLeft: "3px solid #F4B942",
        borderRadius: 6,
      }}
    >
      <span aria-hidden>🪙</span>
      <span>
        {value > 0 ? (
          <>
            Ce produit vous rapporte{" "}
            <strong>
              {value.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € de cagnotte
            </strong>{" "}
            par unité
            <span className="text-muted-foreground"> ({pct}% du prix HTVA)</span>
          </>
        ) : (
          <>
            Ce produit rapporte <strong>{pct}% de cagnotte</strong>
          </>
        )}
        {" "}sur les offres éligibles
        {total > 0 ? ` (${nb} offre${nb > 1 ? "s" : ""} sur ${total})` : ""}
      </span>
    </div>
  );
}
