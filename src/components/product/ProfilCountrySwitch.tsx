import { Check } from "lucide-react";
import type { ProfilAcheteur, PaysCode } from "@/lib/types/prix-informatifs";
import { profilLabels, paysLabels } from "@/lib/utils/prix-ref";

const profils: ProfilAcheteur[] = ["Pharmacie", "Hopital", "MRS", "Infirmier", "Cabinet", "Parapharmacie"];
const paysOptions: PaysCode[] = ["BE", "LU", "FR", "NL"];

interface Props {
  profil: ProfilAcheteur;
  pays: PaysCode;
  defaultProfil: ProfilAcheteur;
  defaultPays: PaysCode;
  onProfilChange: (p: ProfilAcheteur) => void;
  onPaysChange: (p: PaysCode) => void;
}

export default function ProfilCountrySwitch({ profil, pays, defaultProfil, defaultPays, onProfilChange, onPaysChange }: Props) {
  const isChanged = profil !== defaultProfil || pays !== defaultPays;

  return (
    <div className="bg-white border border-slate-200 rounded-[10px] px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <span className="text-[12px] font-semibold text-slate-500">Simuler un autre profil:</span>
      <select
        value={profil}
        onChange={e => onProfilChange(e.target.value as ProfilAcheteur)}
        className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white"
      >
        {profils.map(p => <option key={p} value={p}>{profilLabels[p]}</option>)}
      </select>
      <select
        value={pays}
        onChange={e => onPaysChange(e.target.value as PaysCode)}
        className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white"
      >
        {paysOptions.map(p => <option key={p} value={p}>{paysLabels[p]}</option>)}
      </select>
      {isChanged && (
        <span className="flex items-center gap-1 text-[12px] text-emerald-600 font-medium ml-auto">
          <Check size={14} /> Prix adapte
        </span>
      )}
    </div>
  );
}
