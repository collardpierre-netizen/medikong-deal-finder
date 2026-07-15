import { useMemo, useState } from "react";
import { X, Upload, Plus, Trash2, Search } from "lucide-react";
import { parseSellOutXlsx, type ParseResult } from "@/lib/parseSellOutXlsx";
import { useValidateSellOutLines } from "@/hooks/useValidateSellOutLines";
import { useCreateManualSellInReport } from "@/hooks/useVendorManualSellIn";
import { useBePharmaciesSearch } from "@/hooks/useBePharmacies";
import type { SellOutLineInput } from "@/hooks/useVendorSellOut";
import { toast } from "@/hooks/use-toast";

interface ManualLineDraft {
  gtin: string;
  cnk_code: string;
  raw_label: string;
  units: string;
  net_euros: string;
}

const emptyLine = (): ManualLineDraft => ({
  gtin: "",
  cnk_code: "",
  raw_label: "",
  units: "",
  net_euros: "",
});

export function NewManualSellInDialog({
  vendorId,
  onClose,
}: {
  vendorId: string;
  onClose: () => void;
}) {
  const create = useCreateManualSellInReport();
  const [mode, setMode] = useState<"manual" | "xlsx">("manual");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [pharmacyLabel, setPharmacyLabel] = useState("");
  const [pharmacyQuery, setPharmacyQuery] = useState("");
  const [showPharmacyResults, setShowPharmacyResults] = useState(false);
  const [customerLabel, setCustomerLabel] = useState("");
  const [periodStart, setPeriodStart] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [manualLines, setManualLines] = useState<ManualLineDraft[]>([emptyLine()]);
  const [xlsxResult, setXlsxResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const pharmacyResults = useBePharmaciesSearch(pharmacyQuery, showPharmacyResults);

  const manualParsed = useMemo<SellOutLineInput[]>(() => {
    return manualLines
      .map((l) => {
        const units = Math.round(Number(l.units) || 0);
        const netCents = Math.round((Number(l.net_euros.replace(",", ".")) || 0) * 100);
        const hasIdent = !!(l.gtin.trim() || l.cnk_code.trim());
        if (!hasIdent && !units && !netCents && !l.raw_label.trim()) return null;
        return {
          gtin: l.gtin.trim() || null,
          cnk_code: l.cnk_code.trim() || null,
          raw_label: l.raw_label.trim() || null,
          units,
          gross_revenue_cents: 0,
          net_revenue_cents: netCents,
        } as SellOutLineInput;
      })
      .filter(Boolean) as SellOutLineInput[];
  }, [manualLines]);

  const linesToValidate = mode === "manual" ? manualParsed : xlsxResult?.lines ?? [];
  const validation = useValidateSellOutLines(linesToValidate.length ? linesToValidate : null);

  const linesToSubmit = useMemo<SellOutLineInput[]>(() => {
    if (!validation.data) return linesToValidate;
    return validation.data.lines.map((l) => ({ ...l.input, product_id: l.product_id }));
  }, [validation.data, linesToValidate]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsing(true);
    try {
      const parsed = await parseSellOutXlsx(f);
      setXlsxResult(parsed);
      setFileName(f.name);
      toast({
        title: `${parsed.lines.length} ligne(s) valide(s)`,
        description: `${parsed.rejected.length} rejetée(s)`,
      });
    } catch (err: any) {
      toast({ title: "Erreur de lecture", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit() {
    if (!linesToSubmit.length) {
      toast({ title: "Aucune ligne à enregistrer", variant: "destructive" });
      return;
    }
    if (!pharmacyId && !customerLabel.trim()) {
      toast({
        title: "Client requis",
        description: "Sélectionnez une pharmacie ou saisissez un libellé client.",
        variant: "destructive",
      });
      return;
    }
    try {
      await create.mutateAsync({
        vendor_id: vendorId,
        pharmacy_id: pharmacyId,
        customer_label: customerLabel.trim() || pharmacyLabel || null,
        period_start: periodStart,
        period_end: periodEnd,
        source: mode === "xlsx" ? "xlsx" : "manual",
        file_name: fileName,
        notes: notes.trim() || null,
        lines: linesToSubmit,
      });
      toast({
        title: "Rapport enregistré",
        description: `${linesToSubmit.length} ligne(s) sauvegardée(s)`,
      });
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  }

  function updateLine(i: number, patch: Partial<ManualLineDraft>) {
    setManualLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addLine() {
    setManualLines((rows) => [...rows, emptyLine()]);
  }
  function removeLine(i: number) {
    setManualLines((rows) => (rows.length === 1 ? [emptyLine()] : rows.filter((_, idx) => idx !== i)));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[12px] max-w-4xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <h3 className="text-[16px] font-semibold text-[#1D2530]">
            Nouveau rapport sell-in (hors plateforme)
          </h3>
          <button onClick={onClose} className="text-[#8B95A5] hover:text-[#1D2530]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Client / pharmacie */}
          <div className="relative">
            <label className="text-[12px] text-[#8B95A5]">Pharmacie cliente</label>
            <div className="relative mt-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
              <input
                value={pharmacyId ? pharmacyLabel : pharmacyQuery}
                onChange={(e) => {
                  if (pharmacyId) {
                    setPharmacyId(null);
                    setPharmacyLabel("");
                  }
                  setPharmacyQuery(e.target.value);
                  setShowPharmacyResults(true);
                }}
                onFocus={() => setShowPharmacyResults(true)}
                placeholder="Rechercher par nom, APB, ville, CP… (référentiel BE)"
                className="w-full pl-8 pr-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]"
              />
              {showPharmacyResults &&
                pharmacyQuery.trim().length >= 2 &&
                !pharmacyId && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-[#E2E8F0] rounded-[8px] shadow-lg max-h-60 overflow-auto">
                    {pharmacyResults.isFetching && (
                      <div className="px-3 py-2 text-[12px] text-[#8B95A5]">Recherche…</div>
                    )}
                    {!pharmacyResults.isFetching &&
                      !pharmacyResults.data?.length && (
                        <div className="px-3 py-2 text-[12px] text-[#8B95A5]">
                          Aucun résultat. Utilisez le champ libellé libre ci-dessous.
                        </div>
                      )}
                    {pharmacyResults.data?.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPharmacyId(p.id);
                          setPharmacyLabel(`${p.name} — ${p.postal_code ?? ""} ${p.city ?? ""}`.trim());
                          setShowPharmacyResults(false);
                        }}
                        className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#F8FAFC]"
                      >
                        <div className="font-medium text-[#1D2530]">{p.name}</div>
                        <div className="text-[11px] text-[#8B95A5]">
                          APB {p.apb_number} · {p.postal_code} {p.city}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
            </div>
            <div className="mt-2">
              <label className="text-[11px] text-[#8B95A5]">Ou libellé client libre</label>
              <input
                value={customerLabel}
                onChange={(e) => setCustomerLabel(e.target.value)}
                placeholder="Ex : Pharmacie Dupont (client non référencé)"
                className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[12px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-[#8B95A5]">Début période</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-[#8B95A5]">Fin période</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]"
              />
            </div>
          </div>

          {/* Mode */}
          <div className="flex gap-2 border-b border-[#E2E8F0]">
            <button
              onClick={() => setMode("manual")}
              className={`px-4 py-2 text-[12px] -mb-px border-b-2 ${
                mode === "manual"
                  ? "border-[#1C58D9] text-[#1C58D9] font-medium"
                  : "border-transparent text-[#64748B]"
              }`}
            >
              Saisie manuelle
            </button>
            <button
              onClick={() => setMode("xlsx")}
              className={`px-4 py-2 text-[12px] -mb-px border-b-2 ${
                mode === "xlsx"
                  ? "border-[#1C58D9] text-[#1C58D9] font-medium"
                  : "border-transparent text-[#64748B]"
              }`}
            >
              Import XLSX/CSV
            </button>
          </div>

          {mode === "manual" && (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_2fr_80px_100px_32px] gap-2 text-[11px] text-[#8B95A5] px-1">
                <div>GTIN</div>
                <div>CNK</div>
                <div>Produit (libellé)</div>
                <div className="text-right">Unités</div>
                <div className="text-right">CA net (€)</div>
                <div></div>
              </div>
              {manualLines.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_2fr_80px_100px_32px] gap-2 items-center"
                >
                  <input
                    value={l.gtin}
                    onChange={(e) => updateLine(i, { gtin: e.target.value })}
                    placeholder="EAN"
                    className="px-2 py-1.5 border border-[#E2E8F0] rounded-[6px] text-[12px] font-mono"
                  />
                  <input
                    value={l.cnk_code}
                    onChange={(e) => updateLine(i, { cnk_code: e.target.value })}
                    placeholder="CNK"
                    className="px-2 py-1.5 border border-[#E2E8F0] rounded-[6px] text-[12px] font-mono"
                  />
                  <input
                    value={l.raw_label}
                    onChange={(e) => updateLine(i, { raw_label: e.target.value })}
                    placeholder="Nom produit"
                    className="px-2 py-1.5 border border-[#E2E8F0] rounded-[6px] text-[12px]"
                  />
                  <input
                    value={l.units}
                    onChange={(e) => updateLine(i, { units: e.target.value })}
                    inputMode="numeric"
                    placeholder="0"
                    className="px-2 py-1.5 border border-[#E2E8F0] rounded-[6px] text-[12px] text-right"
                  />
                  <input
                    value={l.net_euros}
                    onChange={(e) => updateLine(i, { net_euros: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="px-2 py-1.5 border border-[#E2E8F0] rounded-[6px] text-[12px] text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-[#8B95A5] hover:text-[#B91C1C]"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] border border-dashed border-[#CBD5E1] text-[12px] text-[#1C58D9] hover:bg-[#F0F6FF]"
              >
                <Plus size={12} /> Ajouter une ligne
              </button>
              {validation.data && (
                <div className="text-[11px] text-[#8B95A5]">
                  {validation.data.summary.matched} matché(s) (GTIN{" "}
                  {validation.data.summary.matchedGtin} / CNK {validation.data.summary.matchedCnk}) ·{" "}
                  {validation.data.summary.unmatched} non trouvé(s)
                </div>
              )}
            </div>
          )}

          {mode === "xlsx" && (
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#CBD5E1] rounded-[8px] cursor-pointer hover:bg-[#F8FAFC]">
                <Upload size={14} />
                <span className="text-[12px]">{fileName || "Choisir un fichier"}</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
              </label>
              {parsing && <span className="ml-2 text-[12px] text-[#8B95A5]">Lecture…</span>}
              <div className="text-[11px] text-[#8B95A5]">
                Colonnes reconnues : <code>gtin/ean</code>, <code>cnk</code>, <code>produit</code>,{" "}
                <code>units/qty</code>, <code>ca_net</code>, <code>ca_brut</code>.
              </div>
              {xlsxResult && (
                <div className="text-[12px] text-[#1D2530]">
                  {xlsxResult.lines.length} ligne(s) valide(s), {xlsxResult.rejected.length}{" "}
                  rejetée(s).
                  {validation.data && (
                    <>
                      {" "}
                      Match GTIN {validation.data.summary.matchedGtin} · CNK{" "}
                      {validation.data.summary.matchedCnk} · Non trouvés{" "}
                      {validation.data.summary.unmatched}.
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[12px] text-[#8B95A5]">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-5 border-t border-[#E2E8F0]">
          <div className="text-[12px] text-[#8B95A5]">
            {linesToSubmit.length > 0 && `${linesToSubmit.length} ligne(s) prêtes`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-[#8B95A5] hover:text-[#1D2530]"
            >
              Annuler
            </button>
            <button
              onClick={onSubmit}
              disabled={create.isPending || !linesToSubmit.length}
              className="px-4 py-2 rounded-[8px] bg-[#1C58D9] text-white text-[13px] font-medium hover:bg-[#164BB9] disabled:opacity-50"
            >
              {create.isPending ? "Enregistrement…" : `Enregistrer ${linesToSubmit.length || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
