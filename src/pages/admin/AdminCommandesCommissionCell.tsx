/**
 * Cellule "Commission" extraite de /admin/commandes pour pouvoir
 * être rendue isolément dans un test (vérifie qu'on n'affiche plus
 * "—" quand aucun override n'est stocké et que draft_payload est
 * vide mais que le fallback computeCommissionFromLines renvoie > 0).
 */
export type CommissionSource = "stored" | "draft" | "computed" | "none";

interface Props {
  commissionEur: number;
  commissionPct: number;
  commissionSource: CommissionSource;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function AdminCommandesCommissionCell({ commissionEur, commissionPct, commissionSource }: Props) {
  const title =
    commissionEur > 0
      ? `${commissionPct.toFixed(2)} % du CA HT${
          commissionSource === "stored"
            ? " · override enregistré"
            : commissionSource === "draft"
              ? " · calculé depuis le brouillon"
              : commissionSource === "computed"
                ? " · recalculée depuis les lignes × commission vendeur"
                : ""
        }`
      : "Aucune commission enregistrée";
  return (
    <td className="px-3 py-3 font-mono" title={title} data-testid="commission-cell">
      {commissionEur > 0 ? (
        <div className="leading-tight">
          <div className="text-[12px] font-bold" style={{ color: "#10B981" }}>{fmt(commissionEur)}</div>
          <div className="text-[10px]" style={{ color: "#8B95A5" }}>{commissionPct.toFixed(2)} %</div>
        </div>
      ) : (
        <span className="text-[11px]" style={{ color: "#CBD5E1" }}>—</span>
      )}
    </td>
  );
}
