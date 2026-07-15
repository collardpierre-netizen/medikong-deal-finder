import { useMemo, useState } from "react";
import { X, Upload, AlertTriangle, CheckCircle2, XCircle, Search } from "lucide-react";
import { parseSellOutXlsx, type ParseResult, type RejectedRow } from "@/lib/parseSellOutXlsx";
import { useCreateSellOutReport, type SellOutLineInput } from "@/hooks/useVendorSellOut";
import { useValidateSellOutLines } from "@/hooks/useValidateSellOutLines";
import { useBePharmaciesSearch } from "@/hooks/useBePharmacies";
import { toast } from "@/hooks/use-toast";

function fmtEur(cents: number) {
  return (cents / 100).toLocaleString("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function NewSellOutReportDialog({ vendorId, onClose }: { vendorId: string; onClose: () => void }) {
  const create = useCreateSellOutReport();
  const [customerLabel, setCustomerLabel] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [pharmacyQuery, setPharmacyQuery] = useState("");
  const [pharmacyLocked, setPharmacyLocked] = useState(false);
  const [showPharmacyResults, setShowPharmacyResults] = useState(false);
  const pharmacyResults = useBePharmaciesSearch(pharmacyQuery, showPharmacyResults && !pharmacyLocked);
  const [periodStart, setPeriodStart] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [tab, setTab] = useState<"ok" | "warnings" | "unmatched" | "rejected">("ok");
  const [includeUnmatched, setIncludeUnmatched] = useState(true);

  const lines = parseResult?.lines ?? null;
  const validation = useValidateSellOutLines(lines);

  const linesToSubmit = useMemo<SellOutLineInput[]>(() => {
    if (!validation.data) return [];
    return validation.data.lines
      .filter((l) => (includeUnmatched ? true : l.status !== "unmatched"))
      .map((l) => ({ ...l.input, product_id: l.product_id }));
  }, [validation.data, includeUnmatched]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setParsing(true);
    try {
      const parsed = await parseSellOutXlsx(f);
      setParseResult(parsed);
      setFileName(f.name);
      toast({ title: `${parsed.lines.length} ligne(s) valide(s), ${parsed.rejected.length} rejetée(s)` });
    } catch (err: any) {
      toast({ title: "Erreur de lecture", description: err.message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  async function onSubmit() {
    if (!linesToSubmit.length) {
      toast({ title: "Aucune ligne à importer", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        vendor_id: vendorId,
        customer_label: customerLabel || null,
        pharmacy_id: pharmacyId,
        period_start: periodStart,
        period_end: periodEnd,
        source: fileName ? "xlsx" : "manual",
        file_name: fileName,
        notes: notes || null,
        lines: linesToSubmit,
      });
      toast({ title: "Rapport importé", description: `${linesToSubmit.length} ligne(s) enregistrée(s)` });
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  }

  const v = validation.data;
  const rejected: RejectedRow[] = parseResult?.rejected ?? [];

  const visibleLines = useMemo(() => {
    if (!v) return [];
    if (tab === "ok") return v.lines.filter((l) => l.status !== "unmatched" && l.warnings.length === 0);
    if (tab === "warnings") return v.lines.filter((l) => l.status !== "unmatched" && l.warnings.length > 0);
    if (tab === "unmatched") return v.lines.filter((l) => l.status === "unmatched");
    return [];
  }, [v, tab]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] max-w-4xl w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <h3 className="text-[16px] font-semibold text-[#1D2530]">Nouveau rapport sell-out</h3>
          <button onClick={onClose} className="text-[#8B95A5] hover:text-[#1D2530]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <label className="text-[12px] text-[#8B95A5]">Pharmacie cliente (référentiel BE)</label>
            <div className="relative mt-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
              <input
                value={customerLabel}
                onChange={(e) => {
                  setCustomerLabel(e.target.value);
                  setPharmacyQuery(e.target.value);
                  setPharmacyLocked(false);
                  setPharmacyId(null);
                  setShowPharmacyResults(true);
                }}
                onFocus={() => setShowPharmacyResults(true)}
                placeholder="Rechercher par nom, APB, ville, CP… ou saisir un libellé libre"
                className="w-full pl-8 pr-3 py-2 border border-[#E2E8F0] rounded-[8px] text-[13px]"
              />
              {showPharmacyResults && !pharmacyLocked && pharmacyQuery.trim().length >= 2 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-[#E2E8F0] rounded-[8px] shadow-lg max-h-60 overflow-auto">
                  {pharmacyResults.isFetching && (
                    <div className="px-3 py-2 text-[12px] text-[#8B95A5]">Recherche…</div>
                  )}
                  {!pharmacyResults.isFetching && !pharmacyResults.data?.length && (
                    <div className="px-3 py-2 text-[12px] text-[#8B95A5]">
                      Aucun résultat — le texte saisi sera utilisé comme libellé libre.
                    </div>
                  )}
                  {pharmacyResults.data?.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const label = `${p.name} — APB ${p.apb_number}${p.city ? ` · ${p.city}` : ""}`;
                        setCustomerLabel(label);
                        setPharmacyLocked(true);
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
              Colonnes reconnues : <code>gtin/ean</code>, <code>cnk</code>, <code>label/produit</code>,{" "}
              <code>units/qty</code>, <code>ca_net/net</code>, <code>ca_brut/gross</code>. Montants en euros
              (convertis en cents).
            </div>
            {parseResult && parseResult.unknownColumns.length > 0 && (
              <div className="text-[11px] text-[#B45309] mt-1">
                Colonnes ignorées : {parseResult.unknownColumns.join(", ")}
              </div>
            )}
          </div>

          {parseResult && (
            <div className="border border-[#E2E8F0] rounded-[10px] p-4 space-y-3 bg-[#F8FAFC]">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-[#1D2530]">Validation de l'import</div>
                {validation.isFetching && <span className="text-[11px] text-[#8B95A5]">Analyse…</span>}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <SummaryCard label="Lignes lues" value={String(parseResult.totalRows)} />
                <SummaryCard
                  label="Valides"
                  value={String(v?.summary.total ?? parseResult.lines.length)}
                  tone="ok"
                />
                <SummaryCard label="Rejetées" value={String(rejected.length)} tone={rejected.length ? "err" : undefined} />
                <SummaryCard label="Non matchées" value={String(v?.summary.unmatched ?? 0)} tone={v && v.summary.unmatched ? "warn" : undefined} />
                <SummaryCard label="Unités totales" value={(v?.summary.totalUnits ?? 0).toLocaleString("fr-BE")} />
                <SummaryCard label="CA net" value={fmtEur(v?.summary.totalNetCents ?? 0)} />
                <SummaryCard label="CA brut" value={fmtEur(v?.summary.totalGrossCents ?? 0)} />
                <SummaryCard
                  label="Match GTIN / CNK"
                  value={`${v?.summary.matchedGtin ?? 0} / ${v?.summary.matchedCnk ?? 0}`}
                />
              </div>

              <div className="flex flex-wrap gap-1 border-b border-[#E2E8F0]">
                <TabBtn active={tab === "ok"} onClick={() => setTab("ok")}>
                  <CheckCircle2 size={12} className="text-[#047857]" /> OK (
                  {(v?.lines ?? []).filter((l) => l.status !== "unmatched" && !l.warnings.length).length})
                </TabBtn>
                <TabBtn active={tab === "warnings"} onClick={() => setTab("warnings")}>
                  <AlertTriangle size={12} className="text-[#B45309]" /> Alertes (
                  {(v?.lines ?? []).filter((l) => l.status !== "unmatched" && l.warnings.length).length})
                </TabBtn>
                <TabBtn active={tab === "unmatched"} onClick={() => setTab("unmatched")}>
                  <AlertTriangle size={12} className="text-[#B45309]" /> Non matchées (
                  {v?.summary.unmatched ?? 0})
                </TabBtn>
                <TabBtn active={tab === "rejected"} onClick={() => setTab("rejected")}>
                  <XCircle size={12} className="text-[#B91C1C]" /> Rejetées ({rejected.length})
                </TabBtn>
              </div>

              <div className="max-h-[280px] overflow-auto border border-[#E2E8F0] rounded-[8px] bg-white">
                {tab === "rejected" ? (
                  rejected.length === 0 ? (
                    <EmptyRow text="Aucune ligne rejetée." />
                  ) : (
                    <table className="w-full text-[12px]">
                      <thead className="bg-[#F8FAFC] text-[#8B95A5]">
                        <tr>
                          <th className="text-left px-3 py-2">Ligne</th>
                          <th className="text-left px-3 py-2">Motif</th>
                          <th className="text-left px-3 py-2">Contenu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rejected.map((r) => (
                          <tr key={r.rowNumber} className="border-t border-[#F1F5F9]">
                            <td className="px-3 py-2">#{r.rowNumber}</td>
                            <td className="px-3 py-2 text-[#B91C1C]">{r.reason}</td>
                            <td className="px-3 py-2 text-[#64748B] truncate max-w-[300px]">
                              {Object.values(r.raw)
                                .filter((v) => String(v ?? "").trim() !== "")
                                .slice(0, 4)
                                .join(" · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : visibleLines.length === 0 ? (
                  <EmptyRow text="Aucune ligne dans cette catégorie." />
                ) : (
                  <table className="w-full text-[12px]">
                    <thead className="bg-[#F8FAFC] text-[#8B95A5]">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">GTIN</th>
                        <th className="text-left px-3 py-2">CNK</th>
                        <th className="text-left px-3 py-2">Libellé</th>
                        <th className="text-right px-3 py-2">Unités</th>
                        <th className="text-right px-3 py-2">CA net</th>
                        <th className="text-left px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleLines.map((l) => (
                        <tr key={l.index} className="border-t border-[#F1F5F9]">
                          <td className="px-3 py-2">{l.index + 1}</td>
                          <td className="px-3 py-2 font-mono">{l.input.gtin || "—"}</td>
                          <td className="px-3 py-2 font-mono">{l.input.cnk_code || "—"}</td>
                          <td className="px-3 py-2 truncate max-w-[220px]">{l.input.raw_label || "—"}</td>
                          <td className="px-3 py-2 text-right">{l.input.units}</td>
                          <td className="px-3 py-2 text-right">{fmtEur(l.input.net_revenue_cents)}</td>
                          <td className="px-3 py-2">
                            {l.status === "matched_gtin" && <Badge tone="ok">GTIN</Badge>}
                            {l.status === "matched_cnk" && <Badge tone="ok">CNK</Badge>}
                            {l.status === "unmatched" && <Badge tone="warn">Non trouvé</Badge>}
                            {l.warnings.length > 0 && (
                              <span className="ml-1 text-[11px] text-[#B45309]">{l.warnings.join(" · ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {v && v.summary.unmatched > 0 && (
                <label className="flex items-center gap-2 text-[12px] text-[#1D2530]">
                  <input
                    type="checkbox"
                    checked={includeUnmatched}
                    onChange={(e) => setIncludeUnmatched(e.target.checked)}
                  />
                  Importer aussi les {v.summary.unmatched} ligne(s) non matchée(s) (product_id vide)
                </label>
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
            {linesToSubmit.length > 0 && `${linesToSubmit.length} ligne(s) prêtes à importer`}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#8B95A5] hover:text-[#1D2530]">
              Annuler
            </button>
            <button
              onClick={onSubmit}
              disabled={create.isPending || !linesToSubmit.length || validation.isFetching}
              className="px-4 py-2 rounded-[8px] bg-[#1C58D9] text-white text-[13px] font-medium hover:bg-[#164BB9] disabled:opacity-50"
            >
              {create.isPending ? "Import…" : `Importer ${linesToSubmit.length || ""}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "err" }) {
  const color =
    tone === "ok" ? "text-[#047857]" : tone === "warn" ? "text-[#B45309]" : tone === "err" ? "text-[#B91C1C]" : "text-[#1D2530]";
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[8px] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#8B95A5]">{label}</div>
      <div className={`text-[14px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-2 text-[12px] -mb-px border-b-2 ${
        active ? "border-[#1C58D9] text-[#1C58D9] font-medium" : "border-transparent text-[#64748B] hover:text-[#1D2530]"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
      : "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]";
  return <span className={`inline-block text-[10px] px-1.5 py-0.5 border rounded-[4px] ${cls}`}>{children}</span>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-center text-[12px] text-[#8B95A5] py-6">{text}</div>;
}
