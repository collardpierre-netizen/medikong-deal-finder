import { useState } from "react";
import { VCard } from "@/components/vendor/ui/VCard";
import { VTabBar } from "@/components/vendor/ui/VTabBar";
import { VStat } from "@/components/vendor/ui/VStat";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VProgressBar } from "@/components/vendor/ui/VProgressBar";
import { VProductIcon } from "@/components/vendor/ui/VProductIcon";
import { VEmptyState } from "@/components/vendor/ui/VEmptyState";
import { catalogProducts, catalogChanges, categoryStats, importHistory } from "@/data/vendor-mock";
import { categoryIconMap, buyerTypeColors } from "@/lib/vendor-tokens";
import { Search, Upload, Download, Eye, Plus, RefreshCw, X, BarChart3, FileSpreadsheet, Plug, ArrowRight, Sparkles, AlertTriangle } from "lucide-react";
import { icons } from "lucide-react";

const mdrColors: Record<string, string> = { I: "#1B5BDA", IIa: "#F59E0B", IIb: "#F59E0B", III: "#EF4343", "N/A": "#616B7C" };
const competLabels: Record<string, { label: string; color: string }> = {
  best: { label: "Meilleur prix", color: "#059669" },
  competitive: { label: "Competitif", color: "#1B5BDA" },
  above: { label: "Au-dessus", color: "#F59E0B" },
};

function concurrenceColor(n: number) {
  if (n < 4) return "#059669";
  if (n < 7) return "#F59E0B";
  return "#EF4343";
}
function demandeColor(n: number) { return n > 75 ? "#059669" : "#616B7C"; }

