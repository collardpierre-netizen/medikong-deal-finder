import { useState, useMemo } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Percent, BarChart3, TrendingDown, Target, Award } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => n.toLocaleString("fr-BE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtEur = (n: number) => `${fmt(n)} €`;

const TIERS = [
  { name: "Starter", rate: 20, icon: "🥉", min: 0, max: 10000, color: "#8B95A5", features: ["Référencement standard", "Dashboard vendeur", "Support email", "Paiement J+30"] },
  { name: "Pro", rate: 15, icon: "🥈", min: 10000, max: 50000, color: "#1B5BDA", features: ["Boost référencement (+15%)", "Priorité Buy Box", "Badge Vendeur vérifié", "Account manager", "Paiement J+20"] },
  { name: "Expert", rate: 10, icon: "🥇", min: 50000, max: Infinity, color: "#059669", features: ["Référencement premium", "Badge Top Vendeur", "Promos sponsorisées", "API dédiée", "Support VIP", "Paiement J+15"] },
];

function getTier(gmv: number) {
  return TIERS.find(t => gmv >= t.min && gmv < t.max) || TIERS[0];
}

export default function VendorCommissionTab() {
  const currentGmv = 28500;
  const [simGmv, setSimGmv] = useState(currentGmv);

  const currentTier = getTier(currentGmv);
  const simTier = getTier(simGmv);

  const currentCommission = currentGmv * (currentTier.rate / 100);
  const simCommission = simGmv * (simTier.rate / 100);
  const commissionDiff = simCommission - currentCommission;

  return (
    <div className="space-y-4">
      {/* Current tier banner */}
      <VCard className="!p-4 bg-gradient-to-r from-[#1B5BDA]/5 to-transparent border-[#1B5BDA]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1B5BDA]/10 flex items-center justify-center text-xl">
            {currentTier.icon}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1D2530]">Votre palier : {currentTier.name} — {currentTier.rate}%</p>
            <p className="text-[11px] text-[#8B95A5]">GMV actuel : {fmtEur(currentGmv)}/mois</p>
          </div>
          <VBadge color={currentTier.color} className="ml-auto">{currentTier.rate}%</VBadge>
        </div>
      </VCard>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TIERS.map(tier => {
          const isActive = tier.name === currentTier.name;
          return (
            <VCard key={tier.name} className={`!p-4 ${isActive ? "ring-2 ring-[#1B5BDA]/40" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{tier.icon}</span>
                <div>
                  <p className="text-[13px] font-bold text-[#1D2530]">{tier.name}</p>
                  <p className="text-[11px] text-[#8B95A5]">
                    {tier.max === Infinity ? `${fmt(tier.min)} €+/mois` : `${fmt(tier.min)} – ${fmt(tier.max)} €/mois`}
                  </p>
                </div>
                <span className="ml-auto text-xl font-bold" style={{ color: tier.color }}>{tier.rate}%</span>
              </div>
              <div className="space-y-1.5">
                {tier.features.map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-[11px] text-[#616B7C]">
                    <span style={{ color: tier.color }}>✓</span> {f}
                  </div>
                ))}
              </div>
              {isActive && (
                <div className="mt-3 flex items-center gap-1.5">
                  <Award size={12} className="text-[#1B5BDA]" />
                  <span className="text-[10px] font-semibold text-[#1B5BDA]">Votre palier actuel</span>
                </div>
              )}
            </VCard>
          );
        })}
      </div>

      {/* KPI row */}
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
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">Commission</span>
          </div>
          <p className="text-xl font-bold text-[#1D2530]">{currentTier.rate}%</p>
          <p className="text-[11px] text-[#8B95A5]">{fmtEur(currentCommission)}/mois</p>
        </VCard>
        <VCard className="!p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center"><Target size={16} className="text-[#F59E0B]" /></div>
            <span className="text-[11px] text-[#8B95A5] uppercase tracking-wide">Prochain palier</span>
          </div>
          {currentTier.name !== "Expert" ? (
            <>
              <p className="text-xl font-bold text-[#1D2530]">{TIERS[TIERS.indexOf(currentTier) + 1]?.name}</p>
              <p className="text-[11px] text-[#8B95A5]">À {fmtEur(currentTier.max)} GMV/mois</p>
            </>
          ) : (
            <p className="text-xl font-bold text-[#059669]">🎉 Palier max</p>
          )}
        </VCard>
      </div>

      {/* Simulator */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-1 flex items-center gap-2">
          <TrendingDown size={16} className="text-[#059669]" /> Simulateur d'impact
        </h3>
        <p className="text-[11px] text-[#8B95A5] mb-5">Augmentez votre volume pour débloquer un palier plus avantageux</p>
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
            {/* Tier markers */}
            <div className="flex justify-between mt-1 text-[9px] text-[#8B95A5]">
              <span>0 €</span>
              <span className="text-[#8B95A5]">|10k Starter→Pro</span>
              <span className="text-[#1B5BDA]">|50k Pro→Expert</span>
              <span>300k €</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#8B95A5] mb-1">Palier simulé</p>
              <p className="text-lg font-bold text-[#1D2530]">{simTier.icon} {simTier.name}</p>
              <p className="text-[11px] font-semibold" style={{ color: simTier.color }}>{simTier.rate}%</p>
            </div>
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
