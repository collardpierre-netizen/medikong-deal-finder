import { useMemo, useState } from "react";
import { useVendorSellOutReports, useDeleteSellOutReport, useSellInVsSellOut } from "@/hooks/useVendorSellOut";
import { NewSellOutReportDialog } from "./NewSellOutReportDialog";
import { fmtEur } from "@/lib/format-currency";
import { Download, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

const card = "p-5 rounded-[10px] bg-white border border-[#E2E8F0]";

const EXPORT_HEADERS = [
  "Produit",
  "GTIN",
  "CNK",
  "Sell-in (unités)",
  "Sell-in HTVA (€)",
  "Sell-out (unités)",
  "Sell-out net (€)",
  "Delta unités",
  "Sell-through (%)",
] as const;

type ExportRow = (string | number | null)[];

function buildRows(rows: ReturnType<typeof useSellInVsSellOut>["data"]): ExportRow[] {
  return (rows ?? []).map((r) => [
    r.product_name || "Non résolu",
    r.gtin || "",
    r.cnk_code || "",
    Number(r.sell_in_units || 0),
    Number(r.sell_in_ca_htva_cents || 0) / 100,
    Number(r.sell_out_units || 0),
    Number(r.sell_out_net_cents || 0) / 100,
    Number(r.delta_units || 0),
    r.sell_through_pct != null ? Number(r.sell_through_pct) : null,
  ]);
}

function safeSlug(s: string | null | undefined): string {
  return (s || "rapport").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "rapport";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(rows: ExportRow[], filename: string) {
  const escape = (v: string | number | null) => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [EXPORT_HEADERS.join(";"), ...rows.map((r) => r.map(escape).join(";"))];
  // BOM pour Excel FR
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

function exportXlsx(rows: ExportRow[], filename: string, sheetName: string) {
  const aoa = [EXPORT_HEADERS as unknown as ExportRow, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Comparaison");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export function SellOutPanel({ vendorId }: { vendorId: string | null }) {
  const { data: reports, isLoading } = useVendorSellOutReports();
  const del = useDeleteSellOutReport();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: rows } = useSellInVsSellOut(selectedId);

  const selectedReport = useMemo(
    () => reports?.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId]
  );

  const totals = useMemo(() => {
    if (!rows) return null;
    return rows.reduce(
      (acc, r) => ({
        si_units: acc.si_units + Number(r.sell_in_units || 0),
        si_ca: acc.si_ca + Number(r.sell_in_ca_htva_cents || 0),
        so_units: acc.so_units + Number(r.sell_out_units || 0),
        so_net: acc.so_net + Number(r.sell_out_net_cents || 0),
      }),
      { si_units: 0, si_ca: 0, so_units: 0, so_net: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-[#1D2530]">Sell-in vs Sell-out</div>
          <div className="text-[12px] text-[#8B95A5]">Compare vos livraisons aux sorties réelles fournies par vos clients.</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={!vendorId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#1C58D9] text-white text-[13px] font-medium hover:bg-[#164BB9] disabled:opacity-50"
        >
          <Plus size={14} /> Nouveau rapport
        </button>
      </div>

      <div className={card}>
        <div className="text-[13px] font-semibold mb-3">Rapports importés</div>
        {isLoading && <div className="text-[12px] text-[#8B95A5]">Chargement…</div>}
        {!reports?.length && !isLoading && (
          <div className="text-[12px] text-[#8B95A5] py-6 text-center">
            Aucun rapport sell-out. Importez un XLSX/CSV fourni par un client pour lancer la comparaison.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(reports ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`text-left p-3 rounded-[8px] border ${
                selectedId === r.id ? "border-[#1C58D9] bg-[#F0F6FF]" : "border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <FileSpreadsheet size={14} className="text-[#8B95A5] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[#1D2530] truncate">
                      {r.customer_label || "Client interne"}
                    </div>
                    <div className="text-[11px] text-[#8B95A5]">
                      {new Date(r.period_start).toLocaleDateString("fr-FR")} → {new Date(r.period_end).toLocaleDateString("fr-FR")}
                    </div>
                    <div className="text-[10px] text-[#8B95A5] uppercase mt-0.5">{r.source}</div>
                  </div>
                </div>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer ce rapport ?")) del.mutate(r.id);
                  }}
                  className="text-[#8B95A5] hover:text-[#B91C1C] cursor-pointer"
                >
                  <Trash2 size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedReport && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold">
              Comparaison — {selectedReport.customer_label || "Client interne"} ({selectedReport.period_start} → {selectedReport.period_end})
            </div>
            {totals && (
              <div className="text-[11px] text-[#8B95A5]">
                Sell-in {totals.si_units} u · {fmtEur(totals.si_ca / 100)} € · Sell-out {totals.so_units} u · {fmtEur(totals.so_net / 100)} €
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[#8B95A5] border-b border-[#E2E8F0]">
                  <th className="py-2">Produit</th>
                  <th>GTIN/CNK</th>
                  <th className="text-right">Sell-in (u)</th>
                  <th className="text-right">Sell-in (€)</th>
                  <th className="text-right">Sell-out (u)</th>
                  <th className="text-right">Sell-out (€)</th>
                  <th className="text-right">Δ (u)</th>
                  <th className="text-right">Sell-through</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r, i) => (
                  <tr key={`${r.product_id ?? "x"}-${i}`} className="border-b border-[#F1F5F9]">
                    <td className="py-2">{r.product_name || <span className="text-[#8B95A5] italic">Non résolu</span>}</td>
                    <td className="text-[11px] text-[#8B95A5]">{r.gtin || r.cnk_code || "—"}</td>
                    <td className="text-right">{r.sell_in_units}</td>
                    <td className="text-right">{fmtEur(r.sell_in_ca_htva_cents / 100)}</td>
                    <td className="text-right">{r.sell_out_units}</td>
                    <td className="text-right">{fmtEur(r.sell_out_net_cents / 100)}</td>
                    <td className="text-right" style={{ color: r.delta_units < 0 ? "#047857" : r.delta_units > 0 ? "#B91C1C" : undefined }}>
                      {r.delta_units > 0 ? `+${r.delta_units}` : r.delta_units}
                    </td>
                    <td className="text-right">{r.sell_through_pct != null ? `${r.sell_through_pct}%` : "—"}</td>
                  </tr>
                ))}
                {!rows?.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-[#8B95A5]">Aucune ligne à comparer.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && vendorId && (
        <NewSellOutReportDialog vendorId={vendorId} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
