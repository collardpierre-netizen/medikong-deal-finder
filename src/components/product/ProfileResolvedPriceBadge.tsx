import { Tag } from "lucide-react";
import { useResolvedOfferPrice } from "@/hooks/useResolvedOfferPrice";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  offerId: string | null | undefined;
  basePrice: number;
  isTVAC?: boolean;
  vatRate?: number;
  className?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  offer_absolute: "Prix négocié",
  offer_discount: "Remise vendeur",
  vendor_default_absolute: "Prix accord vendeur",
  vendor_default_discount: "Remise standard vendeur",
};

/**
 * Indicateur visuel : si une règle de prix par profil acheteur s'applique
 * à l'utilisateur connecté pour cette offre, on l'affiche en discret sous
 * le prix principal. Sinon, on n'affiche rien (compatible non-vérifiés).
 */
export default function ProfileResolvedPriceBadge({
  offerId,
  basePrice,
  isTVAC = false,
  vatRate = 21,
  className,
}: Props) {
  const { user } = useAuth();
  const { data } = useResolvedOfferPrice(offerId ?? null);

  if (!user || !data || data.source === "offer_base") return null;
  if (Math.abs(data.price_excl_vat - basePrice) < 0.005) return null;

  const display = isTVAC
    ? data.price_excl_vat * (1 + vatRate / 100)
    : data.price_excl_vat;
  const deltaPct = basePrice > 0 ? ((data.price_excl_vat - basePrice) / basePrice) * 100 : 0;
  const isCheaper = data.price_excl_vat < basePrice;
  const label = SOURCE_LABELS[data.source] || "Prix profil";

  return (
    <div
      className={`inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md text-[11px] font-medium ${className || ""}`}
      style={{
        backgroundColor: isCheaper ? "#ECFDF5" : "#FEF3C7",
        color: isCheaper ? "#047857" : "#92400E",
      }}
      title={`${label} appliqué pour votre profil`}
    >
      <Tag size={11} />
      <span>
        Votre prix : {display.toFixed(2)} € {isTVAC ? "TVAC" : "HTVA"}
      </span>
      <span className="opacity-70">
        ({deltaPct >= 0 ? "+" : ""}
        {deltaPct.toFixed(1)}%)
      </span>
    </div>
  );
}
