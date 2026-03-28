import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { VProductIcon } from "@/components/vendor/ui/VProductIcon";
import { VMiniBar } from "@/components/vendor/ui/VMiniBar";
import { opportunities } from "@/data/vendor-intel-mock";
import { vendorOffers } from "@/data/vendor-offers-mock";
import { Sparkles, TrendingUp, TrendingDown, Eye, Info } from "lucide-react";

export default function VendorOpportunities() {
  const [activeTab, setActiveTab] = useState("opportunities");
  const tabs = [
    { id: "opportunities", label: "Opportunites", badge: opportunities.length },
    { id: "pricewatch", label: "Veille prix" },
    { id: "trends", label: "Tendances" },
  ];

  const activeOffers = vendorOffers.filter(o => o.status === "active");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Intelligence Marche</h1>
        <VBadge color="#7C3AED">{opportunities.length} opportunites</VBadge>
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "opportunities" && (
        <div className="space-y-5">
          <VCard className="!border-l-4 !border-l-[#7C3AED] !bg-[#7C3AED08]">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-[#7C3AED]" />
              <span className="text-[12px] font-semibold text-[#7C3AED]">Recommandations personnalisees</span>
            </div>
            <p className="text-[12px] text-[#616B7C]">Ces produits correspondent a votre profil vendeur (categories, marques) et presentent une forte demande avec peu de concurrence.</p>
          </VCard>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {opportunities.map(opp => {
              const score = Math.min(100, Math.round(opp.demand * (1 / opp.offers) * 85));
              const volEstime = Math.round(opp.demand * 2.5);
              return (
                <VCard key={opp.sku} className="relative !p-4">
                  <VBadge color="#7C3AED" className="absolute top-3 right-3">{opp.match}</VBadge>
                  <div className="flex items-center gap-3 mb-4 pr-24">
                    <VProductIcon cat={opp.cat} size={42} />
                    <div>
                      <p className="text-[13px] font-semibold text-[#1D2530]">{opp.name}</p>
                      <p className="text-[10px] font-mono text-[#8B95A5]">{opp.sku}</p>
                      <p className="text-[11px] text-[#616B7C]">{opp.brand}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#F8FAFC] rounded-md p-2 text-center">
                      <p className="text-lg font-bold text-[#059669]">{opp.demand}%</p>
                      <p className="text-[10px] text-[#8B95A5]">Demande</p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-md p-2 text-center">
                      <p className="text-lg font-bold" style={{ color: opp.offers < 4 ? "#059669" : opp.offers < 7 ? "#F59E0B" : "#EF4343" }}>{opp.offers}</p>
                      <p className="text-[10px] text-[#8B95A5]">Offres actives</p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-md p-2 text-center">
                      <p className="text-lg font-bold text-[#1B5BDA]">{volEstime}</p>
                      <p className="text-[10px] text-[#8B95A5]">Vol. estime/mois</p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-md p-2 text-center">
                      <p className="text-[13px] font-bold text-[#1D2530]">{opp.avgPrice.toFixed(2)} EUR</p>
                      <p className="text-[10px] text-[#8B95A5]">Prix moy. · {opp.margin}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[#616B7C] font-medium">Score d'opportunite</span>
                      <span className="font-bold text-[#059669]">{score}%</span>
                    </div>
                    <VProgressBar value={score} color="#059669" height={6} />
                  </div>
                  <VBtn primary className="w-full !justify-center" icon="Plus">Creer une offre</VBtn>
                </VCard>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "pricewatch" && (
        <div className="space-y-5">
          <VCard className="!border-l-4 !border-l-[#1B5BDA]">
            <p className="text-[12px] text-[#616B7C]">
              <Info size={12} className="inline mr-1 text-[#1B5BDA]" />
              Veille prix en temps reel. Comparez votre prix avec le marche. Donnees issues de 12+ pharmacies en ligne belges.
            </p>
          </VCard>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {activeOffers.map(offer => {
              const ratio = offer.priceLivr / offer.marketAvg;
              const compColor = ratio < 1 ? "#059669" : ratio > 1.15 ? "#EF4343" : "#F59E0B";
              const compLabel = ratio < 1 ? "Competitif" : ratio > 1.15 ? "Alerte: >15% above market" : "Dans la norme";
              const priceStart = offer.priceHistory[0] || offer.priceLivr;
              const priceEnd = offer.priceHistory[offer.priceHistory.length - 1] || offer.priceLivr;
              const trending = priceEnd > priceStart ? "up" : priceEnd < priceStart ? "down" : "stable";

              return (
                <VCard key={offer.id} className="!p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#1D2530]">{offer.name}</p>
                      <p className="text-[10px] font-mono text-[#8B95A5]">{offer.sku} · TVA {offer.tva}%</p>
                    </div>
                    <VBadge color={compColor}>{compLabel}</VBadge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 rounded-md" style={{ backgroundColor: ratio < 1 ? "#F0FDF4" : ratio > 1.15 ? "#FEF2F2" : "#F8FAFC" }}>
                      <p className="text-[13px] font-bold" style={{ color: ratio < 1 ? "#059669" : ratio > 1.15 ? "#EF4343" : "#1D2530" }}>{offer.priceLivr.toFixed(2)}</p>
                      <p className="text-[9px] text-[#8B95A5]">Votre prix</p>
                    </div>
                    <div className="text-center p-2 bg-[#F8FAFC] rounded-md">
                      <p className="text-[13px] font-bold text-[#1D2530]">{offer.marketAvg.toFixed(2)}</p>
                      <p className="text-[9px] text-[#8B95A5]">Moy. marche</p>
                    </div>
                    <div className="text-center p-2 bg-[#F8FAFC] rounded-md">
                      <p className="text-[13px] font-bold text-[#059669]">{offer.marketBest.toFixed(2)}</p>
                      <p className="text-[9px] text-[#8B95A5]">Meilleur</p>
                    </div>
                  </div>
                  <div className="mb-2">
                    <VMiniBar data={offer.priceHistory} color="#1B5BDA" />
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {trending === "up" ? <TrendingUp size={12} className="text-[#EF4343]" /> : trending === "down" ? <TrendingDown size={12} className="text-[#059669]" /> : null}
                    <span className="text-[#616B7C]">{trending === "up" ? "Hausse" : trending === "down" ? "Baisse" : "Stable"} 30j : {priceStart.toFixed(2)} → {priceEnd.toFixed(2)} EUR</span>
                  </div>
                </VCard>
              );
            })}
          </div>

          <VCard>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-[#1D2530]">Indice de competitivite global</p>
                <p className="text-3xl font-bold text-[#1B5BDA] mt-1">72<span className="text-lg text-[#8B95A5] font-normal">/100</span></p>
              </div>
              <VProgressBar value={72} color="#1B5BDA" height={8} />
            </div>
            <p className="text-[12px] text-[#616B7C] mt-2">Vous etes competitif sur 5/8 de vos offres.</p>
          </VCard>
        </div>
      )}

      {activeTab === "trends" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VCard>
              <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Top 10 categories croissance MoM</h3>
              <div className="space-y-2.5">
                {[
                  { name: "Cremes solaires", growth: 180 }, { name: "Antihistaminiques", growth: 45 },
                  { name: "Gels douche hygiene", growth: 38 }, { name: "Analgesiques", growth: 32 },
                  { name: "Vitamines", growth: 28 }, { name: "Pansements", growth: 22 },
                  { name: "Huiles essentielles", growth: 18 }, { name: "Dentifrices", growth: 15 },
                  { name: "Serviettes hygieniques", growth: 12 }, { name: "Masques FFP2", growth: 8 },
                ].map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-[#8B95A5] w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[12px] font-medium text-[#1D2530]">{c.name}</span>
                        <span className="text-[11px] font-bold text-[#059669]">+{c.growth}%</span>
                      </div>
                      <VProgressBar value={c.growth} max={200} color="#059669" height={4} />
                    </div>
                  </div>
                ))}
              </div>
            </VCard>

            <VCard>
              <h3 className="text-sm font-semibold text-[#1D2530] mb-1">Produits emergents</h3>
              <p className="text-[11px] text-[#8B95A5] mb-3">Nouveaux produits avec fort volume de recherche (derniers 30j).</p>
              <div className="space-y-3">
                {[
                  { name: "Purificateur air UV-C", searches: 340, trend: "up" },
                  { name: "Detecteur CO2 interieur", searches: 280, trend: "up" },
                  { name: "Vaporisateur NaCl", searches: 210, trend: "up" },
                  { name: "Coussin cervical ergonomique", searches: 195, trend: "stable" },
                  { name: "Ceinture lombaire medicale", searches: 175, trend: "stable" },
                ].map(p => (
                  <div key={p.name} className="flex items-center justify-between bg-[#F8FAFC] rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      {p.trend === "up" ? <TrendingUp size={14} className="text-[#059669]" /> : <Eye size={14} className="text-[#8B95A5]" />}
                      <span className="text-[12px] font-medium text-[#1D2530]">{p.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#1B5BDA]">{p.searches} recherches</span>
                  </div>
                ))}
              </div>
            </VCard>
          </div>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Patterns saisonniers</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { period: "Avr-Mai", items: ["Cremes solaires +180%", "Apres-solaires +95%"], color: "#F59E0B" },
                { period: "Juin-Aout", items: ["Stabilite EPI", "Baisse analgesiques"], color: "#059669" },
                { period: "Septembre", items: ["Vitamines +45%", "Anticold +60%"], color: "#1B5BDA" },
                { period: "Oct-Dec", items: ["Desinfectants +120%", "Vitamines +85%"], color: "#7C3AED" },
              ].map(s => (
                <div key={s.period} className="bg-[#F8FAFC] rounded-lg p-3 border-t-[3px]" style={{ borderTopColor: s.color }}>
                  <p className="text-[12px] font-semibold text-[#1D2530] mb-2">{s.period}</p>
                  {s.items.map(item => <p key={item} className="text-[11px] text-[#616B7C]">{item}</p>)}
                </div>
              ))}
            </div>
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Differences regionales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px] text-[#616B7C]">
              <div>
                <p className="font-semibold text-[#1D2530] mb-1">Belgique</p>
                <p>Forte demande en EPI et diagnostics en Flandre. Wallonie plus orientée consommables et hygiène. Bruxelles : mix équilibré avec forte composante hospitality.</p>
              </div>
              <div>
                <p className="font-semibold text-[#1D2530] mb-1">Luxembourg</p>
                <p>Marche plus petit mais prix moyen +8% vs BE. Forte demande en materiel de diagnostic haut de gamme. Moins sensible au prix, plus a la qualite/marque.</p>
              </div>
            </div>
          </VCard>
        </div>
      )}
    </div>
  );
}
