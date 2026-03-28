import { useState } from "react";
import { ScrollableTable } from "@/components/shared/ScrollableTable";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VStat } from "@/components/vendor/ui/VStat";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { VProductIcon } from "@/components/vendor/ui/VProductIcon";
import { vendorOffers } from "@/data/vendor-offers-mock";
import { vendorProfile, buyerTypeColors } from "@/lib/vendor-tokens";
import { Check, Eye, Edit2, Info, TrendingDown, TrendingUp, Sliders, AlertTriangle, Layers } from "lucide-react";
import EditOfferPopup from "@/components/vendor/EditOfferPopup";
import PrixRefDetailPopup from "@/components/vendor/PrixRefDetailPopup";
import { mockPrixPublicByProduct, mockPrixParProfilByProduct } from "@/lib/mock/prix-ref-mock";
import { getPrixRef, calcSavings, formatPrixRef } from "@/lib/utils/prix-ref";

const statusLabels: Record<string, string> = { active: "Active", inactive: "Inactive", rupture: "Rupture", pending: "En attente" };
const statusColors: Record<string, string> = { active: "#059669", inactive: "#616B7C", rupture: "#EF4343", pending: "#F59E0B" };

export default function VendorOffers() {
  const [activeTab, setActiveTab] = useState("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editOffer, setEditOffer] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [prixRefDetail, setPrixRefDetail] = useState<string | null>(null);
  const [simProduct, setSimProduct] = useState(vendorOffers[0]?.id || "");
  const [simPriceHT, setSimPriceHT] = useState(vendorOffers[0]?.price || 0);
  const [simPort, setSimPort] = useState(vendorOffers[0]?.port || 0);
  const [simDiscount, setSimDiscount] = useState(0);

  const activeOffers = vendorOffers.filter(o => o.status === "active");
  const buyBoxCount = activeOffers.filter(o => o.buyBox).length;
  const ruptureCount = vendorOffers.filter(o => o.status === "rupture").length;
  const netMonth = activeOffers.reduce((sum, o) => sum + o.net * Math.floor(o.conversions / 2), 0);

  const tabs = [
    { id: "list", label: "Liste", badge: vendorOffers.length },
    { id: "simulator", label: "Simulateur prix" },
    { id: "performance", label: "Performance" },
    { id: "profiles", label: "Par profil / pays" },
    { id: "rules", label: "Regles client" },
    { id: "prixref", label: "vs Prix Ref.", badge: vendorOffers.filter(o => mockPrixParProfilByProduct[o.name]).length },
  ];

  const filtered = statusFilter === "all" ? vendorOffers : vendorOffers.filter(o => o.status === statusFilter);
  const statusCounts = { all: vendorOffers.length, active: activeOffers.length, inactive: vendorOffers.filter(o => o.status === "inactive").length, rupture: ruptureCount, pending: vendorOffers.filter(o => o.status === "pending").length };

  const toggleSelect = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === filtered.length ? [] : filtered.map(o => o.id));

  // Simulator
  const simOffer = vendorOffers.find(o => o.id === simProduct);
  const simPriceFinal = simPriceHT * (1 - simDiscount / 100);
  const simPriceLivr = simPriceFinal + simPort;
  const simCommission = simPriceFinal * (vendorProfile.commissionRate / 100);
  const simNet = simPriceFinal - simCommission;
  const simTVA = simOffer ? simPriceLivr * (simOffer.tva / 100) : 0;
  const simTTC = simPriceLivr + simTVA;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Mes Offres</h1>
        <div className="flex gap-2">
          <VBtn icon="Upload">Import</VBtn>
          <VBtn primary icon="Plus" onClick={() => setShowNew(true)}>Nouvelle offre</VBtn>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VStat label="Offres actives" value={activeOffers.length} icon="Tag" color="#059669" />
        <VStat label="Buy Box detenues" value={`${buyBoxCount}/${activeOffers.length}`} icon="Trophy" color="#1B5BDA" />
        <VStat label="En rupture" value={ruptureCount} icon="TriangleAlert" color="#EF4343" />
        <VStat label="Net en poche (mois)" value={`${netMonth.toLocaleString("fr-BE", { minimumFractionDigits: 0 })} EUR`} icon="Euro" color="#7C3AED" />
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* LIST TAB */}
      {activeTab === "list" && (
        <div className="space-y-3">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {(["all", "active", "inactive", "rupture", "pending"] as const).map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setSelected([]); }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${statusFilter === s ? "bg-[#1B5BDA] text-white" : "bg-[#F1F5F9] text-[#616B7C] hover:bg-[#E2E8F0]"}`}>
                {s === "all" ? "Tous" : statusLabels[s]} ({statusCounts[s]})
              </button>
            ))}
          </div>

          {/* Bulk actions */}
          {selected.length > 0 && (
            <VCard className="!py-2.5 !px-4 !border-l-4 !border-l-[#1B5BDA] flex items-center gap-3 flex-wrap">
              <span className="text-[12px] font-semibold text-[#1D2530]">{selected.length} selectionnee(s)</span>
              <VBtn small>Ajuster prix (+/-)</VBtn>
              <VBtn small>Activer</VBtn>
              <VBtn small>Desactiver</VBtn>
              <VBtn small icon="Download">Exporter</VBtn>
              <button onClick={() => setSelected([])} className="text-[11px] text-[#8B95A5] hover:text-[#EF4343] ml-auto">Effacer</button>
            </VCard>
          )}

          {/* Table */}
          <VCard className="!p-0 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="py-2.5 px-3 w-8"><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-[#CBD5E1]" /></th>
                    <th className="text-left py-2.5 px-2 font-medium">Produit</th>
                    <th className="text-left py-2.5 px-2 font-medium">CNK/EAN</th>
                    <th className="text-center py-2.5 px-2 font-medium">TVA</th>
                    <th className="text-center py-2.5 px-2 font-medium">Fulfill.</th>
                    <th className="text-center py-2.5 px-2 font-medium">Conv.</th>
                    <th className="text-left py-2.5 px-2 font-medium">Pos. marche</th>
                    <th className="text-center py-2.5 px-2 font-medium">Stock</th>
                    <th className="text-center py-2.5 px-2 font-medium">Concur.</th>
                    <th className="text-center py-2.5 px-2 font-medium">Buy Box</th>
                    <th className="text-left py-2.5 px-2 font-medium">Profils</th>
                    <th className="text-left py-2.5 px-2 font-medium">Statut</th>
                    <th className="text-right py-2.5 px-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => {
                    const stockColor = o.stock === 0 ? "#EF4343" : o.stock < o.stockAlert ? "#F59E0B" : "#1D2530";
                    const rankColor = o.rank <= 2 ? "#059669" : o.rank <= 4 ? "#F59E0B" : "#EF4343";
                    const priceLivrColor = o.priceLivr <= (o.marketAvg || 999) ? "#059669" : "#F59E0B";
                    return (
                      <tr key={o.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-2.5 px-3"><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} className="rounded border-[#CBD5E1]" /></td>
                        <td className="py-2.5 px-2">
                          <p className="font-medium text-[#1D2530]">{o.name}</p>
                          <p className="text-[10px] font-mono text-[#8B95A5]">{o.sku}</p>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-[#8B95A5]">{o.cnk}<br />{o.ean.slice(-6)}</td>
                        <td className="py-2.5 px-2 text-center text-[11px] text-[#8B95A5]">{o.tva}%</td>
                        <td className="py-2.5 px-2 text-center text-[11px]" style={{ color: o.fulfillmentRate >= 95 ? "#059669" : "#F59E0B" }}>{o.fulfillmentRate}%</td>
                        <td className="py-2.5 px-2 text-center text-[11px] font-medium text-[#1D2530]">{o.conversions}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <VProgressBar value={o.priceLivr} max={o.marketAvg * 1.5} color={priceLivrColor} height={4} />
                            <span className="text-[11px] font-medium shrink-0" style={{ color: priceLivrColor }}>{o.priceLivr.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold" style={{ color: stockColor }}>
                          {o.stock}{o.stock > 0 && o.stock < o.stockAlert && <span className="text-[#F59E0B]"> !</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="font-semibold" style={{ color: rankColor }}>#{o.rank}</span>
                          <span className="text-[#8B95A5]">/{o.competing}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">{o.buyBox ? <Check size={14} className="text-[#059669] mx-auto" /> : <span className="text-[#CBD5E1]">—</span>}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-1 flex-wrap">
                            {o.profiles.slice(0, 3).map(p => {
                              const c = buyerTypeColors[p] || buyerTypeColors["Pharmacie"];
                              return <VBadge key={p} color={c.text} bg={c.bg} className="!text-[9px] !px-1.5">{p.slice(0, 3)}</VBadge>;
                            })}
                          </div>
                        </td>
                        <td className="py-2.5 px-2"><VBadge color={statusColors[o.status] || "#616B7C"}>{statusLabels[o.status] || o.status}</VBadge></td>
                        <td className="py-2.5 px-2 text-right">
                          <button onClick={() => setEditOffer(o.id)} className="p-1.5 hover:bg-[#F1F5F9] rounded transition-colors">
                            <Edit2 size={14} className="text-[#8B95A5]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          </VCard>
        </div>
      )}

      {/* SIMULATOR TAB */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Parametres</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Produit</label>
                <select value={simProduct} onChange={e => { setSimProduct(e.target.value); const o = vendorOffers.find(x => x.id === e.target.value); if (o) { setSimPriceHT(o.price); setSimPort(o.port); setSimDiscount(0); } }} className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
                  {vendorOffers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Prix HT</label>
                  <input type="number" value={simPriceHT} onChange={e => setSimPriceHT(+e.target.value)} step="0.10" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Frais de port</label>
                  <input type="number" value={simPort} onChange={e => setSimPort(+e.target.value)} step="0.10" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">What-if baisse prix : {simDiscount}%</label>
                <input type="range" min={0} max={50} value={simDiscount} onChange={e => setSimDiscount(+e.target.value)} className="w-full mt-1 accent-[#1B5BDA]" />
              </div>
            </div>
          </VCard>
          <div className="space-y-4">
            <VCard>
              <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Decomposition prix</h3>
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-[#616B7C]">Votre prix HT</span><span className="font-medium">{simPriceFinal.toFixed(2)} EUR</span></div>
                <div className="flex justify-between"><span className="text-[#616B7C]">+ Frais de port</span><span>{simPort.toFixed(2)} EUR</span></div>
                <div className="flex justify-between border-t border-[#E2E8F0] pt-2"><span className="font-medium">= Prix livre HT</span><span className="font-medium">{simPriceLivr.toFixed(2)} EUR</span></div>
                <div className="flex justify-between"><span className="text-[#616B7C]">+ TVA {simOffer?.tva || 0}%</span><span>{simTVA.toFixed(2)} EUR</span></div>
                <div className="flex justify-between"><span className="font-medium">= Prix TTC</span><span className="font-medium">{simTTC.toFixed(2)} EUR</span></div>
                <div className="flex justify-between"><span className="text-[#EF4343]">- Commission ({vendorProfile.commissionRate}%)</span><span className="text-[#EF4343]">-{simCommission.toFixed(2)} EUR</span></div>
                <div className="flex justify-between border-t border-[#E2E8F0] pt-2"><span className="font-bold text-[#059669]">Net en poche</span><span className="font-bold text-[#059669] text-lg">{simNet.toFixed(2)} EUR</span></div>
              </div>
            </VCard>
            {simOffer && (
              <VCard>
                <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Benchmark marche</h3>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-[#616B7C]">Votre prix livre</span><span className="font-medium" style={{ color: simPriceLivr <= simOffer.marketAvg ? "#059669" : "#F59E0B" }}>{simPriceLivr.toFixed(2)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-[#616B7C]">Moyenne marche</span><span>{simOffer.marketAvg.toFixed(2)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-[#616B7C]">Meilleur prix</span><span className="text-[#059669]">{simOffer.marketBest.toFixed(2)} EUR</span></div>
                </div>
              </VCard>
            )}
          </div>
        </div>
      )}

      {/* PERFORMANCE TAB */}
      {activeTab === "performance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Performance par offre</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeOffers.slice(0, 4).map(o => (
                  <VCard key={o.id} className="!p-4">
                    <p className="text-[13px] font-semibold text-[#1D2530] mb-2">{o.name}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-lg font-bold text-[#1B5BDA]">{o.views}</p><p className="text-[10px] text-[#8B95A5]">Vues</p></div>
                      <div><p className="text-lg font-bold text-[#059669]">{o.conversions}</p><p className="text-[10px] text-[#8B95A5]">Conv.</p></div>
                      <div><p className="text-lg font-bold text-[#7C3AED]">{o.conversionRate}%</p><p className="text-[10px] text-[#8B95A5]">Taux</p></div>
                    </div>
                  </VCard>
                ))}
              </div>
            </div>
            <VCard>
              <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Criteres Buy Box</h3>
              <div className="space-y-3">
                {[{ label: "Prix", weight: 40, score: 85 }, { label: "Fulfillment", weight: 30, score: 92 }, { label: "Note client", weight: 20, score: 78 }, { label: "Stock", weight: 10, score: 95 }].map(c => (
                  <div key={c.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#616B7C]">{c.label} ({c.weight}%)</span>
                      <span className="font-medium text-[#1D2530]">{c.score}%</span>
                    </div>
                    <VProgressBar value={c.score} color={c.score >= 80 ? "#059669" : "#F59E0B"} height={6} />
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-[#EFF6FF] rounded-lg p-3 text-[11px] text-[#1B5BDA]">
                <Info size={12} className="inline mr-1" />
                Ameliorez votre prix sur les Masques FFP2 pour recuperer la Buy Box.
              </div>
            </VCard>
          </div>

          {/* Price history */}
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Historique des prix</h3>
            <ScrollableTable className="mb-4">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Prix HT</th>
                    <th className="text-right py-2 font-medium">Prix livre</th>
                    <th className="text-left py-2 font-medium">Modifie par</th>
                    <th className="text-left py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorOffers[0].priceLog.map((l, i) => (
                    <tr key={i} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="py-2 text-[#8B95A5]">{l.date}</td>
                      <td className="py-2 text-right font-medium">{l.price.toFixed(2)} EUR</td>
                      <td className="py-2 text-right">{l.priceLivr.toFixed(2)} EUR</td>
                      <td className="py-2"><VBadge color="#1B5BDA">{l.by}</VBadge></td>
                      <td className="py-2 text-[#616B7C]">{l.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 text-[12px] text-[#92400E]">
              <AlertTriangle size={12} className="inline mr-1.5 text-[#F59E0B]" />
              Les changements de prix s'appliquent uniquement aux commandes futures. Les commandes passees conservent le prix au moment de la vente.
            </div>
          </VCard>
        </div>
      )}

      {/* PROFILES TAB */}
      {activeTab === "profiles" && (
        <div className="space-y-4">
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Configuration par profil / pays</h3>
            <ScrollableTable>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2 font-medium">Profil</th>
                    <th className="text-left py-2 font-medium">Pays</th>
                    <th className="text-right py-2 font-medium">Prix livre</th>
                    <th className="text-center py-2 font-medium">Port inclus</th>
                    <th className="text-center py-2 font-medium">MOQ</th>
                    <th className="text-center py-2 font-medium">MOV</th>
                    <th className="text-center py-2 font-medium">Delai</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { profile: "Pharmacie", country: "BE", priceLivr: "29,40", portIncl: true, moq: 2, mov: "—", delay: "2-3j", status: "active" },
                    { profile: "Hopital", country: "BE", priceLivr: "27,50", portIncl: true, moq: 10, mov: "500", delay: "1-2j", status: "active" },
                    { profile: "MRS", country: "BE", priceLivr: "29,40", portIncl: false, moq: 2, mov: "—", delay: "3-5j", status: "active" },
                    { profile: "Pharmacie", country: "LU", priceLivr: "32,00", portIncl: true, moq: 5, mov: "200", delay: "4-6j", status: "active" },
                    { profile: "Cabinet", country: "BE", priceLivr: "29,40", portIncl: false, moq: 1, mov: "—", delay: "2-3j", status: "inactive" },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="py-2.5"><VBadge color={(buyerTypeColors as any)[r.profile]?.text || "#616B7C"}>{r.profile}</VBadge></td>
                      <td className="py-2.5 font-medium">{r.country}</td>
                      <td className="py-2.5 text-right font-medium">{r.priceLivr} EUR</td>
                      <td className="py-2.5 text-center">{r.portIncl ? <Check size={14} className="text-[#059669] mx-auto" /> : <span className="text-[#CBD5E1]">—</span>}</td>
                      <td className="py-2.5 text-center">{r.moq}</td>
                      <td className="py-2.5 text-center text-[#8B95A5]">{r.mov}</td>
                      <td className="py-2.5 text-center text-[#8B95A5]">{r.delay}</td>
                      <td className="py-2.5"><VBadge color={r.status === "active" ? "#059669" : "#616B7C"}>{r.status === "active" ? "Actif" : "Inactif"}</VBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Seuils d'alerte stock</h3>
            <ScrollableTable>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2 font-medium">Produit</th>
                    <th className="text-center py-2 font-medium">Stock actuel</th>
                    <th className="text-center py-2 font-medium">Seuil alerte</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorOffers.filter(o => o.status !== "pending").map(o => (
                    <tr key={o.id} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="py-2.5 font-medium text-[#1D2530]">{o.name}</td>
                      <td className="py-2.5 text-center font-semibold" style={{ color: o.stock === 0 ? "#EF4343" : o.stock < o.stockAlert ? "#F59E0B" : "#059669" }}>{o.stock}</td>
                      <td className="py-2.5 text-center text-[#8B95A5]">{o.stockAlert}</td>
                      <td className="py-2.5">
                        {o.stock === 0 ? <VBadge color="#EF4343">Rupture</VBadge> : o.stock < o.stockAlert ? <VBadge color="#F59E0B">Bas</VBadge> : <VBadge color="#059669">OK</VBadge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </VCard>
        </div>
      )}

      {/* RULES TAB */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 text-[12px] text-[#1B5BDA]">
            <Info size={12} className="inline mr-1.5" />
            Les regles client permettent de definir un prix specifique, un MOQ ou un MOV pour un client, un pays ou un profil utilisateur.
          </div>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Regles existantes</h3>
            <ScrollableTable>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2 font-medium">Client</th>
                    <th className="text-left py-2 font-medium">Produit</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-right py-2 font-medium">Valeur</th>
                    <th className="text-center py-2 font-medium">MOQ</th>
                    <th className="text-center py-2 font-medium">MOV</th>
                    <th className="text-left py-2 font-medium">Valide jusqu'au</th>
                    <th className="text-left py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorOffers.flatMap(o => o.clientRules.map((r, i) => (
                    <tr key={`${o.id}-${i}`} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="py-2.5 font-medium text-[#1D2530]">{r.clientId}</td>
                      <td className="py-2.5 text-[#616B7C]">{o.name}</td>
                      <td className="py-2.5"><VBadge color={r.type === "fixed" ? "#1B5BDA" : "#7C3AED"}>{r.type === "fixed" ? "Prix fixe" : "Remise %"}</VBadge></td>
                      <td className="py-2.5 text-right font-medium">{r.type === "fixed" ? `${r.priceLivr?.toFixed(2)} EUR` : `-${r.discount}%`}</td>
                      <td className="py-2.5 text-center">{r.moq}</td>
                      <td className="py-2.5 text-center">{r.mov ? `${r.mov} EUR` : "—"}</td>
                      <td className="py-2.5 text-[#8B95A5]">{r.validUntil}</td>
                      <td className="py-2.5 text-[#616B7C]">{r.note || "—"}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </ScrollableTable>
          </VCard>

          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-4">Creer une nouvelle regle</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Client / Profil / Pays</label>
                <select className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
                  <option>Pharmacie Centrale</option>
                  <option>Hopital Saint-Pierre</option>
                  <option>Profil: Pharmacie</option>
                  <option>Profil: Hopital</option>
                  <option>Pays: BE</option>
                  <option>Pays: LU</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Produit</label>
                <select className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
                  {vendorOffers.map(o => <option key={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Type</label>
                <select className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0] bg-white">
                  <option>Prix fixe</option>
                  <option>Remise %</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Valeur</label>
                <input type="number" placeholder="0,00" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">MOQ</label>
                <input type="number" placeholder="1" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Date validite</label>
                <input type="date" className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Note</label>
              <input type="text" placeholder="Note optionnelle..." className="w-full mt-1 px-3 py-2 text-[13px] rounded-md border border-[#E2E8F0]" />
            </div>
            <div className="mt-4">
              <VBtn primary icon="Plus">Creer la regle</VBtn>
            </div>
          </VCard>
        </div>
      )}

      {/* VS PRIX REF TAB */}
      {activeTab === "prixref" && (() => {
        const offersWithRef = vendorOffers.filter(o => mockPrixParProfilByProduct[o.name]);
        const offersWithoutRef = vendorOffers.filter(o => !mockPrixParProfilByProduct[o.name]);
        const competitive = offersWithRef.filter(o => {
          const ref = getPrixRef(mockPrixParProfilByProduct[o.name], mockPrixPublicByProduct[o.name], "Pharmacie", "BE");
          return ref && o.priceLivr < ref.price;
        }).length;
        const above = offersWithRef.length - competitive;
        const avgSavings = offersWithRef.length > 0
          ? Math.round(offersWithRef.reduce((sum, o) => {
              const ref = getPrixRef(mockPrixParProfilByProduct[o.name], mockPrixPublicByProduct[o.name], "Pharmacie", "BE");
              if (!ref) return sum;
              return sum + Math.round(((ref.price - o.priceLivr) / ref.price) * 100);
            }, 0) / offersWithRef.length)
          : 0;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#1D2530]">Positionnement vs Prix de Reference</p>
              <span className="text-[11px] text-[#8B95A5]">Lecture seule — Prix de reference geres par MediKong</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <VStat label="Offres competitives" value={`${competitive}/${offersWithRef.length}`} icon="TrendingDown" color="#059669" />
              <VStat label="Economie moy. acheteur" value={`-${avgSavings}%`} icon="Percent" color="#1B5BDA" />
              <VStat label="Au-dessus du ref." value={above} icon="TrendingUp" color="#F59E0B" />
              <VStat label="Sans prix ref." value={offersWithoutRef.length} icon="CircleHelp" color="#8B95A5" />
            </div>

            <VCard className="!p-0 overflow-hidden">
              <ScrollableTable>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                      <th className="text-left py-2.5 px-3 font-medium">Produit</th>
                      <th className="text-right py-2.5 px-2 font-medium">Votre prix HT</th>
                      <th className="text-center py-2.5 px-2 font-medium">Pharmacie BE</th>
                      <th className="text-center py-2.5 px-2 font-medium">Hopital BE</th>
                      <th className="text-center py-2.5 px-2 font-medium">Infirmier BE</th>
                      <th className="text-center py-2.5 px-2 font-medium">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorOffers.map(o => {
                      const profilData = mockPrixParProfilByProduct[o.name];
                      const pubData = mockPrixPublicByProduct[o.name];
                      const getRefFor = (profil: "Pharmacie" | "Hopital" | "Infirmier") => getPrixRef(profilData, pubData, profil, "BE");
                      const pharma = getRefFor("Pharmacie");
                      const hop = getRefFor("Hopital");
                      const inf = getRefFor("Infirmier");

                      const savings = (ref: ReturnType<typeof getPrixRef>) => {
                        if (!ref) return null;
                        return calcSavings(ref.price, o.priceLivr, ref.source, ref.date);
                      };
                      const sPharma = savings(pharma);
                      const sHop = savings(hop);
                      const sInf = savings(inf);

                      const greens = [sPharma, sHop, sInf].filter(s => s && s.pct > 0).length;
                      const reds = [sPharma, sHop, sInf].filter(s => s && s.pct < 0).length;
                      const impact = greens >= 2 && reds === 0 ? "Fort" : reds >= 2 ? "Risque" : "Moyen";
                      const impactColor = impact === "Fort" ? "#059669" : impact === "Risque" ? "#EF4343" : "#F59E0B";
                      const impactBg = impact === "Fort" ? "#ECFDF5" : impact === "Risque" ? "#FEF2F2" : "#FFFBEB";

                      const renderRef = (s: ReturnType<typeof calcSavings> | null, ref: ReturnType<typeof getPrixRef>) => {
                        if (!ref) return <span className="text-[#CBD5E1]">—</span>;
                        const color = s && s.pct > 0 ? "#059669" : s && s.pct < 0 ? "#EF4343" : "#8B95A5";
                        return (
                          <div>
                            <p className="text-[11px] text-[#8B95A5]">Ref: {formatPrixRef(ref.price)}</p>
                            <p className="text-[12px] font-bold" style={{ color }}>{s ? (s.pct > 0 ? `-${s.pct}%` : `+${Math.abs(s.pct)}%`) : "="}</p>
                          </div>
                        );
                      };

                      return (
                        <tr key={o.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => setPrixRefDetail(o.id)}>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-[#1D2530]">{o.name}</p>
                            <p className="text-[10px] text-[#8B95A5]">{o.ean}</p>
                          </td>
                          <td className="py-2.5 px-2 text-right font-bold text-[#1D2530]">{o.priceLivr.toFixed(2)} EUR</td>
                          <td className="py-2.5 px-2 text-center">{renderRef(sPharma, pharma)}</td>
                          <td className="py-2.5 px-2 text-center">{renderRef(sHop, hop)}</td>
                          <td className="py-2.5 px-2 text-center">{renderRef(sInf, inf)}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ color: impactColor, backgroundColor: impactBg }}>{impact}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
            </VCard>

            {/* Pricing Coach */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-indigo-200 rounded-[10px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={16} className="text-indigo-700" />
                <span className="text-[14px] font-bold text-indigo-700">Pricing Coach — Recommandations</span>
              </div>
              <ul className="space-y-2 text-[13px] text-[#1D2530]">
                {vendorOffers.filter(o => {
                  const profilData = mockPrixParProfilByProduct[o.name];
                  if (!profilData) return false;
                  const pharma = getPrixRef(profilData, mockPrixPublicByProduct[o.name], "Pharmacie", "BE");
                  return pharma && o.priceLivr > pharma.price;
                }).slice(0, 3).map(o => {
                  const profilData = mockPrixParProfilByProduct[o.name]!;
                  const pharma = getPrixRef(profilData, mockPrixPublicByProduct[o.name], "Pharmacie", "BE")!;
                  const hop = getPrixRef(profilData, mockPrixPublicByProduct[o.name], "Hopital", "BE");
                  const pharmaPct = Math.round(((o.priceLivr - pharma.price) / pharma.price) * 100);
                  const hopPct = hop ? Math.round(((o.priceLivr - hop.price) / hop.price) * 100) : null;
                  const targetPrice = Math.min(pharma.price, hop?.price || Infinity) * 0.98;

                  return (
                    <li key={o.id}>
                      <span className="text-purple-700 font-bold mr-1">→</span>
                      <strong>{o.name}</strong> — Votre prix est au-dessus du ref. Pharmacie (+{pharmaPct}%)
                      {hopPct && hopPct > 0 ? ` et Hopital (+${hopPct}%)` : ""}.
                      {" "}Baissez a {formatPrixRef(targetPrice)} pour etre competitif.
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* Edit Offer Popup */}
      {editOffer && <EditOfferPopup offerId={editOffer} onClose={() => setEditOffer(null)} />}
      {showNew && <EditOfferPopup onClose={() => setShowNew(false)} />}
      {prixRefDetail && (() => {
        const o = vendorOffers.find(x => x.id === prixRefDetail);
        return o ? <PrixRefDetailPopup offer={o} onClose={() => setPrixRefDetail(null)} /> : null;
      })()}
    </div>
  );
}
