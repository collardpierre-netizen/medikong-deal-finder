import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SellOutLineInput } from "@/hooks/useVendorSellOut";

export interface ManualSellInReport {
  id: string;
  vendor_id: string;
  pharmacy_id: string | null;
  customer_label: string | null;
  period_start: string;
  period_end: string;
  currency_code: string;
  source: string;
  file_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface ManualSellInReportWithPharmacy extends ManualSellInReport {
  pharmacy?: { id: string; name: string; apb_number: string; city: string | null } | null;
  line_count?: number;
}

export function useVendorManualSellInReports() {
  return useQuery({
    queryKey: ["vendor-manual-sell-in-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_manual_sell_in_reports")
        .select(
          "*, pharmacy:be_pharmacies(id, name, apb_number, city), lines:vendor_manual_sell_in_lines(count)",
        )
        .order("period_start", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        line_count: r.lines?.[0]?.count ?? 0,
      })) as ManualSellInReportWithPharmacy[];
    },
  });
}

export interface ManualSellInLine {
  id: string;
  product_id: string | null;
  gtin: string | null;
  cnk_code: string | null;
  raw_label: string | null;
  units: number;
  gross_revenue_cents: number;
  net_revenue_cents: number;
}

export function useManualSellInLines(reportId: string | null) {
  return useQuery({
    queryKey: ["vendor-manual-sell-in-lines", reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendor_manual_sell_in_lines")
        .select(
          "id, product_id, gtin, cnk_code, raw_label, units, gross_revenue_cents, net_revenue_cents, product:products(id, name)",
        )
        .eq("report_id", reportId);
      if (error) throw error;
      return (data ?? []) as (ManualSellInLine & {
        product?: { id: string; name: string } | null;
      })[];
    },
  });
}

export interface CreateManualSellInInput {
  vendor_id: string;
  pharmacy_id?: string | null;
  customer_label?: string | null;
  period_start: string;
  period_end: string;
  currency_code?: string;
  source?: string;
  file_name?: string | null;
  notes?: string | null;
  lines: SellOutLineInput[];
}

export function useCreateManualSellInReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManualSellInInput) => {
      const { lines, ...report } = input;
      const { data: r, error } = await (supabase as any)
        .from("vendor_manual_sell_in_reports")
        .insert(report)
        .select("id")
        .single();
      if (error) throw error;
      if (lines.length) {
        const rows = lines.map((l) => ({ ...l, report_id: r.id }));
        const { error: err2 } = await (supabase as any)
          .from("vendor_manual_sell_in_lines")
          .insert(rows);
        if (err2) throw err2;
      }
      return r.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-manual-sell-in-reports"] }),
  });
}

export function useDeleteManualSellInReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("vendor_manual_sell_in_reports")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-manual-sell-in-reports"] }),
  });
}
