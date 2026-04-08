import { useState, useCallback } from "react";
import { Upload, Download, AlertTriangle, Check, X, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface OfferRow {
  ean: string;
  cnk: string;
  designation: string;
  quantity: number;
  price_ht: number;
  dlu: string;
  product_state: string;
  lot_number: string;
  delivery_condition: string;
  allow_partial: boolean;
  moq: number;
  lot_size: number;
  errors: string[];
  valid: boolean;
  source?: string;
}

const STATE_MAP: Record<string, string> = {
  "intact": "intact",
  "emballage abîmé": "damaged_packaging",
  "emballage abime": "damaged_packaging",
  "proche péremption": "near_expiry",
  "proche peremption": "near_expiry",
};

const DELIVERY_MAP: Record<string, string> = {
  "enlèvement sur place": "pickup",
  "enlevement sur place": "pickup",
  "expédition uniquement": "shipping",
  "expedition uniquement": "shipping",
  "les deux": "both",
};

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["EAN", "CNK", "Désignation", "Quantité", "Prix HT unitaire", "DLU (AAAA-MM-JJ)", "État", "Numéro de lot", "Condition de livraison"],
    ["5412345678901", "1234567", "Doliprane 1000mg x8", 50, 3.20, "2027-06-30", "Intact", "LOT2024A", "Les deux"],
    ["5412345678902", "7654321", "Efferalgan 500mg x16", 30, 2.10, "2026-12-31", "Emballage abîmé", "LOT2024B", "Expédition uniquement"],
  ]);
  ws["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Offres");
  XLSX.writeFile(wb, "MediKong_ReStock_Template.xlsx");
}

function validateRow(row: any, idx: number): OfferRow {
  const errors: string[] = [];
  const ean = String(row["EAN"] || "").trim();
  const cnk = String(row["CNK"] || "").trim();
  const designation = String(row["Désignation"] || row["Designation"] || "").trim();
  const quantity = Number(row["Quantité"] || row["Quantite"] || 0);
  const price_ht = Number(row["Prix HT unitaire"] || 0);
  const dluRaw = row["DLU (AAAA-MM-JJ)"] || row["DLU"] || "";
  const stateRaw = String(row["État"] || row["Etat"] || "intact").toLowerCase().trim();
  const lotNumber = String(row["Numéro de lot"] || row["Numero de lot"] || "").trim();
  const deliveryRaw = String(row["Condition de livraison"] || "les deux").toLowerCase().trim();

  if (!ean && !cnk) errors.push("EAN ou CNK requis");
  if (!designation) errors.push("Désignation requise");
  if (quantity <= 0) errors.push("Quantité > 0 requise");
  if (price_ht <= 0) errors.push("Prix > 0 requis");

  let dlu = "";
  if (dluRaw) {
    const d = typeof dluRaw === "number" ? new Date((dluRaw - 25569) * 86400 * 1000) : new Date(dluRaw);
    if (isNaN(d.getTime())) {
      errors.push("Format DLU invalide");
    } else {
      dlu = d.toISOString().split("T")[0];
      const minDate = new Date();
      minDate.setMonth(minDate.getMonth() + 1);
      if (d < minDate) errors.push("DLU trop courte (min 1 mois)");
    }
  }

  const product_state = STATE_MAP[stateRaw] || "intact";
  const delivery_condition = DELIVERY_MAP[deliveryRaw] || "both";

  return {
    ean, cnk, designation, quantity, price_ht, dlu, product_state, lot_number: lotNumber,
    delivery_condition, errors, valid: errors.length === 0,
  };
}

function revalidateRow(r: OfferRow): OfferRow {
  const errors: string[] = [];
  if (!r.ean && !r.cnk) errors.push("EAN ou CNK requis");
  if (!r.designation) errors.push("Désignation requise");
  if (r.quantity <= 0) errors.push("Quantité > 0 requise");
  if (r.price_ht <= 0) errors.push("Prix > 0 requis");
  if (r.dlu) {
    const d = new Date(r.dlu);
    const minDate = new Date();
    minDate.setMonth(minDate.getMonth() + 1);
    if (d < minDate) errors.push("DLU trop courte (min 1 mois)");
  }
  return { ...r, errors, valid: errors.length === 0 };
}

