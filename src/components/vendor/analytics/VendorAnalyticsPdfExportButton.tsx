import { FileDown, Loader2, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
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
import { generateVendorAnalyticsPdf, type GeoPoint, type GeneratedPdf } from "@/lib/vendor-analytics-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  vendorName: string;
  vendorId: string | null;
  period: AnalyticsPeriod;
  periodLabel: string;
}

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
  const [preview, setPreview] = useState<GeneratedPdf | null>(null);
  const kpis = useVendorAnalyticsKpis(period);
  const byType = useVendorAnalyticsByCustomerType(period);
  const byCountry = useVendorAnalyticsByCountry(period);
  const topCustomers = useVendorAnalyticsTopCustomers(period, 25);
  const topProducts = useVendorAnalyticsTopProducts(period, 25);
  const recurrence = useVendorAnalyticsRecurrence(period);

  const anyLoading =
    kpis.isLoading || byType.isLoading || byCountry.isLoading || topCustomers.isLoading || topProducts.isLoading || recurrence.isLoading;

  const disabled = !vendorId || busy;

  // Revoke blob URL when preview closes/changes
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.blobUrl);
    };
  }, [preview]);

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  };

  const onClick = async () => {
    if (!vendorId) {
      toast.error("Aucun vendor_id résolu — impossible d'exporter.");
      return;
    }
    setBusy(true);
    const loadingId = toast.loading("Génération de l'aperçu PDF…");
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
        geoPoints = [];
      }

      const generated = await generateVendorAnalyticsPdf(
        {
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
        },
        { autoSave: false }
      );
      setPreview(generated);
      toast.success("Aperçu prêt", { id: loadingId });
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`Échec de la génération : ${msg}`, { id: loadingId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
        title="Prévisualiser puis exporter le rapport PDF"
      >
        {busy || anyLoading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
        Export PDF
      </button>

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b border-[#E2E8F0] flex-row items-center justify-between space-y-0">
            <div className="flex flex-col">
              <DialogTitle className="text-[15px] font-semibold text-[#1D2530]">
                Aperçu du rapport PDF
              </DialogTitle>
              <span className="text-[11px] text-[#616B7C]">{vendorName} · {periodLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => preview?.save()}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] text-[12px] font-semibold border bg-[#1B5BDA] text-white border-[#1B5BDA] hover:bg-[#164ab3]"
              >
                <Download size={14} />
                Télécharger le PDF
              </button>
              <button
                type="button"
                onClick={closePreview}
                aria-label="Fermer l'aperçu"
                className="inline-flex items-center justify-center h-9 w-9 rounded-[8px] border border-[#E2E8F0] text-[#1D2530] hover:bg-[#F8FAFC]"
              >
                <X size={16} />
              </button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-[#F1F5F9]">
            {preview && (
              <iframe
                title="Aperçu du PDF"
                src={preview.blobUrl}
                className="w-full h-full border-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
