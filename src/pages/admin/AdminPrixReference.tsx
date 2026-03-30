import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Package, Upload, Download, Search, Trash2, Plus, Info, Database } from "lucide-react";
import type { PrixProfilPays, PrixSource, ProfilAcheteur, PaysCode } from "@/lib/types/prix-informatifs";
import { formatPrixRef, sourceLabels, profilLabels, paysLabels, calcSavings } from "@/lib/utils/prix-ref";
import { useProducts } from "@/hooks/useAdminData";

const sources: PrixSource[] = ["INAMI", "CBIP", "Farmacompendium", "Marches_publics", "Prix_moyen", "Manuel"];
const profils: ProfilAcheteur[] = ["Pharmacie", "Hopital", "MRS", "Infirmier", "Cabinet", "Parapharmacie"];
const pays: PaysCode[] = ["BE", "LU", "FR", "NL"];

export default function AdminPrixReference() {
  const { data: products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [prixTTC, setPrixTTC] = useState(0);
  const [prixSource, setPrixSource] = useState<PrixSource>("CBIP");
  const [prixDate, setPrixDate] = useState(new Date().toISOString().slice(0, 10));
  const [grille, setGrille] = useState<PrixProfilPays[]>([]);
  const [showImport, setShowImport] = useState(false);

  const productNames = products.map(p => p.name);
  const filtered = search ? productNames.filter(p => p.toLowerCase().includes(search.toLowerCase())).slice(0, 20) : [];

  const selectProduct = (name: string) => {
    setSelectedProduct(name);
    setSearch(name);
    // Reset - no mock data, start fresh
    setPrixTTC(0);
    setPrixSource("CBIP");
    setPrixDate(new Date().toISOString().slice(0, 10));
    setGrille([]);
  };

  const tvaRate = 6;
  const htva = prixTTC / (1 + tvaRate / 100);
  const product = selectedProduct ? products.find(p => p.name === selectedProduct) : null;
  const bestPrice = product?.best_price_excl_vat ? Number(product.best_price_excl_vat) : 0;

  const addRow = () => {
    setGrille(prev => [...prev, {
      id: `new-${Date.now()}`, profil: "Pharmacie", pays: "BE", prixHT: 0, source: "Manuel", dateMAJ: new Date().toISOString().slice(0, 10), actif: true,
    }]);
  };

  const updateRow = (idx: number, field: string, value: any) => {
    setGrille(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeRow = (idx: number) => setGrille(prev => prev.filter((_, i) => i !== idx));

  return (
    <div>
      <AdminTopBar title="Prix de Référence — Gestion" subtitle="Gestion des prix informatifs par profil et pays" />

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-4">
        <button className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-md border" style={{ borderColor: "#059669", color: "#059669" }}>
          <Download size={14} /> Exporter CSV
        </button>
        <button onClick={() => setShowImport(!showImport)} className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium rounded-md text-white" style={{ backgroundColor: "#1D2530" }}>
          <Upload size={14} /> Importer CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Produits en base", value: String(products.length), sub: "catalogue actuel" },
          { label: "Combinaisons actives", value: "0", sub: "profil × pays" },
          { label: "À mettre à jour", value: "0", sub: "prix > 90 jours", color: "#F59E0B" },
          { label: "Sources distinctes", value: "6", sub: "INAMI, CBIP, Farma..." },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
            <p className="text-[11px] text-[#8B95A5] uppercase tracking-wide font-medium">{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: s.color || "#1D2530" }}>{s.value}</p>
            <p className="text-[11px] text-[#8B95A5]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedProduct(null); }}
          placeholder="Rechercher un produit par nom..."
          className="w-full pl-10 pr-4 py-2.5 text-[13px] rounded-lg border bg-white"
          style={{ borderColor: "#E2E8F0" }}
        />
        {search && !selectedProduct && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-auto" style={{ borderColor: "#E2E8F0" }}>
            {filtered.map(p => (
              <button key={p} onClick={() => selectProduct(p)} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-[#F8FAFC] transition-colors text-[#1D2530]">{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!selectedProduct && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Aucun produit en base</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">Lancez une synchronisation Qogita depuis la page Sync pour importer des produits, puis configurez les prix de référence ici.</p>
        </div>
      )}

      {!selectedProduct && products.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package size={48} className="text-[#CBD5E1] mb-4" />
          <h3 className="text-[15px] font-bold text-[#1D2530] mb-2">Sélectionnez un produit</h3>
          <p className="text-[13px] text-[#8B95A5] max-w-md">Utilisez la barre de recherche ci-dessus pour trouver un produit et configurer ses prix de référence par profil acheteur et pays.</p>
        </div>
      )}

      {/* Product editor */}
      {selectedProduct && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
            <div className="flex items-center gap-2 mb-4">
              <Package size={18} className="text-[#1B5BDA]" />
              <span className="text-[15px] font-bold text-[#1D2530]">{selectedProduct}</span>
              {product?.gtin && <span className="text-[11px] text-[#8B95A5] ml-2">EAN: {product.gtin}</span>}
              {product?.cnk_code && <span className="text-[11px] text-[#8B95A5]">· CNK: {product.cnk_code}</span>}
            </div>

            {/* Prix public */}
            <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: "#F8FAFC" }}>
              <p className="text-[12px] font-semibold text-[#1D2530] mb-3">Prix public constaté</p>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <label className="text-[11px] text-[#616B7C] block mb-1">Prix public TTC</label>
                  <input type="number" value={prixTTC} onChange={e => setPrixTTC(+e.target.value)} step="0.01" className="w-[100px] px-3 py-2 text-[13px] rounded-md border" style={{ borderColor: "#E2E8F0" }} />
                </div>
                <div>
                  <label className="text-[11px] text-[#616B7C] block mb-1">HTVA (auto {tvaRate}%)</label>
                  <input disabled value={htva.toFixed(2)} className="w-[100px] px-3 py-2 text-[13px] rounded-md border bg-[#F1F5F9]" style={{ borderColor: "#E2E8F0" }} />
                </div>
                <div>
                  <label className="text-[11px] text-[#616B7C] block mb-1">Source</label>
                  <select value={prixSource} onChange={e => setPrixSource(e.target.value as PrixSource)} className="px-3 py-2 text-[13px] rounded-md border bg-white" style={{ borderColor: "#E2E8F0" }}>
                    {sources.map(s => <option key={s} value={s}>{sourceLabels[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#616B7C] block mb-1">Date</label>
                  <input type="date" value={prixDate} onChange={e => setPrixDate(e.target.value)} className="px-3 py-2 text-[13px] rounded-md border" style={{ borderColor: "#E2E8F0" }} />
                </div>
              </div>
            </div>

            {/* Grille profil x pays */}
            <p className="text-[12px] font-semibold text-[#1D2530] mb-3">Grille profil × pays</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b text-[11px] text-[#8B95A5] uppercase tracking-wide" style={{ borderColor: "#E2E8F0" }}>
                    <th className="text-left py-2 px-2 font-medium">Profil</th>
                    <th className="text-left py-2 px-2 font-medium">Pays</th>
                    <th className="text-left py-2 px-2 font-medium">Prix HT</th>
                    <th className="text-left py-2 px-2 font-medium">Source</th>
                    <th className="text-left py-2 px-2 font-medium">Date MAJ</th>
                    <th className="text-center py-2 px-2 font-medium">Actif</th>
                    <th className="text-right py-2 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grille.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-[13px] text-[#8B95A5]">Aucun prix de référence configuré. Cliquez sur "Ajouter profil/pays" ci-dessous.</td></tr>
                  )}
                  {grille.map((r, i) => {
                    const isOld = new Date().getTime() - new Date(r.dateMAJ).getTime() > 90 * 24 * 3600 * 1000;
                    return (
                      <tr key={r.id} className="border-b last:border-0" style={{ borderColor: "#E2E8F0" }}>
                        <td className="py-2 px-2">
                          <select value={r.profil} onChange={e => updateRow(i, "profil", e.target.value)} className="px-2 py-1.5 text-[12px] rounded border bg-white" style={{ borderColor: "#E2E8F0" }}>
                            {profils.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <select value={r.pays} onChange={e => updateRow(i, "pays", e.target.value)} className="px-2 py-1.5 text-[12px] rounded border bg-white" style={{ borderColor: "#E2E8F0" }}>
                            {pays.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" value={r.prixHT} onChange={e => updateRow(i, "prixHT", +e.target.value)} step="0.01" className="w-[80px] px-2 py-1.5 text-[12px] rounded border" style={{ borderColor: "#E2E8F0" }} />
                        </td>
                        <td className="py-2 px-2">
                          <select value={r.source} onChange={e => updateRow(i, "source", e.target.value)} className="px-2 py-1.5 text-[12px] rounded border bg-white" style={{ borderColor: "#E2E8F0" }}>
                            {sources.map(s => <option key={s} value={s}>{sourceLabels[s]}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-[12px] text-[#616B7C]">
                          {r.dateMAJ}
                          {isOld && <Badge variant="outline" className="ml-1.5 text-[9px]" style={{ color: "#F59E0B", backgroundColor: "#FFFBEB", borderColor: "transparent" }}>&gt; 90j</Badge>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Switch checked={r.actif} onCheckedChange={v => updateRow(i, "actif", v)} />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button onClick={() => removeRow(i)} className="p-1 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={14} className="text-[#EF4343]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button onClick={addRow} className="mt-3 flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-md border" style={{ borderColor: "#059669", color: "#059669" }}>
              <Plus size={14} /> Ajouter profil/pays
            </button>

            {/* Aperçu impact */}
            {grille.length > 0 && bestPrice > 0 && (
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid #E2E8F0" }}>
                <p className="text-[12px] font-semibold text-[#616B7C] mb-3">
                  Aperçu impact — Meilleur prix MediKong: {formatPrixRef(bestPrice)} HTVA
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {grille.map(r => {
                    const savings = calcSavings(r.prixHT, bestPrice, r.source, r.dateMAJ);
                    return (
                      <div key={r.id} className="rounded-lg p-3" style={{ border: r.actif ? "1px solid #E2E8F0" : "1px dashed #CBD5E1", opacity: r.actif ? 1 : 0.6, backgroundColor: r.actif ? "white" : "#F8FAFC" }}>
                        <p className="text-[10px] text-[#8B95A5]">{r.profil} {r.pays}</p>
                        <p className="text-[12px] text-[#8B95A5]">Ref: {formatPrixRef(r.prixHT)}</p>
                        <p className="text-[13px] font-bold text-[#059669]">{formatPrixRef(bestPrice)}</p>
                        {savings.show && <p className="text-[11px] font-bold text-[#059669]">-{savings.pct}% · -{formatPrixRef(savings.abs)}</p>}
                        {!r.actif && <p className="text-[10px] text-[#8B95A5] italic">Inactif</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CSV Import */}
          {showImport && (
            <div className="bg-white rounded-lg border p-5" style={{ borderColor: "#E2E8F0" }}>
              <div className="border-2 border-dashed rounded-xl p-6 text-center" style={{ borderColor: "#CBD5E1" }}>
                <Upload size={32} className="mx-auto mb-3 text-[#8B95A5]" />
                <p className="text-[13px] text-[#1D2530] font-medium">Glissez un fichier CSV ou cliquez pour parcourir</p>
                <p className="text-[11px] font-mono text-[#8B95A5] mt-2">ean;cnk;profil;pays;prix_ht;source;date</p>
                <p className="text-[11px] text-[#8B95A5] mt-1">
                  <Info size={10} className="inline mr-1" />
                  Matching: EAN (1er) → CNK (2e) → Ref fabricant (3e) → SKU (4e)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}