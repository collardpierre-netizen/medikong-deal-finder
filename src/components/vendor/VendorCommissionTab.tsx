import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Percent, BarChart3, TrendingDown, Zap, Target, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEur = (n: number) => `${fmt(n)} €`;

export default function VendorCommissionTab() {
  const currentGmv = 28500;
  const [simGmv, setSimGmv] = useState(currentGmv);

  const { data: rules = [] } = useQuery({
    queryKey: ["vendor-margin-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const activeRule = useMemo(() => rules[0] || null, [rules]);
  const marginPct = activeRule?.margin_percentage ?? 15;

  const currentCommission = currentGmv * (marginPct / 100);
  const simCommission = simGmv * (marginPct / 100);
  const commissionDiff = simCommission - currentCommission;

  return (
    <div className="space-y-4">
      <VCard className="!p-4 bg-gradient-to-r from-[#1B5BDA]/5 to-transparent border-[#1B5BDA]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1B5BDA]/10 flex items-center justify-center">
            <Percent size={20} className="text-[#1B5BDA]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1D2530]">Votre marge MediKong : {marginPct}%</p>
            <p className="text-[11px] text-[#8B95A5]">{activeRule?.name || "Règle par défaut"}</p>
          </div>
          <VBadge color="#1B5BDA" className="ml-auto">{marginPct}%</VBadge>
        </div>
      </VCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#1B5BDA14] flex items-center justify-center"><BarChart3 size={16} className="text-[#1B5BDA]" /></div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">GMV mensuel</span>
          </div>
          <p className="text-xl font-bold text-[#1D2530]">{fmtEur(currentGmv)}</p>
        </VCard>
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#059669]/10 flex items-center justify-center"><Percent size={16} className="text-[#059669]" /></div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">Marge appliquée</span>
          </div>
          <p className="text-xl font-bold text-[#1D2530]">{marginPct}%</p>
          <p className="text-[11px] text-[#8B95A5]">Commission : {fmtEur(currentCommission)}/mois</p>
        </VCard>
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center"><Target size={16} className="text-[#F59E0B]" /></div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">Délai supplémentaire</span>
          </div>
          <p className="text-xl font-bold text-[#1D2530]">+{activeRule?.extra_delay_days ?? 2}j</p>
        </VCard>
      </div>

      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-1 flex items-center gap-2">
          <TrendingDown size={16} className="text-[#059669]" /> Simulateur d'impact
        </h3>
        <p className="text-[11px] text-[#8B95A5] mb-5">Estimez votre commission en ajustant votre volume</p>
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-medium text-[#616B7C]">GMV mensuel estimé</label>
              <div className="flex items-center gap-1.5">
                <Input type="number" value={simGmv} onChange={e => setSimGmv(Number(e.target.value))} className="w-28 h-7 text-right text-[13px] font-semibold" />
                <span className="text-[12px] text-[#8B95A5]">€</span>
              </div>
            </div>
            <Slider value={[simGmv]} onValueChange={v => setSimGmv(v[0])} min={0} max={300000} step={500} className="mt-1" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#8B95A5] mb-1">Commission estimée</p>
              <p className="text-2xl font-bold text-[#1D2530]">{fmtEur(simCommission)}</p>
              <p className="text-[11px] text-[#8B95A5]">/mois</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#8B95A5] mb-1">Différence vs actuel</p>
              <p className={`text-2xl font-bold ${commissionDiff <= 0 ? "text-[#059669]" : "text-[#EF4343]"}`}>
                {commissionDiff <= 0 ? "-" : "+"}{fmtEur(Math.abs(commissionDiff))}
              </p>
            </div>
          </div>
        </div>
      </VCard>
    </div>
  );
}
