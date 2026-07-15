import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  peppolId?: string | null;
  isBelgian: boolean;
  className?: string;
}

/**
 * Compact Peppol configuration badge for vendor rows / detail pages.
 * - 🟢 "Peppol configuré" when peppol_id is set
 * - 🔴 "Peppol manquant" when vendor is BE and peppol_id is null
 * - "—" for non-BE vendors without peppol_id (no obligation)
 */
export function VendorPeppolBadge({ peppolId, isBelgian, className }: Props) {
  if (peppolId) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${className ?? ""}`}
        style={{ backgroundColor: "#F0FDF4", color: "#059669" }}
        title={peppolId}
      >
        <CheckCircle2 size={10} /> Peppol configuré
      </span>
    );
  }
  if (isBelgian) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${className ?? ""}`}
        style={{ backgroundColor: "#FEF2F2", color: "#B91C1C" }}
        title="Vendeur belge — Peppol ID requis pour la facturation électronique"
      >
        <XCircle size={10} /> Peppol manquant
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] ${className ?? ""}`}
      style={{ color: "#8B95A5" }}
      title="Non applicable (vendeur hors Belgique)"
    >
      —
    </span>
  );
}

export default VendorPeppolBadge;
