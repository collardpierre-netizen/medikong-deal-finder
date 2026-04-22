import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useNavigate } from "react-router-dom";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { ContractHistoryTable } from "@/components/vendor/ContractHistoryTable";
import {
  Receipt, Download, TrendingUp, Truck, Loader2, FileText, Euro,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "#8B95A5", label: "Brouillon" },
  sent: { color: "#1B5BDA", label: "Envoyée" },
  paid: { color: "#059669", label: "Payée" },
  overdue: { color: "#EF4343", label: "En retard" },
};

export default function VendorBilling() {
  const navigate = useNavigate();
  const { data: vendor, isLoading: vendorLoading } = useCurrentVendor();
  const shippingMode = (vendor as any)?.vendor_shipping_mode;
  const vendorId = vendor?.id;

  // Redirect non-whitelabel
  if (!vendorLoading && shippingMode && shippingMode !== "medikong_whitelabel") {
    return (
      <div className="text-center py-24">
        <Receipt size={48} className="text-[#CBD5E1] mx-auto mb-4" />
        <p className="text-[#8B95A5] text-[14px]">La facturation n'est disponible qu'en mode Medikong Shipping.</p>
        <VBtn className="mt-4" onClick={() => navigate("/vendor")}>Retour au dashboard</VBtn>
      </div>
    );
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Fetch invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["vendor-invoices", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_invoices")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vendorId,
  });

  // Current month shipments for running total & carrier breakdown
  const { data: currentShipments = [] } = useQuery({
    queryKey: ["vendor-billing-current", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("carrier, cost_total_cents, cost_base_cents, cost_margin_cents, created_at")
        .eq("vendor_id", vendorId!)
        .eq("shipping_mode_used", "medikong_whitelabel")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vendorId,
  });

  const runningTotal = currentShipments.reduce((s, sh) => s + (sh.cost_total_cents ?? 0), 0);
  const runningBase = currentShipments.reduce((s, sh) => s + (sh.cost_base_cents ?? 0), 0);
  const runningMargin = currentShipments.reduce((s, sh) => s + (sh.cost_margin_cents ?? 0), 0);

  // Carrier breakdown
  const carrierMap = new Map<string, { count: number; total: number }>();
  currentShipments.forEach((sh) => {
    const c = sh.carrier ?? "Inconnu";
    const prev = carrierMap.get(c) ?? { count: 0, total: 0 };
    carrierMap.set(c, { count: prev.count + 1, total: prev.total + (sh.cost_total_cents ?? 0) });
  });
  const carrierBreakdown = Array.from(carrierMap.entries())
    .sort((a, b) => b[1].total - a[1].total);

  const handleDownloadPdf = (invoice: any) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Facture Logistique", 14, 22);
    doc.setFontSize(10);
    doc.text(`N° ${invoice.invoice_number ?? invoice.id.slice(0, 8)}`, 14, 30);
    doc.text(`Période : ${format(new Date(invoice.period_start), "MMMM yyyy", { locale: fr })}`, 14, 36);
    doc.text(`Statut : ${STATUS_CONFIG[invoice.status]?.label ?? invoice.status}`, 14, 42);
    doc.text(`Vendeur : ${(vendor as any)?.company_name ?? ""}`, 14, 48);

    autoTable(doc, {
      startY: 56,
      head: [["Description", "Montant HT"]],
      body: [
        ["Coût transport", centsToEur(invoice.base_cost_cents)],
        ["Commission Medikong", centsToEur(invoice.margin_cents)],
        ["Total facturé", centsToEur(invoice.total_cents)],
      ],
    });

    doc.save(`facture-${invoice.invoice_number ?? invoice.id.slice(0, 8)}.pdf`);
  };

  if (vendorLoading || invoicesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-[#8B95A5]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Facturation</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">Factures mensuelles Medikong Shipping</p>
      </div>

      {/* Current month KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <VCard>
          <div className="flex items-center gap-2 mb-1">
            <Euro size={14} className="text-[#1B5BDA]" />
            <span className="text-[11px] text-[#8B95A5] font-medium uppercase tracking-wide">Mois en cours</span>
          </div>
          <p className="text-2xl font-bold text-[#1D2530]">{centsToEur(runningTotal)}</p>
          <p className="text-[11px] text-[#8B95A5] mt-0.5">{currentShipments.length} expédition{currentShipments.length !== 1 ? "s" : ""}</p>
        </VCard>
        <VCard>
          <div className="flex items-center gap-2 mb-1">
            <Truck size={14} className="text-[#7C3AED]" />
            <span className="text-[11px] text-[#8B95A5] font-medium uppercase tracking-wide">Coût transport</span>
          </div>
          <p className="text-2xl font-bold text-[#1D2530]">{centsToEur(runningBase)}</p>
        </VCard>
        <VCard>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-[#F59E0B]" />
            <span className="text-[11px] text-[#8B95A5] font-medium uppercase tracking-wide">Commission MediKong</span>
          </div>
          <p className="text-2xl font-bold text-[#1D2530]">{centsToEur(runningMargin)}</p>
        </VCard>
      </div>

      {/* Carrier breakdown */}
      {carrierBreakdown.length > 0 && (
        <VCard>
          <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Répartition par transporteur</h2>
          <div className="space-y-2">
            {carrierBreakdown.map(([carrier, { count, total }]) => {
              const pct = runningTotal > 0 ? Math.round((total / runningTotal) * 100) : 0;
              return (
                <div key={carrier} className="flex items-center gap-3 text-[13px]">
                  <span className="w-24 font-medium text-[#1D2530] truncate">{carrier}</span>
                  <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div className="h-full bg-[#1B5BDA] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[#616B7C] w-16 text-right">{centsToEur(total)}</span>
                  <span className="text-[#8B95A5] text-[11px] w-12 text-right">{count} exp.</span>
                </div>
              );
            })}
          </div>
        </VCard>
      )}

      {/* Invoices table */}
      <VCard>
        <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Historique des factures</h2>
        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[13px] text-[#8B95A5]">Aucune facture pour le moment</p>
            <p className="text-[12px] text-[#8B95A5] mt-1">Votre première facture sera générée en fin de mois.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[11px] text-[#8B95A5] uppercase tracking-wide">
                  <th className="text-left py-2.5 px-3 font-medium">Période</th>
                  <th className="text-left py-2.5 px-3 font-medium">N° Facture</th>
                  <th className="text-right py-2.5 px-3 font-medium">Transport</th>
                  <th className="text-right py-2.5 px-3 font-medium">Commission</th>
                  <th className="text-right py-2.5 px-3 font-medium">Total</th>
                  <th className="text-center py-2.5 px-3 font-medium">Statut</th>
                  <th className="text-right py-2.5 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const st = STATUS_CONFIG[inv.status] ?? { color: "#616B7C", label: inv.status };
                  return (
                    <tr key={inv.id} className="border-b border-[#F1F5F9] hover:bg-[#FAFBFC]">
                      <td className="py-2.5 px-3 font-medium text-[#1D2530]">
                        {format(new Date(inv.period_start), "MMMM yyyy", { locale: fr })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#616B7C]">
                        {inv.invoice_number ?? inv.id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 px-3 text-right">{centsToEur(inv.base_cost_cents)}</td>
                      <td className="py-2.5 px-3 text-right">{centsToEur(inv.margin_cents)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{centsToEur(inv.total_cents)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <VBadge color={st.color}>{st.label}</VBadge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDownloadPdf(inv)}
                          className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#616B7C] hover:text-[#1B5BDA]"
                          title="Télécharger PDF"
                        >
                          <Download size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </VCard>

      {/* Contract signature history */}
      <VCard>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-bold text-[#1D2530]">
            Historique des conventions signées
          </h2>
          <span className="text-[11px] text-[#8B95A5]">
            Date · Statut · Empreinte SHA-256
          </span>
        </div>
        <ContractHistoryTable vendorId={vendorId} />
      </VCard>
    </div>
  );
}

function centsToEur(cents: number | null): string {
  if (!cents) return "0,00 €";
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}
