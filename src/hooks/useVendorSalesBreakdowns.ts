import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CUSTOMER_TYPE_OPTIONS } from "@/pages/admin/AdminCustomers";

const CATEGORY_COLORS = [
  "#1B5BDA", "#7C3AED", "#059669", "#F59E0B", "#EF4444",
  "#0EA5E9", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316",
];

const toAmount = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.trim().replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const getLineTotalInclVat = (l: any) => {
  const explicitIncl = toAmount(l?.line_total_incl_vat);
  if (explicitIncl > 0) return explicitIncl;
  const qty = toAmount(l?.quantity);
  const unitIncl = toAmount(l?.unit_price_incl_vat);
  if (qty > 0 && unitIncl > 0) return qty * unitIncl;
  const explicitExcl = toAmount(l?.line_total_excl_vat);
  const unitExcl = toAmount(l?.unit_price_excl_vat);
  const vatRate = toAmount(l?.vat_rate);
  const exclTotal = explicitExcl > 0 ? explicitExcl : qty * unitExcl;
  return exclTotal > 0 ? exclTotal * (1 + vatRate / 100) : 0;
};

const isActiveOrForecast = (o: any) =>
  o && !o.hidden_from_list && !o.deleted_at &&
  (Boolean(o.is_forecast) || ["pending", "confirmed", "processing", "shipped"].includes(o.status));

export function useVendorSalesBreakdowns(vendorId: string | undefined) {
  const linesQuery = useQuery({
    queryKey: ["vendor-sales-breakdowns", vendorId],
    enabled: !!vendorId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(`
          quantity, unit_price_incl_vat, unit_price_excl_vat, vat_rate,
          line_total_incl_vat, line_total_excl_vat,
          products:product_id ( primary_category_id ),
          orders:order_id ( id, status, is_forecast, hidden_from_list, deleted_at,
                            customers:customer_id ( customer_type ) )
        `)
        .eq("vendor_id", vendorId!);
      if (error) throw error;
      return data || [];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["vendor-sales-categories-tree"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, parent_id");
      if (error) throw error;
      return data || [];
    },
  });

  const rootCategoryById = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; parent_id: string | null }>();
    for (const c of (categoriesQuery.data || []) as any[]) {
      byId.set(c.id, { id: c.id, name: c.name_fr || c.name || "—", parent_id: c.parent_id });
    }
    const rootOf = new Map<string, { id: string; name: string }>();
    for (const [id] of byId) {
      let cur = byId.get(id);
      const seen = new Set<string>();
      while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parent_id)!;
      }
      if (cur) rootOf.set(id, { id: cur.id, name: cur.name });
    }
    return rootOf;
  }, [categoriesQuery.data]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number }>();
    for (const l of (linesQuery.data || []) as any[]) {
      if (!isActiveOrForecast(l.orders)) continue;
      const pcid = l.products?.primary_category_id;
      if (!pcid) continue;
      const root = rootCategoryById.get(pcid);
      if (!root) continue;
      const amt = getLineTotalInclVat(l);
      const cur = totals.get(root.id) || { name: root.name, amount: 0 };
      cur.amount += amt;
      totals.set(root.id, cur);
    }
    return Array.from(totals.entries())
      .map(([id, v], i) => ({
        id,
        name: v.name,
        value: Math.round(v.amount * 100) / 100,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [linesQuery.data, rootCategoryById]);

  const customerTypeBreakdown = useMemo(() => {
    // Distinct customers per type (via orders linked to this vendor's lines)
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    for (const l of (linesQuery.data || []) as any[]) {
      const o = l.orders;
      if (!o || o.hidden_from_list || o.deleted_at) continue;
      const oid = o.id;
      if (!oid || seen.has(oid)) continue;
      seen.add(oid);
      const t = o.customers?.customer_type || "other";
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    // Note: comptage par commande (unique par order_id) — plus représentatif du mix ventes.
    return CUSTOMER_TYPE_OPTIONS
      .map((opt) => ({ name: opt.label, value: counts.get(opt.value) || 0, color: opt.color }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [linesQuery.data]);

  return {
    isLoading: linesQuery.isLoading || categoriesQuery.isLoading,
    error: linesQuery.error || categoriesQuery.error,
    categoryBreakdown,
    customerTypeBreakdown,
  };
}
