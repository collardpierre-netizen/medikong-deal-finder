import { useState, useCallback } from "react";
import { Upload, Download, AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  errors: string[];
  valid: boolean;
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

export default function RestockSellerNewOffer() {
  const { user } = useAuth();
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      setRows(json.map((r, i) => validateRow(r, i)));
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
      <p className="text-[#5C6470] text-sm mb-6">Téléchargez le template, remplissez-le et importez vos offres.</p>

      {/* Step 1: Template */}
      <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1E252F] mb-3">1. Téléchargez le template Excel</h2>
        <Button onClick={downloadTemplate} variant="outline" className="gap-2 rounded-lg border-[#D0D5DC] text-[#1C58D9]">
          <Download size={16} /> Télécharger le template .xlsx
        </Button>
      </div>

      {/* Step 2: Upload */}
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

      {/* Step 3: Preview */}
      {rows.length > 0 && (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#1E252F]">3. Prévisualisation ({rows.length} lignes)</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#00B85C] font-semibold flex items-center gap-1"><Check size={14} /> {validCount} valides</span>
              {invalidCount > 0 && <span className="text-[#E54545] font-semibold flex items-center gap-1"><X size={14} /> {invalidCount} rejetées</span>}
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
                  <th className="pb-2">Erreurs</th>
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
                    <td className="py-2">
                      {r.errors.length > 0 && (
                        <div className="flex items-start gap-1 text-[#E54545]">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>{r.errors.join(", ")}</span>
                        </div>
                      )}
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
