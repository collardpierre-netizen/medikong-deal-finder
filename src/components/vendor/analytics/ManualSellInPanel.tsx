import { useMemo, useState } from "react";
import { Plus, Trash2, FileSpreadsheet, ClipboardList } from "lucide-react";
import {
  useVendorManualSellInReports,
  useManualSellInLines,
  useDeleteManualSellInReport,
} from "@/hooks/useVendorManualSellIn";
import { NewManualSellInDialog } from "./NewManualSellInDialog";
import { fmtEur } from "@/lib/format-currency";

const card = "p-5 rounded-[10px] bg-white border border-[#E2E8F0]";

export function ManualSellInPanel({ vendorId }: { vendorId: string | null }) {
  const { data: reports, isLoading } = useVendorManualSellInReports();
  const del = useDeleteManualSellInReport();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: lines } = useManualSellInLines(selectedId);

  const selected = useMemo(
    () => reports?.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const totals = useMemo(() => {
    if (!lines) return null;
    return lines.reduce(
      (acc, l) => ({
        units: acc.units + Number(l.units || 0),
        net: acc.net + Number(l.net_revenue_cents || 0),
      }),
      { units: 0, net: 0 },
    );
  }, [lines]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-[#1D2530]">Sell-in hors plateforme</div>
          <div className="text-[12px] text-[#8B95A5]">
            Encodez manuellement (formulaire ou XLSX) les ventes réalisées en dehors de MediKong
            (EDI, téléphone, direct). Complète le sell-in auto issu des commandes.
          </div>
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
        <div className="text-[13px] font-semibold mb-3">Rapports enregistrés</div>
        {isLoading && <div className="text-[12px] text-[#8B95A5]">Chargement…</div>}
        {!reports?.length && !isLoading && (
          <div className="text-[12px] text-[#8B95A5] py-6 text-center">
            Aucun rapport de sell-in manuel pour l'instant.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(reports ?? []).map((r) => {
            const label = r.pharmacy?.name || r.customer_label || "Client";
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`text-left p-3 rounded-[8px] border ${
                  selectedId === r.id
                    ? "border-[#1C58D9] bg-[#F0F6FF]"
                    : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {r.source === "xlsx" ? (
                      <FileSpreadsheet size={14} className="text-[#8B95A5] mt-0.5 shrink-0" />
                    ) : (
                      <ClipboardList size={14} className="text-[#8B95A5] mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-[#1D2530] truncate">
                        {label}
                      </div>
                      {r.pharmacy?.apb_number && (
                        <div className="text-[11px] text-[#8B95A5]">
                          APB {r.pharmacy.apb_number}
                          {r.pharmacy.city ? ` · ${r.pharmacy.city}` : ""}
                        </div>
                      )}
                      <div className="text-[11px] text-[#8B95A5]">
                        {new Date(r.period_start).toLocaleDateString("fr-FR")} →{" "}
                        {new Date(r.period_end).toLocaleDateString("fr-FR")}
                      </div>
                      <div className="text-[10px] text-[#8B95A5] uppercase mt-0.5">
                        {r.source} · {r.line_count ?? 0} ligne(s)
                      </div>
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
            );
          })}
        </div>
      </div>

      {selected && (
        <div className={card}>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="text-[13px] font-semibold">
              Détail — {selected.pharmacy?.name || selected.customer_label || "Client"} (
              {selected.period_start} → {selected.period_end})
            </div>
            {totals && (
              <div className="text-[11px] text-[#8B95A5]">
                {totals.units} unités · {fmtEur(totals.net / 100)} € HTVA
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[#8B95A5] border-b border-[#E2E8F0]">
                  <th className="py-2">Produit</th>
                  <th>GTIN</th>
                  <th>CNK</th>
                  <th className="text-right">Unités</th>
                  <th className="text-right">CA net</th>
                </tr>
              </thead>
              <tbody>
                {(lines ?? []).map((l) => (
                  <tr key={l.id} className="border-b border-[#F1F5F9]">
                    <td className="py-2">
                      {l.product?.name || l.raw_label || (
                        <span className="text-[#8B95A5] italic">Non résolu</span>
                      )}
                    </td>
                    <td className="text-[11px] font-mono text-[#8B95A5]">{l.gtin || "—"}</td>
                    <td className="text-[11px] font-mono text-[#8B95A5]">{l.cnk_code || "—"}</td>
                    <td className="text-right">{l.units}</td>
                    <td className="text-right">{fmtEur(l.net_revenue_cents / 100)}</td>
                  </tr>
                ))}
                {!lines?.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#8B95A5]">
                      Aucune ligne.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && vendorId && (
        <NewManualSellInDialog vendorId={vendorId} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
