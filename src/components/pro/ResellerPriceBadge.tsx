import { Lock } from "lucide-react";

/**
 * Petit badge indiquant qu'un prix affiché provient du tarif "Revendeur pro"
 * (résolu côté serveur via `resolve_offer_price_for_profile`).
 */
export function ResellerPriceBadge({ source }: { source?: string }) {
  const label =
    source === "offer_absolute" || source === "offer_discount"
      ? "Prix négocié"
      : source === "vendor_default_absolute" || source === "vendor_default_discount"
      ? "Prix revendeur"
      : "Prix de base";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full">
      <Lock size={10} aria-hidden="true" />
      {label}
    </span>
  );
}
