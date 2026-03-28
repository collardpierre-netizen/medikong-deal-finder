import type { SavingsResult, ProfilAcheteur } from "@/lib/types/prix-informatifs";
import { formatPrixRef } from "@/lib/utils/prix-ref";

interface Props {
  savings: SavingsResult;
  profil: ProfilAcheteur;
}

export default function OfferSavingsLine({ savings, profil }: Props) {
  if (!savings.show) return null;

  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
      <span className="text-sm font-bold text-emerald-600">-{savings.pct}%</span>
      <span className="text-xs text-emerald-600">-{formatPrixRef(savings.abs)} HTVA</span>
      <span className="text-xs text-slate-500">vs prix de ref. {profil} ({formatPrixRef(savings.refPrice)})</span>
    </div>
  );
}
