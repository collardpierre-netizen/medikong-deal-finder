import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime inserts on `vendor_price_alert_events` for the given vendor
 * and shows an in-app toast when a new alert is detected.
 * Also invalidates related queries so the bell badge / lists refresh immediately.
 */
export function useVendorPriceAlertRealtime(vendorId: string | undefined) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-price-alerts-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vendor_price_alert_events",
          filter: `vendor_id=eq.${vendorId}`,
        },
        async (payload) => {
          const ev: any = payload.new;
          if (!ev?.id || seenIds.current.has(ev.id)) return;
          seenIds.current.add(ev.id);

          // Best-effort product label enrichment
          let productLabel = "un produit";
          try {
            const { data: product } = await (supabase as any)
              .from("products")
              .select("name,gtin")
              .eq("id", ev.product_id)
              .maybeSingle();
            if (product?.name) productLabel = product.name;
            else if (product?.gtin) productLabel = `EAN ${product.gtin}`;
          } catch {}

          const observed = Number(ev.observed_pct ?? 0);
          const sign = observed >= 0 ? "+" : "";
          const metricLabel =
            ev.metric === "gap_vs_best" ? "vs meilleure offre" : "vs prix médian";

          toast("Nouvelle alerte concurrentielle", {
            description: `${productLabel} — écart ${sign}${observed.toFixed(1)}% ${metricLabel}`,
            icon: <Bell className="h-4 w-4 text-amber-500" />,
            duration: 8000,
            action: {
              label: "Voir",
              onClick: () => navigate("/vendor/price-alerts"),
            },
          });

          qc.invalidateQueries({ queryKey: ["vendor-price-alert-events", vendorId] });
          qc.invalidateQueries({ queryKey: ["vendor-price-alert-events-count", vendorId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, qc, navigate]);
}
