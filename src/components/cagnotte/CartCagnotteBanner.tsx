import { Coins } from "lucide-react";
import { useCartOffersCagnotteEligibility, useCagnotteSettings } from "@/hooks/useCagnotte";

interface CartLine {
  offer_id?: string | null;
  quantity: number;
  price_excl_vat?: number | null;
  product?: { price?: number | null } | null;
}

interface Props {
  items: CartLine[];
  className?: string;
}

/**
 * Bandeau promesse cagnotte dans le récap panier.
 * Éligibilité au niveau OFFRE (offers.cagnotte_eligible).
 */
export function CartCagnotteBanner({ items, className }: Props) {
  const offerIds = items.map((i) => i.offer_id).filter(Boolean) as string[];
  const { data: eligibility } = useCartOffersCagnotteEligibility(offerIds);
  const { data: settings } = useCagnotteSettings();
  const rate = settings?.rate ?? 0.02;

  if (!eligibility) return null;

  const lineHt = (i: CartLine) =>
    (Number(i.price_excl_vat ?? i.product?.price ?? 0) || 0) * (Number(i.quantity) || 0);

  const subtotalHt = items.reduce((s, i) => s + lineHt(i), 0);
  const eligibleHt = items.reduce(
    (s, i) => s + (i.offer_id && eligibility[i.offer_id] ? lineHt(i) : 0),
    0,
  );

  if (eligibleHt <= 0) return null;

  const earned = eligibleHt * rate;
  const isFullyEligible = Math.round(eligibleHt * 100) >= Math.round(subtotalHt * 100);
  const expiryYear = new Date().getFullYear() + 1;

  return (
    <div
      className={`flex items-start gap-3 rounded-[10px] px-4 py-3.5 ${className ?? ""}`}
      style={{
        background: "linear-gradient(135deg, rgba(244,185,66,0.15), rgba(244,185,66,0.05))",
        border: "1px solid rgba(244,185,66,0.3)",
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, #F4B942, #D89620)" }}
      >
        <Coins size={16} className="text-[#5A3E00]" />
      </div>
      <div className="min-w-0 text-sm">
        {isFullyEligible ? (
          <>
            <p className="font-semibold text-mk-navy">
              Vous gagnerez {earned.toFixed(2)}€ de cagnotte sur cette commande
            </p>
            <p className="text-xs text-mk-sec mt-0.5">
              Utilisable sur vos prochaines commandes jusqu'au 31 décembre {expiryYear}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-mk-navy">
              Vous gagnerez {earned.toFixed(2)}€ de cagnotte sur {eligibleHt.toFixed(2)}€ HT éligibles
            </p>
            <p className="text-xs text-mk-sec mt-0.5">
              Certains produits ne génèrent pas de cagnotte
            </p>
          </>
        )}
      </div>
    </div>
  );
}
