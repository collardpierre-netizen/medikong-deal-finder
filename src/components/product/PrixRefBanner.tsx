import { Info } from "lucide-react";
import type { ProfilAcheteur, PaysCode, PrixPublic, PrixProfilPays } from "@/lib/types/prix-informatifs";
import { getPrixRef, calcSavings, formatPrixRef, sourceLabels } from "@/lib/utils/prix-ref";

interface Props {
  prixPublic?: PrixPublic;
  prixParProfil?: PrixProfilPays[];
  profil: ProfilAcheteur;
  pays: PaysCode;
  bestPrice: number;
}

export default function PrixRefBanner({ prixPublic, prixParProfil, profil, pays, bestPrice }: Props) {
  const ref = getPrixRef(prixParProfil, prixPublic, profil, pays);
  if (!ref && !prixPublic) return null;

  const savings = ref ? calcSavings(ref.price, bestPrice, ref.source, ref.date) : null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 border border-green-200 rounded-xl p-4 md:p-5">
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-3">
        <Info size={14} className="text-emerald-700" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-emerald-700">
          Prix de reference pour votre profil
        </span>
      </div>

      {/* Price row */}
      <div className="flex items-start gap-6">
        {prixPublic && (
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Prix public constate</p>
            <p className="text-lg font-bold text-slate-700">
              {formatPrixRef(prixPublic.ttc)} <span className="text-[11px] font-normal text-slate-400">TTC</span>
            </p>
            <p className="text-[10px] text-slate-400">{sourceLabels[prixPublic.source]} · {prixPublic.dateConstatation}</p>
          </div>
        )}

        {prixPublic && ref && (
          <div className="w-px self-stretch bg-slate-200" />
        )}

        {ref && (
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Prix {profil} (votre profil)</p>
            <p className="text-lg font-bold text-emerald-600">
              {formatPrixRef(ref.price)} <span className="text-[11px] font-normal text-slate-400">HTVA</span>
            </p>
            <p className="text-[10px] text-slate-400">{sourceLabels[ref.source]} · {pays} · {ref.date}</p>
          </div>
        )}
      </div>

      {/* Savings bar */}
      {savings?.show && (
        <div className="mt-3 bg-white border border-green-200 rounded-lg px-3.5 py-2 flex items-center gap-2 flex-wrap">
          <span className="bg-emerald-600 text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
            -{savings.pct}%
          </span>
          <span className="text-[12px] font-bold text-emerald-600">
            Meilleure offre MediKong: {formatPrixRef(bestPrice)} HTVA
          </span>
          <span className="text-[11px] text-slate-500">
            soit -{formatPrixRef(savings.abs)} HTVA vs prix de reference {profil}
          </span>
        </div>
      )}
    </div>
  );
}
