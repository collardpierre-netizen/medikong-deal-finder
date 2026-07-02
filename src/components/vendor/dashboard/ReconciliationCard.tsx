import React, { useState } from "react";
import { ChevronDown, ChevronRight, Download, Info } from "lucide-react";
import { useMoneyFormat } from "@/lib/money-format";
import { VCard } from "@/components/vendor/ui/VCard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  VENDOR_GMV_EXCLUDED_STATUSES,
} from "@/lib/vendor-gmv-filters";
import type { VendorReconciliation } from "@/hooks/useVendorReconciliation";


const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  completed: "Terminée",
  invoiced: "Facturée",
  paid: "Payée",
  cancelled: "Annulée",
  canceled: "Annulée",
  refused: "Refusée",
  rejected: "Rejetée",
  refunded: "Remboursée",
  failed: "Échec",
  unknown: "Sans statut",
};

function labelFor(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface Props {
  data: VendorReconciliation | undefined;
  loading: boolean;
  periodLabel: string;
}

export default function ReconciliationCard({ data, loading, periodLabel }: Props) {
  const { formatMoney } = useMoneyFormat();
  const fmt = (c: number) => formatMoney(c / 100, { fractionDigits: 2 });
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = data?.rows ?? [];
  const hasExcluded = rows.some((r) => !r.included);
  const ordersByStatus = data?.ordersByStatus ?? {};

  const toggle = (status: string) =>
    setExpanded((s) => (s === status ? null : status));

  const handleExportCsv = () => {
    if (!data || rows.length === 0) return;
    const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const esc = (v: string | number) => {
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["Statut", "Inclus", "Nb commandes", "CA HTVA (EUR)", "GMV TTC (EUR)"];
    const lines = [header.join(";")];
    for (const r of rows) {
      lines.push(
        [
          esc(labelFor(r.status)),
          r.included ? "Oui" : "Non",
          r.ordersCount,
          money(r.revenueExclVatCents),
          money(r.gmvInclVatCents),
        ].join(";"),
      );
    }
    lines.push(
      [
        esc("Total inclus"),
        "",
        rows.filter((r) => r.included).reduce((a, r) => a + r.ordersCount, 0),
        money(data.includedRevenueExclVatCents),
        money(data.includedGmvInclVatCents),
      ].join(";"),
    );
    if (hasExcluded) {
      lines.push(
        [
          esc("Total exclu"),
          "",
          rows.filter((r) => !r.included).reduce((a, r) => a + r.ordersCount, 0),
          money(data.excludedRevenueExclVatCents),
          money(data.excludedGmvInclVatCents),
        ].join(";"),
      );
    }
    lines.push(
      [esc("TVA collectée (GMV − CA, inclus)"), "", "", "", money(data.vatCents)].join(";"),
    );
    const csv = "\uFEFF" + lines.join("\r\n");
    const slug = periodLabel
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${slug || "periode"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <VCard>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1E252F]">
              Réconciliation CA HTVA ↔ GMV TTC
            </h3>
            <p className="text-[11px] text-[#8B95A5] mt-0.5">
              Détail par statut de commande sur {periodLabel.toLowerCase()}. Les
              statuts <em>exclus</em> ne comptent ni dans le CA, ni dans le GMV.
              {rows.length > 0 && (
                <>
                  {" "}
                  <span className="text-[#475569]">
                    Cliquez sur une ligne pour voir les commandes qui composent
                    ces totaux.
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || rows.length === 0}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1E252F] hover:bg-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Exporter la réconciliation en CSV"
          >
            <Download size={13} />
            Exporter CSV
          </button>
        </div>

        {loading ? (
          <div className="text-[12px] text-[#8B95A5]">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="text-[12px] text-[#8B95A5]">
            Aucune commande sur la période.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead>
                  <tr className="text-left text-[11px] text-[#8B95A5] border-b border-[#E2E8F0]">
                    <th className="py-1.5 pr-2 font-medium w-6"></th>
                    <th className="py-1.5 pr-2 font-medium">Statut</th>
                    <th className="py-1.5 pr-2 font-medium">Inclus</th>
                    <th className="py-1.5 pr-2 font-medium text-right">Cmds</th>
                    <th className="py-1.5 pr-2 font-medium text-right">CA HTVA</th>
                    <th className="py-1.5 font-medium text-right">GMV TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isOpen = expanded === r.status;
                    const orders = ordersByStatus[r.status] ?? [];
                    return (
                      <React.Fragment key={r.status}>
                        <tr
                          role="button"

                          tabIndex={0}
                          aria-expanded={isOpen}
                          aria-label={`Voir les commandes ${labelFor(r.status)}`}
                          onClick={() => toggle(r.status)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle(r.status);
                            }
                          }}
                          className={`border-b border-[#F1F5F9] cursor-pointer transition-colors hover:bg-[#F8FAFC] focus:bg-[#F1F5F9] focus:outline-none ${
                            r.included ? "" : "text-[#8B95A5]"
                          } ${isOpen ? "bg-[#F8FAFC]" : ""}`}
                        >
                          <td className="py-1.5 pl-1 pr-1 text-[#8B95A5]">
                            {isOpen ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </td>
                          <td className="py-1.5 pr-2">{labelFor(r.status)}</td>
                          <td className="py-1.5 pr-2">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                r.included
                                  ? "bg-[#DCFCE7] text-[#166534]"
                                  : "bg-[#FEE2E2] text-[#991B1B]"
                              }`}
                            >
                              {r.included ? "Oui" : "Non"}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 text-right">{r.ordersCount}</td>
                          <td className="py-1.5 pr-2 text-right">
                            {fmt(r.revenueExclVatCents)}
                          </td>
                          <td className="py-1.5 text-right">
                            {fmt(r.gmvInclVatCents)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${r.status}-detail`} className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                            <td colSpan={6} className="p-2">
                              {orders.length === 0 ? (
                                <div className="text-[11px] text-[#8B95A5] px-2 py-1">
                                  Aucune commande détaillée disponible.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px] tabular-nums">
                                    <thead>
                                      <tr className="text-left text-[10px] text-[#8B95A5] border-b border-[#E2E8F0]">
                                        <th className="py-1 pr-2 font-medium">N° commande</th>
                                        <th className="py-1 pr-2 font-medium">Date</th>
                                        <th className="py-1 pr-2 font-medium text-right">Lignes</th>
                                        <th className="py-1 pr-2 font-medium text-right">CA HTVA</th>
                                        <th className="py-1 pr-2 font-medium text-right">GMV TTC</th>
                                        <th className="py-1 font-medium text-right">TVA</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {orders.map((o) => {
                                        const vat = o.gmvInclVatCents - o.revenueExclVatCents;
                                        return (
                                          <tr
                                            key={o.orderId}
                                            className="border-b border-[#F1F5F9] last:border-b-0"
                                          >
                                            <td className="py-1 pr-2 font-medium text-[#1E252F]">
                                              {o.orderNumber ?? o.orderId.slice(0, 8)}
                                            </td>
                                            <td className="py-1 pr-2 text-[#475569]">
                                              {formatDate(o.createdAt)}
                                            </td>
                                            <td className="py-1 pr-2 text-right">{o.linesCount}</td>
                                            <td className="py-1 pr-2 text-right">
                                              {fmt(o.revenueExclVatCents)}
                                            </td>
                                            <td className="py-1 pr-2 text-right">
                                              {fmt(o.gmvInclVatCents)}
                                            </td>
                                            <td className="py-1 text-right text-[#475569]">
                                              {fmt(vat)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr className="text-[11px] font-semibold text-[#1E252F] border-t border-[#E2E8F0]">
                                        <td className="py-1 pr-2" colSpan={3}>
                                          Sous-total ({r.ordersCount} cmd)
                                        </td>
                                        <td className="py-1 pr-2 text-right">
                                          {fmt(r.revenueExclVatCents)}
                                        </td>
                                        <td className="py-1 pr-2 text-right">
                                          {fmt(r.gmvInclVatCents)}
                                        </td>
                                        <td className="py-1 text-right">
                                          {fmt(r.gmvInclVatCents - r.revenueExclVatCents)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>

                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="text-[12px] font-semibold text-[#1E252F] border-t border-[#E2E8F0]">
                    <td className="py-1.5 pr-2" colSpan={4}>
                      Total inclus (= CA / GMV du dashboard)
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      {fmt(data!.includedRevenueExclVatCents)}
                    </td>
                    <td className="py-1.5 text-right">
                      {fmt(data!.includedGmvInclVatCents)}
                    </td>
                  </tr>
                  {hasExcluded && (
                    <tr className="text-[12px] text-[#8B95A5]">
                      <td className="py-1.5 pr-2" colSpan={4}>
                        Total exclu (non comptabilisé)
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {fmt(data!.excludedRevenueExclVatCents)}
                      </td>
                      <td className="py-1.5 text-right">
                        {fmt(data!.excludedGmvInclVatCents)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            <div className="rounded-lg bg-[#F8FAFC] p-3 text-[12px] text-[#475569] leading-relaxed">
              <div className="font-semibold text-[#1E252F] mb-1">
                Écart CA ↔ GMV expliqué
              </div>
              <div className="flex items-center justify-between">
                <span>GMV TTC (inclus)</span>
                <span className="tabular-nums">
                  {fmt(data!.includedGmvInclVatCents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>− CA HTVA (inclus)</span>
                <span className="tabular-nums">
                  − {fmt(data!.includedRevenueExclVatCents)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#E2E8F0] mt-1 pt-1 font-semibold text-[#1E252F]">
                <span>= TVA collectée</span>
                <span className="tabular-nums">{fmt(data!.vatCents)}</span>
              </div>
              <p className="text-[11px] text-[#8B95A5] mt-2">
                Même source, mêmes statuts : l'écart entre CA HTVA et GMV TTC
                correspond à la TVA. Les lignes «&nbsp;exclues&nbsp;» ci-dessus
                ne figurent dans aucun des deux totaux.
              </p>
            </div>
          </>
        )}
      </div>
    </VCard>
  );
}
