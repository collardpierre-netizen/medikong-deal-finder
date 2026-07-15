import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useVendorAnalyticsKpis,
  useVendorAnalyticsByCustomerType,
  useVendorAnalyticsByCountry,
  useVendorAnalyticsTopCustomers,
  useVendorAnalyticsTopProducts,
  computeRange,
  type AnalyticsPeriod,
} from "@/hooks/useVendorAnalytics";
import { useVendorAnalyticsRecurrence } from "@/hooks/useVendorAnalyticsRecurrence";
import { supabase } from "@/integrations/supabase/client";
import { generateVendorAnalyticsPdf, type GeoPoint } from "@/lib/vendor-analytics-pdf";

interface Props {
  vendorName: string;
  vendorId: string | null;
  period: AnalyticsPeriod;
  periodLabel: string;
}

/**
 * Resolve geocoded points for the customer-location dataset used by CustomerMap.
 * Reuses the `geocode-locations` edge function (server-side cache).
 */
async function fetchGeoPoints(vendorId: string, period: AnalyticsPeriod): Promise<GeoPoint[]> {
  const { from, to } = computeRange(period);
  const { data: locData, error: locErr } = await (supabase.rpc as any)(
    "vendor_analytics_customer_locations",
    { _from: from, _to: to, _vendor_id: vendorId, _product_id: null }
  );
  if (locErr) throw locErr;
  const rows: Array<{
    country_code: string; postal_code: string; city: string;
    customers_count: number; orders_count: number; ca_htva_cents: number;
  }> = (locData ?? []).filter((r: any) => r.postal_code !== "-" || r.city !== "-");
  if (rows.length === 0) return [];

  const locations = rows.map((r) => ({
    country_code: r.country_code,
    postal_code: r.postal_code,
    city: r.city,
  }));

  const geoByKey = new Map<string, { lat: number; lng: number }>();
  // Poll the edge function until no more pending geocodes (bounded).
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase.functions.invoke("geocode-locations", { body: { locations } });
    if (error) break;
    const results: Array<{ key: string; lat: number; lng: number }> = data?.results ?? [];
    for (const r of results) geoByKey.set(r.key, { lat: r.lat, lng: r.lng });
    const pending: number = data?.pending ?? 0;
    if (!pending) break;
  }

  const out: GeoPoint[] = [];
  for (const r of rows) {
    const key = `${r.country_code}|${r.postal_code}|${r.city}`;
    const g = geoByKey.get(key);
    if (!g) continue;
    out.push({
      lat: g.lat,
      lng: g.lng,
      city: r.city,
      postal_code: r.postal_code,
      country_code: r.country_code,
      ca_htva_cents: Number(r.ca_htva_cents) || 0,
      orders_count: Number(r.orders_count) || 0,
      customers_count: Number(r.customers_count) || 0,
    });
  }
  return out;
}

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
    const loadingId = toast.loading("Génération du PDF en cours…");
    try {
      await Promise.all([
        kpis.data ? null : kpis.refetch(),
        byType.data ? null : byType.refetch(),
        byCountry.data ? null : byCountry.refetch(),
        topCustomers.data ? null : topCustomers.refetch(),
        topProducts.data ? null : topProducts.refetch(),
        recurrence.data ? null : recurrence.refetch(),
      ]);

      let geoPoints: GeoPoint[] = [];
      try {
        geoPoints = await fetchGeoPoints(vendorId, period);
      } catch {
        // Coverage map is optional — carry on without it.
        geoPoints = [];
      }

      await generateVendorAnalyticsPdf({
        vendorName,
        period,
        periodLabel,
        kpis: (kpis.data as any) ?? null,
        byType: (byType.data as any) ?? [],
        byCountry: (byCountry.data as any) ?? [],
        topCustomers: (topCustomers.data as any) ?? [],
        topProducts: (topProducts.data as any) ?? [],
        recurrence: (recurrence.data as any) ?? null,
        geoPoints,
      });
      toast.success("Export PDF généré", { id: loadingId });
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`Échec de l'export PDF : ${msg}`, { id: loadingId });
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
