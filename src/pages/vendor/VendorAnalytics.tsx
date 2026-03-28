import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { analyticsData } from "@/data/vendor-intel-mock";
import { buyerTypeColors } from "@/lib/vendor-tokens";
import { Download, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

export default function VendorAnalytics() {
  const [period, setPeriod] = useState("6");
  const maxCA = Math.max(...analyticsData.caMonthly.map(m => m.value));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Analytics</h1>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="text-[13px] px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white">
            <option value="3">3 mois</option>
            <option value="6">6 mois</option>
            <option value="12">12 mois</option>
          </select>
          <VBtn icon="Download">Exporter</VBtn>
        </div>
      </div>

      {/* CA mensuel */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-4">CA mensuel</h3>
        <div className="flex items-end gap-3 h-40">
          {analyticsData.caMonthly.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-[#1D2530]">{(m.value / 1000).toFixed(1)}k</span>
              <div className="w-full rounded-t-sm bg-[#1B5BDA]" style={{ height: `${(m.value / maxCA) * 100}%` }} />
              <span className="text-[10px] text-[#8B95A5]">{m.month}</span>
            </div>
          ))}
        </div>
      </VCard>

      {/* Conversion & Buy Box */}
      <VCard>
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-sm font-semibold text-[#1D2530]">Taux conversion & Buy Box</h3>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#059669] rounded-sm" /> Conversion</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#1B5BDA40] rounded-sm" /> Buy Box</span>
          </div>
        </div>
        <div className="flex items-end gap-3 h-32">
          {analyticsData.conversionBuyBox.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full relative" style={{ height: "100%" }}>
                <div className="absolute bottom-0 w-full rounded-t-sm bg-[#1B5BDA20]" style={{ height: `${m.buyBox}%` }} />
                <div className="absolute bottom-0 w-full rounded-t-sm bg-[#059669]" style={{ height: `${m.conversion}%`, width: "60%", left: "20%" }} />
              </div>
              <span className="text-[10px] text-[#8B95A5]">{m.month}</span>
            </div>
          ))}
        </div>
      </VCard>

      {/* Funnel */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Entonnoir de vente</h3>
        <div className="space-y-2">
          {analyticsData.funnel.map((step, i) => {
            const width = (step.value / analyticsData.funnel[0].value) * 100;
            const colors = ["#1B5BDA", "#059669", "#7C3AED", "#F59E0B", "#059669"];
            return (
              <div key={step.step} className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-[#1D2530] w-24 shrink-0">{step.step}</span>
                <div className="flex-1 relative h-8">
                  <div className="h-full rounded-md flex items-center px-3" style={{ width: `${Math.max(width, 15)}%`, backgroundColor: colors[i] + "20" }}>
                    <span className="text-[12px] font-bold" style={{ color: colors[i] }}>{step.value.toLocaleString("fr-BE")}</span>
                  </div>
                </div>
                {step.rate !== undefined && (
                  <span className="text-[11px] font-medium text-[#616B7C] w-14 text-right shrink-0">{step.rate}%</span>
                )}
                {i < analyticsData.funnel.length - 1 && <ArrowRight size={12} className="text-[#CBD5E1] shrink-0" />}
              </div>
            );
          })}
        </div>
      </VCard>

      {/* Top products */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Top produits</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                <th className="text-center py-2 font-medium w-8">#</th>
                <th className="text-left py-2 font-medium">Produit</th>
                <th className="text-right py-2 font-medium">CA</th>
                <th className="text-center py-2 font-medium">Cmd</th>
                <th className="text-center py-2 font-medium">Conv.</th>
                <th className="text-left py-2 font-medium w-32">Perf.</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topProducts.map((p, i) => (
                <tr key={p.name} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="py-2.5 text-center font-bold text-[#8B95A5]">{i + 1}</td>
                  <td className="py-2.5 font-medium text-[#1D2530]">{p.name}</td>
                  <td className="py-2.5 text-right">{p.ca.toLocaleString("fr-BE")} EUR</td>
                  <td className="py-2.5 text-center">{p.orders}</td>
                  <td className="py-2.5 text-center">{p.conversion}%</td>
                  <td className="py-2.5"><VProgressBar value={p.perf} color={p.perf >= 80 ? "#059669" : p.perf >= 60 ? "#F59E0B" : "#EF4343"} height={6} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VCard>

      {/* Regions */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Repartition par region (BE+LU)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {analyticsData.regions.map(r => (
            <div key={r.name} className="bg-[#F8FAFC] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[#1D2530]">{r.name}</span>
                <span className="text-lg font-bold text-[#1B5BDA]">{r.pct}%</span>
              </div>
              <VProgressBar value={r.pct} color="#1B5BDA" height={6} />
              <div className="flex justify-between mt-2 text-[11px] text-[#8B95A5]">
                <span>{r.revenue.toLocaleString("fr-BE")} EUR</span>
                <span>{r.orders} cmd</span>
              </div>
            </div>
          ))}
        </div>
      </VCard>

      {/* vs Moyenne */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Comparaison vs moyennes vendeurs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {analyticsData.vsMoyenne.map(m => {
            const diff = m.lowerBetter ? m.avg - m.yours : m.yours - m.avg;
            const isGood = diff > 0;
            return (
              <div key={m.label} className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                <p className="text-[11px] text-[#8B95A5] mb-1">{m.label}</p>
                <p className="text-xl font-bold text-[#1D2530]">{m.yours}{m.unit}</p>
                <p className="text-[11px] text-[#8B95A5]">Moy. : {m.avg}{m.unit}</p>
                <p className="text-[11px] font-semibold mt-1 flex items-center justify-center gap-1" style={{ color: isGood ? "#059669" : "#EF4343" }}>
                  {isGood ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isGood ? "+" : ""}{(m.yours - m.avg).toFixed(1)}{m.unit}
                </p>
              </div>
            );
          })}
        </div>
      </VCard>

      {/* Profile distribution */}
      <VCard>
        <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Repartition par profil acheteur</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {analyticsData.profileDistribution.map(p => {
            const colors = buyerTypeColors[p.profile] || { text: "#616B7C", bg: "#616B7C18" };
            return (
              <div key={p.profile} className="rounded-lg p-3 text-center" style={{ backgroundColor: colors.bg }}>
                <p className="text-xl font-bold" style={{ color: colors.text }}>{p.pct}%</p>
                <p className="text-[11px] font-medium" style={{ color: colors.text }}>{p.profile}</p>
              </div>
            );
          })}
        </div>
      </VCard>
    </div>
  );
}