/* ── Manual add form ── */
function ManualAddForm({ onAdd }: { onAdd: (row: OfferRow) => void }) {
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<{ ean: string; cnk: string; name: string; prix_pharmacien: number | null; source: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState("1");
  const [priceHt, setPriceHt] = useState("");
  const [dlu, setDlu] = useState("");
  const [state, setState] = useState("intact");
  const [lot, setLot] = useState("");
  const [delivery, setDelivery] = useState("both");
  const [manualName, setManualName] = useState("");

  const lookupCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSearching(true);
    setFound(null);
    setNotFound(false);

    // Search in market_prices (Febelco, CERP, etc.)
    const isNumeric = /^\d+$/.test(trimmed);
    const isCnk = isNumeric && trimmed.length <= 7;

    let query = supabase
      .from("market_prices")
      .select("ean, cnk, product_name_source, prix_pharmacien, source:market_price_sources(name)")
      .limit(1);

    if (isCnk) {
      query = query.eq("cnk", trimmed);
    } else {
      query = query.eq("ean", trimmed);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      const row = data[0];
      const sourceName = typeof row.source === "object" && row.source ? (row.source as any).name : "DB";
      setFound({
        ean: row.ean || "",
        cnk: row.cnk || "",
        name: row.product_name_source || "",
        prix_pharmacien: row.prix_pharmacien,
        source: sourceName,
      });
      if (row.prix_pharmacien && !priceHt) {
        setPriceHt(row.prix_pharmacien.toFixed(2));
      }
    } else {
      // Fallback: search in products table
      let pQuery = supabase.from("products").select("gtin, name").limit(1);
      if (isCnk) {
        // search product_market_codes
        const { data: pmcData } = await supabase
          .from("product_market_codes")
          .select("product_id, code_value")
          .eq("code_value", trimmed)
          .limit(1);
        if (pmcData && pmcData.length > 0) {
          const { data: pData } = await supabase
            .from("products")
            .select("gtin, name")
            .eq("id", pmcData[0].product_id)
            .limit(1);
          if (pData && pData.length > 0) {
            setFound({ ean: pData[0].gtin || "", cnk: trimmed, name: pData[0].name, prix_pharmacien: null, source: "Catalogue" });
            setSearching(false);
            return;
          }
        }
        setNotFound(true);
      } else {
        pQuery = pQuery.eq("gtin", trimmed);
        const { data: pData } = await pQuery;
        if (pData && pData.length > 0) {
          setFound({ ean: pData[0].gtin || trimmed, cnk: "", name: pData[0].name, prix_pharmacien: null, source: "Catalogue" });
        } else {
          setNotFound(true);
        }
      }
    }
    setSearching(false);
  };

  const handleAdd = () => {
    const designation = found?.name || manualName;
    if (!designation) { toast.error("Désignation requise"); return; }
    const row = revalidateRow({
      ean: found?.ean || (!found && code.length > 7 ? code.trim() : ""),
      cnk: found?.cnk || (!found && code.length <= 7 ? code.trim() : ""),
      designation,
      quantity: Number(qty) || 0,
      price_ht: Number(priceHt) || 0,
      dlu,
      product_state: state,
      lot_number: lot,
      delivery_condition: delivery,
      errors: [],
      valid: true,
      source: found?.source,
    });
    onAdd(row);
    // Reset
    setCode(""); setFound(null); setNotFound(false); setQty("1"); setPriceHt(""); setDlu(""); setState("intact"); setLot(""); setDelivery("both"); setManualName("");
    toast.success("Produit ajouté à la liste");
  };

  return (
    <div className="space-y-4">
      {/* Code lookup */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Tapez un EAN (13 chiffres) ou CNK (7 chiffres)…"
            value={code}
            onChange={(e) => { setCode(e.target.value); setFound(null); setNotFound(false); }}
            onKeyDown={(e) => e.key === "Enter" && lookupCode()}
            className="border-[#D0D5DC]"
          />
        </div>
        <Button onClick={lookupCode} disabled={!code.trim() || searching} variant="outline" className="gap-2 border-[#D0D5DC] text-[#1C58D9]">
          {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          Rechercher
        </Button>
      </div>

      {/* Result */}
      {found && (
        <div className="bg-[#F0F4FF] border border-[#1C58D9]/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1E252F]">{found.name}</p>
              <p className="text-xs text-[#5C6470]">
                {found.ean && `EAN: ${found.ean}`}{found.ean && found.cnk && " · "}{found.cnk && `CNK: ${found.cnk}`}
                <span className="ml-2 text-[#1C58D9]">Source: {found.source}</span>
              </p>
            </div>
            {found.prix_pharmacien && (
              <Badge className="bg-white text-[#1C58D9] border border-[#1C58D9]/30">
                Prix réf. {found.prix_pharmacien.toFixed(2)} €
              </Badge>
            )}
          </div>
        </div>
      )}

      {notFound && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-700 font-medium">Produit non trouvé dans les bases Febelco/CERP</p>
          <p className="text-xs text-orange-600 mt-1">Vous pouvez quand même créer l'offre en saisissant la désignation manuellement.</p>
          <Input
            placeholder="Désignation du produit…"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            className="mt-2 border-orange-300"
          />
        </div>
      )}

      {/* Details form – show when product found or manual mode */}
      {(found || (notFound && manualName)) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-[#8B929C] font-medium">Quantité *</label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="border-[#D0D5DC]" />
          </div>
          <div>
            <label className="text-[11px] text-[#8B929C] font-medium">Prix HT unitaire (€) *</label>
            <Input type="number" step="0.01" min={0.01} value={priceHt} onChange={(e) => setPriceHt(e.target.value)} className="border-[#D0D5DC]" />
          </div>
          <div>
            <label className="text-[11px] text-[#8B929C] font-medium">DLU</label>
            <Input type="date" value={dlu} onChange={(e) => setDlu(e.target.value)} className="border-[#D0D5DC]" />
          </div>
          <div>
            <label className="text-[11px] text-[#8B929C] font-medium">N° de lot</label>
            <Input value={lot} onChange={(e) => setLot(e.target.value)} placeholder="LOT2024A" className="border-[#D0D5DC]" />
          </div>
          <div>
            <label className="text-[11px] text-[#8B929C] font-medium">État</label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="border-[#D0D5DC]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="intact">Intact</SelectItem>
                <SelectItem value="damaged_packaging">Emballage abîmé</SelectItem>
                <SelectItem value="near_expiry">Proche péremption</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-[#8B929C] font-medium">Livraison</label>
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger className="border-[#D0D5DC]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Les deux</SelectItem>
                <SelectItem value="pickup">Enlèvement sur place</SelectItem>
                <SelectItem value="shipping">Expédition uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex items-end">
            <Button onClick={handleAdd} className="w-full bg-[#00B85C] hover:bg-[#009E4F] text-white rounded-lg gap-2">
              <Plus size={16} /> Ajouter à la liste
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function RestockSellerNewOffer() {
  const { user } = useAuth();
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<"import" | "manual">("import");

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      setRows((prev) => [...prev, ...json.map((r, i) => validateRow(r, i))]);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const publishOffers = async () => {
    if (!user) return;
    setPublishing(true);
    const validRows = rows.filter((r) => r.valid);
    const inserts = validRows.map((r) => ({
      seller_id: user.id,
      ean: r.ean || null,
      cnk: r.cnk || null,
      designation: r.designation,
      quantity: r.quantity,
      price_ht: r.price_ht,
      dlu: r.dlu || null,
      product_state: r.product_state,
      lot_number: r.lot_number || null,
      delivery_condition: r.delivery_condition,
      status: "published",
    }));

    const { error } = await supabase.from("restock_offers").insert(inserts);
    setPublishing(false);
    if (error) {
      toast.error("Erreur lors de la publication");
    } else {
      toast.success(`${validRows.length} offre(s) publiée(s) avec succès`);
      setRows([]);
    }
  };

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;

  const stateLabel = (s: string) => ({ intact: "Intact", damaged_packaging: "Emb. abîmé", near_expiry: "Proche pér." }[s] || s);
  const deliveryLabel = (d: string) => ({ pickup: "Enlèvement", shipping: "Expédition", both: "Les deux" }[d] || d);

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h1 className="text-2xl font-bold text-[#1E252F] mb-1">Nouvelle offre de déstockage</h1>
      <p className="text-[#5C6470] text-sm mb-6">Ajoutez vos produits via import Excel ou saisie manuelle.</p>

      {/* Mode switcher */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={mode === "manual" ? "default" : "outline"}
          onClick={() => setMode("manual")}
          className={`gap-2 rounded-lg ${mode === "manual" ? "bg-[#1C58D9] text-white" : "border-[#D0D5DC] text-[#5C6470]"}`}
        >
          <Search size={16} /> Saisie par EAN / CNK
        </Button>
        <Button
          variant={mode === "import" ? "default" : "outline"}
          onClick={() => setMode("import")}
          className={`gap-2 rounded-lg ${mode === "import" ? "bg-[#1C58D9] text-white" : "border-[#D0D5DC] text-[#5C6470]"}`}
        >
          <Upload size={16} /> Import Excel
        </Button>
      </div>

      {/* Manual mode */}
      {mode === "manual" && (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1E252F] mb-3">Rechercher un produit dans les bases Febelco / CERP</h2>
          <ManualAddForm onAdd={(row) => setRows((prev) => [...prev, row])} />
        </div>
      )}

      {/* Import mode */}
      {mode === "import" && (
        <>
          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 mb-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1E252F] mb-3">1. Téléchargez le template Excel</h2>
            <Button onClick={downloadTemplate} variant="outline" className="gap-2 rounded-lg border-[#D0D5DC] text-[#1C58D9]">
              <Download size={16} /> Télécharger le template .xlsx
            </Button>
          </div>

          <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 mb-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1E252F] mb-3">2. Importez votre fichier rempli</h2>
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${dragOver ? "border-[#1C58D9] bg-[#F0F4FF]" : "border-[#D0D5DC]"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <Upload className="mx-auto mb-2 text-[#8B929C]" size={32} />
              <p className="text-sm text-[#5C6470]">Glissez-déposez votre fichier .xlsx ou .csv ici</p>
              <p className="text-xs text-[#8B929C] mt-1">ou cliquez pour parcourir</p>
              <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileInput} />
            </div>
          </div>
        </>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#1E252F]">
              {mode === "import" ? "3. " : ""}Prévisualisation ({rows.length} lignes)
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#00B85C] font-semibold flex items-center gap-1"><Check size={14} /> {validCount} valides</span>
              {invalidCount > 0 && <span className="text-[#E54545] font-semibold flex items-center gap-1"><X size={14} /> {invalidCount} rejetées</span>}
              <Button variant="ghost" size="sm" onClick={() => setRows([])} className="text-[#8B929C] text-xs">
                Tout effacer
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#D0D5DC] text-left text-[#8B929C]">
                  <th className="pb-2 pr-3">Statut</th>
                  <th className="pb-2 pr-3">Désignation</th>
                  <th className="pb-2 pr-3">EAN</th>
                  <th className="pb-2 pr-3">CNK</th>
                  <th className="pb-2 pr-3 text-right">Qté</th>
                  <th className="pb-2 pr-3 text-right">Prix HT</th>
                  <th className="pb-2 pr-3">DLU</th>
                  <th className="pb-2 pr-3">État</th>
                  <th className="pb-2 pr-3">Livraison</th>
                  <th className="pb-2 pr-3">Erreurs</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-[#F0F4FF] ${!r.valid ? "bg-red-50/50" : ""}`}>
                    <td className="py-2 pr-3">
                      {r.valid
                        ? <Badge className="bg-[#EEFBF4] text-[#00B85C] text-[10px]">OK</Badge>
                        : <Badge className="bg-red-50 text-[#E54545] text-[10px]">Rejetée</Badge>
                      }
                    </td>
                    <td className="py-2 pr-3 font-medium text-[#1E252F] max-w-[200px] truncate">{r.designation}</td>
                    <td className="py-2 pr-3 text-[#5C6470]">{r.ean || "—"}</td>
                    <td className="py-2 pr-3 text-[#5C6470]">{r.cnk || "—"}</td>
                    <td className="py-2 pr-3 text-right text-[#1E252F]">{r.quantity}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-[#1C58D9]">{r.price_ht.toFixed(2)} €</td>
                    <td className="py-2 pr-3 text-[#5C6470]">{r.dlu || "—"}</td>
                    <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px]">{stateLabel(r.product_state)}</Badge></td>
                    <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px]">{deliveryLabel(r.delivery_condition)}</Badge></td>
                    <td className="py-2 pr-3">
                      {r.errors.length > 0 && (
                        <div className="flex items-start gap-1 text-[#E54545]">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>{r.errors.join(", ")}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      <button onClick={() => removeRow(i)} className="text-[#8B929C] hover:text-[#E54545] transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-5">
            <Button
              onClick={publishOffers}
              disabled={validCount === 0 || publishing}
              className="bg-[#00B85C] hover:bg-[#009E4F] text-white rounded-lg gap-2"
            >
              {publishing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Publier {validCount} offre(s) conforme(s)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