export default function VendorCatalog() {
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const totalRefs = categoryStats.reduce((a, c) => a + c.refs, 0);
  const totalMyOffers = categoryStats.reduce((a, c) => a + c.myOffers, 0);

  const tabs = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "browse", label: "Parcourir", badge: totalRefs },
    { id: "submissions", label: "Mes soumissions", badge: 2 },
    { id: "import", label: "Import offres" },
  ];

  const filteredProducts = catalogProducts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.ean.includes(q) || p.cnk.includes(q) || p.brand.toLowerCase().includes(q);
    const matchCat = !catFilter || p.cat === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#1D2530]">Catalogue MediKong</h1>
          <VBadge color="#1B5BDA">{totalRefs} references</VBadge>
        </div>
        <VBtn primary icon="Plus">Soumettre un nouveau produit</VBtn>
      </div>

      <VTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* TAB: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <VStat label="References catalogue" value={totalRefs} icon="Package" color="#1B5BDA" />
            <VStat label="Categories actives" value={categoryStats.length} icon="Grid3x3" color="#7C3AED" />
            <VStat label="Demande moyenne" value="78%" icon="TrendingUp" color="#059669" />
            <VStat label="Concurrence moyenne" value="4,8 offres/ref" icon="Users" color="#F59E0B" />
          </div>

          {/* Category grid */}
          <div>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Ventilation par categorie</h3>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {categoryStats.map(cs => {
                const catInfo = categoryIconMap[cs.cat] || { color: "#616B7C" };
                const opportunities = cs.refs - cs.myOffers;
                return (
                  <VCard key={cs.cat} className="!p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <VProductIcon cat={cs.cat} size={36} />
                      <div>
                        <p className="text-[13px] font-semibold text-[#1D2530]">{cs.cat}</p>
                        <p className="text-[11px] text-[#8B95A5]">{cs.refs} references</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-lg font-bold" style={{ color: catInfo.color }}>{cs.myOffers}</span>
                      <span className="text-[13px] text-[#8B95A5]">/ {cs.refs} offres</span>
                    </div>
                    <VProgressBar value={cs.myOffers} max={cs.refs} color={catInfo.color} height={6} />
                    <div className="flex items-center gap-4 mt-3 text-[11px]">
                      <span style={{ color: demandeColor(cs.demande) }} className="font-medium">Demande: {cs.demande}%</span>
                      <span style={{ color: concurrenceColor(cs.concurrence) }} className="font-medium">Concurrence: {cs.concurrence.toLocaleString("fr-BE", { minimumFractionDigits: 1 })}</span>
                    </div>
                    {opportunities > 0 && (
                      <button className="mt-3 text-[11px] font-semibold flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: catInfo.color }}>
                        Explorer {opportunities} opportunites <ArrowRight size={12} />
                      </button>
                    )}
                  </VCard>
                );
              })}
            </div>
          </div>

          {/* Catalog optimization */}
          <VCard className="!border-l-4 !border-l-[#7C3AED]">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-[#7C3AED]" />
              <h3 className="text-sm font-semibold text-[#1D2530]">Optimisation catalogue</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#F0FDF4] rounded-lg p-3.5 border border-[#BBF7D0]">
                <p className="text-[12px] font-semibold text-[#059669] mb-1">Forte demande + faible concurrence</p>
                <p className="text-[11px] text-[#616B7C]">14 references avec demande &gt;80% et &lt;3 offres</p>
              </div>
              <div className="bg-[#FFFBEB] rounded-lg p-3.5 border border-[#FDE68A]">
                <p className="text-[12px] font-semibold text-[#F59E0B] mb-1">Categories sous-couvertes</p>
                <p className="text-[11px] text-[#616B7C]">3 categories ou vous avez moins de 5% de couverture</p>
              </div>
              <div className="bg-[#EFF6FF] rounded-lg p-3.5 border border-[#BFDBFE]">
                <p className="text-[12px] font-semibold text-[#1B5BDA] mb-1">Suggestions par marque</p>
                <p className="text-[11px] text-[#616B7C]">8 nouvelles refs de vos marques actives</p>
              </div>
            </div>
          </VCard>

          {/* Recent changes */}
          <VCard className="!border-l-4 !border-l-[#1B5BDA]">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw size={16} className="text-[#1B5BDA]" />
              <h3 className="text-sm font-semibold text-[#1D2530]">Changements catalogue recents</h3>
            </div>
            <div className="space-y-2.5">
              {catalogChanges.map(c => {
                const sevColor = c.severity === "red" ? "#EF4343" : c.severity === "amber" ? "#F59E0B" : "#1B5BDA";
                const Icon = icons[c.icon as keyof typeof icons] || RefreshCw;
                return (
                  <div key={c.id} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: sevColor }} />
                    <Icon size={14} className="shrink-0 mt-0.5" style={{ color: sevColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#1D2530]">{c.message}</p>
                    </div>
                    {c.impactsMyOffers && <VBadge color="#EF4343">Impact sur vos offres</VBadge>}
                    <span className="text-[11px] text-[#8B95A5] shrink-0">{c.date}</span>
                  </div>
                );
              })}
            </div>
          </VCard>
        </div>
      )}

      {/* TAB: Browse */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          {/* Filters */}
          <VCard className="!p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, SKU, EAN, CNK, marque..." className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-md border border-[#E2E8F0] bg-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#1B5BDA] focus:bg-white" />
              </div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-[13px] px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white text-[#1D2530]">
                <option value="">Toutes categories</option>
                {Object.keys(categoryIconMap).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </VCard>

          {/* Products table */}
          <VCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2.5 px-3 font-medium w-8"></th>
                    <th className="text-left py-2.5 px-3 font-medium">Produit</th>
                    <th className="text-left py-2.5 px-3 font-medium">CNK/EAN</th>
                    <th className="text-left py-2.5 px-3 font-medium">Cat.</th>
                    <th className="text-left py-2.5 px-3 font-medium">Marque</th>
                    <th className="text-center py-2.5 px-3 font-medium">TVA</th>
                    <th className="text-center py-2.5 px-3 font-medium">MDR</th>
                    <th className="text-center py-2.5 px-3 font-medium">Offres</th>
                    <th className="text-left py-2.5 px-3 font-medium">Demande</th>
                    <th className="text-left py-2.5 px-3 font-medium">Competitivite</th>
                    <th className="text-right py-2.5 px-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const catInfo = categoryIconMap[p.cat] || { color: "#616B7C" };
                    const comp = p.competitivity ? competLabels[p.competitivity] : null;
                    const offColor = p.offers < 4 ? "#059669" : p.offers < 7 ? "#F59E0B" : "#EF4343";
                    return (
                      <tr key={p.sku} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-2.5 px-3"><VProductIcon cat={p.cat} size={28} /></td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-[#1D2530] text-[13px]">{p.name}</p>
                          <p className="text-[10px] font-mono text-[#8B95A5]">{p.sku} · {p.conditioning}</p>
                          {p.submittedBy && <VBadge color="#1B5BDA" className="mt-0.5">Soumis par vous</VBadge>}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#8B95A5]">{p.cnk}<br />{p.ean}</td>
                        <td className="py-2.5 px-3"><VBadge color={catInfo.color}>{p.cat}</VBadge></td>
                        <td className="py-2.5 px-3 text-[#1D2530]">{p.brand}</td>
                        <td className="py-2.5 px-3 text-center text-[11px] text-[#8B95A5]">{p.tva}%</td>
                        <td className="py-2.5 px-3 text-center"><VBadge color={mdrColors[p.mdr] || "#616B7C"}>{p.mdr}</VBadge></td>
                        <td className="py-2.5 px-3 text-center font-semibold" style={{ color: offColor }}>{p.offers}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <VProgressBar value={p.demande} height={4} color={demandeColor(p.demande)} />
                            <span className="text-[11px] text-[#8B95A5] shrink-0">{p.demande}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {comp ? <VBadge color={comp.color}>{comp.label}</VBadge> : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.hasMyOffer ? (
                              <VBadge color="#059669">Active</VBadge>
                            ) : (
                              <VBtn small primary>Offre</VBtn>
                            )}
                            <button className="p-1.5 hover:bg-[#F1F5F9] rounded transition-colors">
                              <Eye size={14} className="text-[#8B95A5]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0] text-[12px] text-[#8B95A5]">
              <span>1-{filteredProducts.length} sur {filteredProducts.length} resultats</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 rounded bg-[#1B5BDA] text-white font-medium">1</button>
              </div>
            </div>
          </VCard>
        </div>
      )}

      {/* TAB: Submissions */}
      {activeTab === "submissions" && (
        <div className="space-y-4">
          <p className="text-[13px] text-[#616B7C]">Soumettez de nouveaux produits au catalogue MediKong. Nos equipes valident chaque reference sous 48h.</p>

          {/* Drag & drop zone */}
          <div className="border-2 border-dashed border-[#CBD5E1] rounded-[10px] p-10 text-center bg-[#F8FAFC] hover:border-[#1B5BDA] hover:bg-[#EFF6FF] transition-colors">
            <Upload size={32} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[13px] font-semibold text-[#1D2530] mb-1">Deposez votre fiche produit</p>
            <p className="text-[11px] text-[#8B95A5] mb-4">PDF, XLSX ou images (max 10 Mo)</p>
            <div className="flex justify-center gap-3">
              <VBtn small primary icon="Upload">Deposer un fichier</VBtn>
              <VBtn small icon="PenLine">Saisie manuelle</VBtn>
            </div>
          </div>

          {/* Recent submissions */}
          <h3 className="text-sm font-semibold text-[#1D2530]">Soumissions recentes</h3>

          {/* In review */}
          <VCard className="!border-l-4 !border-l-[#F59E0B]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold text-[#1D2530]">Tensiometre Omron M3</p>
                <p className="text-[11px] text-[#8B95A5]">Soumis le 25/03/2026</p>
              </div>
              <VBadge color="#F59E0B">En revision</VBadge>
            </div>
            <div className="flex items-center gap-4 mb-3">
              {["Soumis", "En revision", "Approuve"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${i === 0 ? "bg-[#059669]" : i === 1 ? "bg-[#F59E0B] animate-pulse" : "bg-[#E2E8F0]"}`} />
                  <span className={`text-[11px] ${i <= 1 ? "text-[#1D2530] font-medium" : "text-[#8B95A5]"}`}>{step}</span>
                  {i < 2 && <span className="text-[#CBD5E1]">—</span>}
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-[#616B7C] cursor-pointer">
              <input type="checkbox" className="rounded border-[#CBD5E1]" defaultChecked />
              Me notifier par email a l'approbation
            </label>
          </VCard>

          {/* Rejected */}
          <VCard className="!border-l-4 !border-l-[#EF4343] !bg-[#FEF2F2]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-semibold text-[#1D2530]">Masque Chirurgical Type IIR</p>
                <p className="text-[11px] text-[#8B95A5]">Soumis le 20/03/2026</p>
              </div>
              <VBadge color="#EF4343">Rejete</VBadge>
            </div>
            <div className="bg-white rounded-md p-3 border border-[#FECACA] mb-3">
              <p className="text-[12px] text-[#EF4343] font-medium mb-1">Motif du rejet :</p>
              <p className="text-[12px] text-[#616B7C]">Reference deja existante dans le catalogue (CNK 4521-890). Veuillez utiliser la reference existante pour creer votre offre.</p>
            </div>
            <div className="flex gap-2">
              <VBtn small primary>Resoumettre</VBtn>
              <VBtn small>Contacter le support</VBtn>
            </div>
          </VCard>
        </div>
      )}

      {/* TAB: Import */}
      {activeTab === "import" && (
        <div className="space-y-5">
          {/* 3 import methods */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <VCard className="!border-t-4 !border-t-[#1B5BDA] text-center !p-6">
              <FileSpreadsheet size={28} className="text-[#1B5BDA] mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-[#1D2530] mb-1">Template MediKong</p>
              <p className="text-[11px] text-[#616B7C] mb-4">Telecharger notre fichier XLS pre-formate avec les colonnes attendues</p>
              <VBtn small primary icon="Download">Telecharger le template</VBtn>
            </VCard>
            <VCard className="!border-t-4 !border-t-[#7C3AED] text-center !p-6">
              <Upload size={28} className="text-[#7C3AED] mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-[#1D2530] mb-1">Fichier libre + Mapping</p>
              <p className="text-[11px] text-[#616B7C] mb-4">Importez votre CSV/XLS et mappez les colonnes vers le format MediKong</p>
              <VBtn small icon="Upload">Importer un fichier</VBtn>
            </VCard>
            <VCard className="!border-t-4 !border-t-[#059669] text-center !p-6">
              <Plug size={28} className="text-[#059669] mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-[#1D2530] mb-1">API REST</p>
              <p className="text-[11px] text-[#616B7C] mb-4">Connectez votre ERP directement via notre API pour une synchronisation automatique</p>
              <VBtn small icon="ExternalLink">Documentation API</VBtn>
            </VCard>
          </div>

          {/* Import history */}
          <VCard>
            <h3 className="text-sm font-semibold text-[#1D2530] mb-3">Historique des imports</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">Fichier</th>
                    <th className="text-left py-2 font-medium">Format</th>
                    <th className="text-center py-2 font-medium">Offres</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                    <th className="text-center py-2 font-medium">Matchees</th>
                    <th className="text-center py-2 font-medium">Non matchees</th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map((h, i) => (
                    <tr key={i} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="py-2.5 text-[#8B95A5]">{h.date}</td>
                      <td className="py-2.5 font-medium text-[#1D2530]">{h.file}</td>
                      <td className="py-2.5"><VBadge color="#1B5BDA">{h.format}</VBadge></td>
                      <td className="py-2.5 text-center">{h.offres}</td>
                      <td className="py-2.5">
                        <VBadge color={h.status === "success" ? "#059669" : "#F59E0B"}>{h.status === "success" ? "Succes" : "Partiel"}</VBadge>
                      </td>
                      <td className="py-2.5 text-center text-[#059669] font-medium">{h.matched}</td>
                      <td className="py-2.5 text-center text-[#EF4343] font-medium">{h.unmatched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </VCard>
        </div>
      )}
    </div>
  );
}
