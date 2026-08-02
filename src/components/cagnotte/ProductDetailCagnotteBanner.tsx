import { useProductCagnotteStatus } from "@/hooks/useProductCagnotteStatus";
import { useCagnotteSettings } from "@/hooks/useCagnotte";

/**
 * Bandeau fin sur la page détail produit, juste sous le nom du produit.
 * Affiché uniquement si au moins une offre du produit est éligible à la cagnotte.
 * Aucun message négatif si aucune offre n'est éligible.
 */
export function ProductDetailCagnotteBanner({ productId }: { productId?: string }) {
  const { data: status } = useProductCagnotteStatus(productId);
  const { data: settings } = useCagnotteSettings();

  if (!status?.has_eligible_offer) return null;

  const pct = Math.round((settings?.rate ?? 0.02) * 100);
  const nb = status.nb_eligible_offers;
  const total = status.nb_total_offers;

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
        Ce produit rapporte <strong>{pct}% de cagnotte</strong> sur les offres éligibles
        {total > 0 ? ` (${nb} offre${nb > 1 ? "s" : ""} sur ${total})` : ""}
      </span>
    </div>
  );
}
