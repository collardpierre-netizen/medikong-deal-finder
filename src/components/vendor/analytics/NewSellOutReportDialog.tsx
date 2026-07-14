import { useState } from "react";
import { X, Upload } from "lucide-react";
import { parseSellOutXlsx } from "@/lib/parseSellOutXlsx";
import { useCreateSellOutReport, type SellOutLineInput } from "@/hooks/useVendorSellOut";
import { toast } from "@/hooks/use-toast";

export function NewSellOutReportDialog({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const create = useCreateSellOutReport();
  const [customerLabel, setCustomerLabel] = useState("");
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<SellOutLineInput[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsing(true);
    try {
      const parsed = await parseSellOutXlsx(f);
      setLines(parsed);
      setFileName(f.name);
      toast({ title: `${parsed.length} ligne(s) détectée(s)` });
    } catch (err: any) {
      toast({ title: "Erreur de lecture", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit() {
    if (!lines.length) {
      toast({ title: "Aucune ligne à importer", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        vendor_id: vendorId,
        customer_label: customerLabel || null,
        period_start: periodStart,
        period_end: periodEnd,
        source: fileName ? "xlsx" : "manual",
        file_name: fileName,
        notes: notes || null,
        lines,
      });
      toast({ title: "Rapport importé" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[12px] max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <h3 className="text-[16px] font-semibold text-[#1D2530]">Nouveau rapport sell-out</h3>
          <button onClick={onClose} className="text-[#8B95A5] hover:text-[#1D2530]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] text-[#8B95A5]">Nom du client</label>
            <input
              value={customerLabel}
              onChange={(e) => setCustomerLabel(e.target.value)}
              placeholder="Ex : Pharmacie Dupont"
              className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-[#8B95A5]">Début période</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]" />
            </div>
            <div>
              <label className="text-[12px] text-[#8B95A5]">Fin période</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]" />
            </div>
          </div>
          <div>
            <label className="text-[12px] text-[#8B95A5]">Fichier XLSX / CSV</label>
            <div className="mt-1">
              <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:bg-[#F8FAFC]">
                <Upload size={14} />
                <span className="text-[12px]">{fileName || "Choisir un fichier"}</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
              </label>
              {parsing && <span className="ml-2 text-[12px] text-[#8B95A5]">Lecture…</span>}
            </div>
            <div className="text-[11px] text-[#8B95A5] mt-2">
              Colonnes reconnues : <code>gtin/ean</code>, <code>cnk</code>, <code>label/produit</code>, <code>units/qty</code>, <code>ca_net/net</code>, <code>ca_brut/gross</code>. Montants en euros (convertis en cents).
            </div>
          </div>
          {lines.length > 0 && (
            <div className="text-[12px] text-[#047857]">✓ {lines.length} ligne(s) prête(s) à importer</div>
          )}
          <div>
            <label className="text-[12px] text-[#8B95A5]">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-[#E2E8F0]">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#8B95A5] hover:text-[#1D2530]">Annuler</button>
          <button
            onClick={onSubmit}
            disabled={create.isPending || !lines.length}
            className="px-4 py-2 rounded-[8px] bg-[#1C58D9] text-white text-[13px] font-medium hover:bg-[#164BB9] disabled:opacity-50"
          >
            {create.isPending ? "Import…" : "Importer"}
          </button>
        </div>
      </div>
    </div>
  );
}
