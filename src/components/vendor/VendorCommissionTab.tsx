import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Percent, BarChart3, TrendingDown, Zap, Target, ArrowRight, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface Tier { from: number; to: number | null; rate: number }

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEur = (n: number) => `${fmt(n)} €`;

function getTierForGmv(tiers: Tier[], gmv: number): Tier | null {
  for (const t of tiers) {
    if (gmv >= t.from && (t.to === null || gmv < t.to)) return t;
  }
  return tiers[tiers.length - 1] || null;
}

function getNextTier(tiers: Tier[], gmv: number): Tier | null {
  const sorted = [...tiers].sort((a, b) => a.from - b.from);
  for (const t of sorted) {
    if (t.from > gmv) return t;
  }
  return null;
}

export default function VendorCommissionTab() {
  // Mock current vendor GMV — in production this comes from orders aggregation
  const currentGmv = 28500;
  const [simGmv, setSimGmv] = useState(currentGmv);
  const [simRevenue, setSimRevenue] = useState(currentGmv);

  const { data: rules = [] } = useQuery({
    queryKey: ["vendor-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .or("vendor_id.is.null,is_default.eq.true")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Find the tiered rule (or default)
  const tieredRule = rules.find((r: any) => r.model === "tiered_gmv") || rules.find((r: any) => r.is_default);
  const tiers: Tier[] = (tieredRule?.model === "tiered_gmv" ? tieredRule.tiers : []) as Tier[];
  const sortedTiers = [...tiers].sort((a, b) => a.from - b.from);

  const currentTier = getTierForGmv(sortedTiers, currentGmv);
  const simTier = getTierForGmv(sortedTiers, simGmv);
  const nextTier = getNextTier(sortedTiers, currentGmv);

  const currentRate = currentTier?.rate ?? tieredRule?.fixed_rate ?? 12;
  const simRate = simTier?.rate ?? currentRate;

  const currentCommission = currentGmv * (currentRate / 100);
  const simCommission = simRevenue * (simRate / 100);
  const commissionDiff = simCommission - currentCommission;
  const rateDiff = simRate - currentRate;

  const maxSlider = sortedTiers.length > 0
    ? (sortedTiers[sortedTiers.length - 1].from * 1.5) || 300000
    : 300000;

  const gapToNext = nextTier ? nextTier.from - currentGmv : null;

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#1B5BDA14] flex items-center justify-center">
              <BarChart3 size={16} className="text-[#1B5BDA]" />
            </div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">GMV mensuel actuel</span>
          </div>
          <p className="text-xl font-bold text-[#1D2530]">{fmtEur(currentGmv)}</p>
        </VCard>
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#059669]/10 flex items-center justify-center">
              <Percent size={16} className="text-[#059669]" />
            </div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">Taux actuel</span>
          </div>
          <p className="text-xl font-bold text-[#1D2530]">{currentRate}%</p>
          <p className="text-[11px] text-[#8B95A5]">Commission : {fmtEur(currentCommission)}/mois</p>
        </VCard>
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <Target size={16} className="text-[#F59E0B]" />
            </div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">Prochain palier</span>
          </div>
          {nextTier ? (
            <>
              <p className="text-xl font-bold text-[#1D2530]">{nextTier.rate}%</p>
              <p className="text-[11px] text-[#8B95A5]">Encore {fmtEur(gapToNext!)} de GMV</p>
            </>
          ) : (
            <p className="text-sm font-medium text-[#059669]">Palier maximum atteint ✓</p>
          )}
        </VCard>
      </div>

      {/* Tier visualization */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-4 flex items-center gap-2">
          <Zap size={16} className="text-[#1B5BDA]" />
          Grille de paliers — Commission dégressive
        </h3>
        <div className="space-y-1.5">
          {sortedTiers.map((t, i) => {
            const isActive = currentTier?.from === t.from;
            const isSimActive = simTier?.from === t.from;
            const barWidth = Math.max(20, 100 - (i * 15));
            return (
              <div key={i} className="relative">
                <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${isActive ? "bg-[#1B5BDA]/5 ring-1 ring-[#1B5BDA]/30" : isSimActive ? "bg-[#F59E0B]/5 ring-1 ring-[#F59E0B]/30" : "bg-[#F8FAFC]"}`}>
                  {/* Tier range */}
                  <div className="w-[180px] shrink-0 text-[13px]">
                    <span className={isActive ? "font-semibold text-[#1B5BDA]" : "text-[#616B7C]"}>
                      {t.to ? `${fmtEur(t.from)} → ${fmtEur(t.to)}` : `> ${fmtEur(t.from)}`}
                    </span>
                  </div>
                  {/* Visual bar */}
                  <div className="flex-1 h-6 bg-[#E2E8F0] rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${isActive ? "bg-[#1B5BDA]" : isSimActive ? "bg-[#F59E0B]" : "bg-[#94A3B8]"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white drop-shadow">ACTUEL</span>
                      </div>
                    )}
                    {isSimActive && !isActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white drop-shadow">SIMULÉ</span>
                      </div>
                    )}
                  </div>
                  {/* Rate */}
                  <div className={`w-14 text-right text-sm font-bold ${isActive ? "text-[#1B5BDA]" : isSimActive ? "text-[#F59E0B]" : "text-[#1D2530]"}`}>
                    {t.rate}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {sortedTiers.length === 0 && tieredRule && (
          <div className="text-center py-6 text-[13px] text-[#8B95A5]">
            Votre modèle est à taux fixe ({tieredRule.fixed_rate}%). Contactez votre account manager pour passer en paliers dégressifs.
          </div>
        )}
      </VCard>

      {/* Simulator */}
      {sortedTiers.length > 0 && (
        <VCard>
          <h3 className="text-sm font-semibold text-[#1D2530] mb-1 flex items-center gap-2">
            <TrendingDown size={16} className="text-[#059669]" />
            Simulateur d'impact
          </h3>
          <p className="text-[11px] text-[#8B95A5] mb-5">Estimez votre commission en ajustant votre volume de ventes mensuel</p>

          <div className="space-y-5">
            {/* GMV Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-medium text-[#616B7C]">GMV mensuel estimé</label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={simGmv}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setSimGmv(v);
                      setSimRevenue(v);
                    }}
                    className="w-28 h-7 text-right text-[13px] font-semibold"
                  />
                  <span className="text-[12px] text-[#8B95A5]">€</span>
                </div>
              </div>
              <Slider
                value={[simGmv]}
                onValueChange={v => { setSimGmv(v[0]); setSimRevenue(v[0]); }}
                min={0}
                max={maxSlider}
                step={500}
                className="mt-1"
              />
              <div className="flex justify-between text-[10px] text-[#8B95A5] mt-1">
                <span>0 €</span>
                <span>{fmtEur(maxSlider)}</span>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                <p className="text-[11px] text-[#8B95A5] mb-1">Taux simulé</p>
                <p className={`text-2xl font-bold ${simRate < currentRate ? "text-[#059669]" : simRate > currentRate ? "text-[#EF4343]" : "text-[#1D2530]"}`}>
                  {simRate}%
                </p>
                {rateDiff !== 0 && (
                  <p className={`text-[11px] font-medium mt-0.5 ${rateDiff < 0 ? "text-[#059669]" : "text-[#EF4343]"}`}>
                    {rateDiff > 0 ? "+" : ""}{rateDiff.toFixed(1)} pts
                  </p>
                )}
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                <p className="text-[11px] text-[#8B95A5] mb-1">Commission estimée</p>
                <p className="text-2xl font-bold text-[#1D2530]">{fmtEur(simCommission)}</p>
                <p className="text-[11px] text-[#8B95A5]">/mois</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                <p className="text-[11px] text-[#8B95A5] mb-1">Économie vs actuel</p>
                <p className={`text-2xl font-bold ${commissionDiff < 0 ? "text-[#059669]" : commissionDiff > 0 ? "text-[#EF4343]" : "text-[#1D2530]"}`}>
                  {commissionDiff <= 0 ? "-" : "+"}{fmtEur(Math.abs(commissionDiff))}
                </p>
                {commissionDiff < 0 && <p className="text-[11px] text-[#059669] font-medium">Vous économisez!</p>}
              </div>
            </div>

            {/* Recommendation */}
            {nextTier && simGmv < nextTier.from && (
              <div className="bg-[#1B5BDA]/5 border border-[#1B5BDA]/20 rounded-lg p-3 flex items-start gap-2.5">
                <Info size={16} className="text-[#1B5BDA] mt-0.5 shrink-0" />
                <div className="text-[12px]">
                  <p className="font-medium text-[#1D2530]">
                    Augmentez votre GMV de {fmtEur(nextTier.from - simGmv)} pour atteindre le palier {nextTier.rate}%
                  </p>
                  <p className="text-[#616B7C] mt-0.5">
                    À {fmtEur(nextTier.from)} de GMV mensuel, votre commission passerait de {simRate}% à {nextTier.rate}%, 
                    soit une économie de {fmtEur(nextTier.from * (simRate / 100) - nextTier.from * (nextTier.rate / 100))}/mois.
                  </p>
                </div>
              </div>
            )}

            {!nextTier && sortedTiers.length > 0 && (
              <div className="bg-[#059669]/5 border border-[#059669]/20 rounded-lg p-3 flex items-start gap-2.5">
                <Zap size={16} className="text-[#059669] mt-0.5 shrink-0" />
                <div className="text-[12px]">
                  <p className="font-medium text-[#059669]">Vous bénéficiez du meilleur taux !</p>
                  <p className="text-[#616B7C] mt-0.5">Votre volume vous place dans le palier de commission le plus avantageux.</p>
                </div>
              </div>
            )}
          </div>
        </VCard>
      )}
    </div>
  );
}
