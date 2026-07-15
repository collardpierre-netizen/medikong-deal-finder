import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useVendorAnalyticsKpis,
  useVendorAnalyticsByCustomerType,
  useVendorAnalyticsByCountry,
  useVendorAnalyticsTopCustomers,
  useVendorAnalyticsTopProducts,
  type AnalyticsPeriod,
} from "@/hooks/useVendorAnalytics";
import { useVendorAnalyticsRecurrence } from "@/hooks/useVendorAnalyticsRecurrence";
import { generateVendorAnalyticsPdf } from "@/lib/vendor-analytics-pdf";

interface Props {
  vendorName: string;
  vendorId: string | null;
  period: AnalyticsPeriod;
  periodLabel: string;
}

/**
 * Fetches every analytics dataset (in background) then produces a MediKong-branded PDF.
 * All hooks are always mounted so data is warm when the button is clicked.
 */
export function VendorAnalyticsPdfExportButton({ vendorName, vendorId, period, periodLabel }: Props) {
  const [busy, setBusy] = useState(false);
  const kpis = useVendorAnalyticsKpis(period);
  const byType = useVendorAnalyticsByCustomerType(period);
  const byCountry = useVendorAnalyticsByCountry(period);
  const topCustomers = useVendorAnalyticsTopCustomers(period, 25);
  const topProducts = useVendorAnalyticsTopProducts(period, 25);
  const recurrence = useVendorAnalyticsRecurrence(period);

  const anyLoading =
    kpis.isLoading || byType.isLoading || byCountry.isLoading || topCustomers.isLoading || topProducts.isLoading || recurrence.isLoading;

  const disabled = !vendorId || busy;

  const onClick = async () => {
    if (!vendorId) {
      toast.error("Aucun vendor_id résolu — impossible d'exporter.");
      return;
    }
    setBusy(true);
    try {
      // Ensure fresh data (best-effort refetch of anything stale).
      await Promise.all([
        kpis.data ? null : kpis.refetch(),
        byType.data ? null : byType.refetch(),
        byCountry.data ? null : byCountry.refetch(),
        topCustomers.data ? null : topCustomers.refetch(),
        topProducts.data ? null : topProducts.refetch(),
        recurrence.data ? null : recurrence.refetch(),
      ]);

      generateVendorAnalyticsPdf({
        vendorName,
        period,
        periodLabel,
        kpis: (kpis.data as any) ?? null,
        byType: (byType.data as any) ?? [],
        byCountry: (byCountry.data as any) ?? [],
        topCustomers: (topCustomers.data as any) ?? [],
        topProducts: (topProducts.data as any) ?? [],
        recurrence: (recurrence.data as any) ?? null,
      });
      toast.success("Export PDF généré");
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`Échec de l'export PDF : ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] text-[12px] font-semibold transition-colors border"
      style={{
        backgroundColor: disabled ? "#F1F5F9" : "#1B5BDA",
        color: disabled ? "#8B95A5" : "#fff",
        borderColor: disabled ? "#E2E8F0" : "#1B5BDA",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      title="Exporter un rapport PDF des analytics"
    >
      {busy || anyLoading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      Export PDF
    </button>
  );
}
