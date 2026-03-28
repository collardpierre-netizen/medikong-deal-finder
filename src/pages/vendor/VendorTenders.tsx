import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";
import { tenders, quotationRequests } from "@/data/vendor-intel-mock";
import { buyerTypeColors } from "@/lib/vendor-tokens";
import { Clock, DollarSign, Package, ArrowRight, MessageSquare } from "lucide-react";

const tenderStatusLabels: Record<string, string> = { open: "Ouvert", submitted: "Soumis", won: "Gagne", lost: "Perdu" };
const tenderStatusColors: Record<string, string> = { open: "#059669", submitted: "#1B5BDA", won: "#059669", lost: "#EF4343" };

export default function VendorTenders() {
  const [activeTab, setActiveTab] = useState("tenders");
  const [tenderFilter, setTenderFilter] = useState("open");

  const pendingRFQ = quotationRequests.filter(r => r.status === "pending").length;
  const tabs = [
    { id: "tenders", label: "Appels d'offres", badge: tenders.length },
    { id: "rfq", label: "Demandes de devis", badge: pendingRFQ },
    { id: "responses", label: "Mes reponses" },
  ];

  const filteredTenders = tenders.filter(t => {
    if (tenderFilter === "open") return t.status === "open";
    if (tenderFilter === "submitted") return t.status === "submitted";
    return t.status === "won" || t.status === "lost";
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#1D2530]">Appels d'Offres & Devis</h1>
        <VBadge color="#059669">{tenders.filter(t => t.status === "open").length} AO + {pendingRFQ} RFQ</VBadge>
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === "tenders" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {["open", "submitted", "history"].map(f => (
              <button key={f} onClick={() => setTenderFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${tenderFilter === f ? "bg-[#1B5BDA] text-white" : "bg-[#F1F5F9] text-[#616B7C] hover:bg-[#E2E8F0]"}`}>
                {f === "open" ? "Ouverts" : f === "submitted" ? "Soumis" : "Historique"}
              </button>
            ))}
          </div>

          {tenderFilter === "history" ? (
            <VCard className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                      <th className="text-left py-2.5 px-3 font-medium">Ref</th>
                      <th className="text-left py-2.5 px-3 font-medium">Titre</th>
                      <th className="text-left py-2.5 px-3 font-medium">Acheteur</th>
                      <th className="text-right py-2.5 px-3 font-medium">Budget</th>
                      <th className="text-left py-2.5 px-3 font-medium">Resultat</th>
                      <th className="text-center py-2.5 px-3 font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenders.map(t => (
                      <tr key={t.id} className="border-b border-[#E2E8F0] last:border-0">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#8B95A5]">{t.id}</td>
                        <td className="py-2.5 px-3 font-medium text-[#1D2530]">{t.title}</td>
                        <td className="py-2.5 px-3 text-[#616B7C]">{t.buyer}</td>
                        <td className="py-2.5 px-3 text-right text-[#1D2530]">{t.budget}</td>
                        <td className="py-2.5 px-3"><VBadge color={tenderStatusColors[t.status]}>{tenderStatusLabels[t.status]}</VBadge></td>
                        <td className="py-2.5 px-3 text-center font-bold" style={{ color: t.matchScore >= 80 ? "#059669" : t.matchScore >= 60 ? "#F59E0B" : "#EF4343" }}>{t.matchScore}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </VCard>
          ) : (
            <div className="space-y-3">
              {filteredTenders.map(t => {
                const bt = buyerTypeColors[t.buyerType] || { text: "#616B7C", bg: "#616B7C18" };
                const matchColor = t.matchScore >= 80 ? "#059669" : t.matchScore >= 60 ? "#F59E0B" : "#EF4343";
                return (
                  <VCard key={t.id} className="!p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[15px] font-bold text-[#1D2530]">{t.title}</p>
                          <VBadge color={tenderStatusColors[t.status]}>{tenderStatusLabels[t.status]}</VBadge>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[12px] text-[#616B7C]">{t.buyer}</span>
                          <VBadge color={bt.text} bg={bt.bg}>{t.buyerType}</VBadge>
                        </div>
                        <div className="flex items-center gap-4 text-[12px] text-[#616B7C]">
                          <span className="flex items-center gap-1"><DollarSign size={12} /> {t.budget}</span>
                          <span className="flex items-center gap-1"><Package size={12} /> {t.items} articles</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {t.deadline}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {t.status === "open" && <VBtn small primary>Repondre</VBtn>}
                          <VBtn small>Voir le detail</VBtn>
                          {t.status === "submitted" && <VBtn small>Suivi</VBtn>}
                        </div>
                      </div>
                      <div className="text-center shrink-0">
                        <p className="text-3xl font-bold" style={{ color: matchColor }}>{t.matchScore}</p>
                        <p className="text-[10px] text-[#8B95A5]">Match</p>
                      </div>
                    </div>
                  </VCard>
                );
              })}
              {filteredTenders.length === 0 && <VEmptyState icon="FileText" title="Aucun appel d'offres" sub="Aucun AO dans cette categorie." />}
            </div>
          )}
        </div>
      )}

      {activeTab === "rfq" && (
        <div className="space-y-4">
          <VCard className="!border-l-4 !border-l-[#1B5BDA]">
            <p className="text-[12px] text-[#616B7C]">Les acheteurs demandent des devis directement depuis la fiche produit ou votre profil vendeur.</p>
          </VCard>

          {quotationRequests.filter(r => r.status === "pending").map(rfq => {
            const bt = buyerTypeColors[rfq.buyerType] || { text: "#616B7C", bg: "#616B7C18" };
            return (
              <VCard key={rfq.id} className="!p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[#1D2530]">{rfq.product}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px] text-[#616B7C]">{rfq.buyer}</span>
                      <VBadge color={bt.text} bg={bt.bg}>{rfq.buyerType}</VBadge>
                      <span className="text-[11px] text-[#8B95A5]">{rfq.date}</span>
                    </div>
                  </div>
                  <VBadge color={rfq.via === "fiche_produit" ? "#1B5BDA" : "#7C3AED"}>{rfq.via === "fiche_produit" ? "Depuis fiche produit" : "Depuis profil"}</VBadge>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-[#616B7C] mb-3">
                  <span>Qte : <strong className="text-[#1D2530]">{rfq.qty}</strong></span>
                  <span>Prix cible : <strong className="text-[#1D2530]">{rfq.targetPrice.toFixed(2)} EUR</strong></span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {rfq.deadline}</span>
                </div>
                <div className="bg-[#F8FAFC] rounded-lg p-3 mb-3 text-[12px] text-[#616B7C] italic">
                  "{rfq.message}"
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Prix propose (EUR)</label>
                    <input type="number" placeholder="0,00" step="0.01" className="w-full mt-1 px-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0]" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-[#616B7C] uppercase tracking-wide">Delai de livraison</label>
                    <input type="text" placeholder="2-3 jours" className="w-full mt-1 px-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0]" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <VBtn small primary>Repondre au devis</VBtn>
                  <VBtn small icon="MessageSquare">Contacter l'acheteur</VBtn>
                </div>
              </VCard>
            );
          })}
          {quotationRequests.filter(r => r.status === "pending").length === 0 && <VEmptyState icon="FileText" title="Aucune demande de devis" sub="Vous n'avez pas de RFQ en attente." />}
        </div>
      )}

      {activeTab === "responses" && (
        <VCard className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2.5 px-3 font-medium">Ref</th>
                  <th className="text-left py-2.5 px-3 font-medium">Acheteur</th>
                  <th className="text-left py-2.5 px-3 font-medium">Produit</th>
                  <th className="text-right py-2.5 px-3 font-medium">Votre prix</th>
                  <th className="text-left py-2.5 px-3 font-medium">Delai</th>
                  <th className="text-left py-2.5 px-3 font-medium">Statut</th>
                  <th className="text-left py-2.5 px-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {quotationRequests.filter(r => r.status === "replied").map(r => (
                  <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#8B95A5]">{r.id}</td>
                    <td className="py-2.5 px-3 font-medium text-[#1D2530]">{r.buyer}</td>
                    <td className="py-2.5 px-3 text-[#616B7C]">{r.product}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{r.targetPrice.toFixed(2)} EUR</td>
                    <td className="py-2.5 px-3 text-[#8B95A5]">2-3j</td>
                    <td className="py-2.5 px-3"><VBadge color="#059669">Repondu</VBadge></td>
                    <td className="py-2.5 px-3 text-[#8B95A5]">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VCard>
      )}
    </div>
  );
}
