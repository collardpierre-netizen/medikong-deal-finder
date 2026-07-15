import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SellOutReport {
  id: string;
  vendor_id: string;
  customer_id: string | null;
  customer_label: string | null;
  period_start: string;
  period_end: string;
  currency_code: string;
  source: string;
  file_name: string | null;
  notes: string | null;
  created_at: string;
}

export function useVendorSellOutReports() {
  return useQuery({
    queryKey: ["vendor-sell-out-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_sell_out_reports")
        .select("*")
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SellOutReport[];
    },
  });
}

export interface SellOutLineInput {
  product_id?: string | null;
  gtin?: string | null;
  cnk_code?: string | null;
  raw_label?: string | null;
  units: number;
  gross_revenue_cents: number;
  net_revenue_cents: number;
}

export interface CreateReportInput {
  vendor_id: string;
  customer_id?: string | null;
  customer_label?: string | null;
  pharmacy_id?: string | null;
  period_start: string;
  period_end: string;
  currency_code?: string;
  source?: string;
  file_name?: string | null;
  notes?: string | null;
  lines: SellOutLineInput[];
}

export function useCreateSellOutReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateReportInput) => {
      const { lines, ...report } = input;
      const { data: r, error } = await supabase
        .from("vendor_sell_out_reports")
        .insert(report as any)
        .select("id")
        .single();
      if (error) throw error;
      if (lines.length) {
        const rows = lines.map((l) => ({ ...l, report_id: r.id }));
        const { error: err2 } = await supabase.from("vendor_sell_out_lines").insert(rows as any);
        if (err2) throw err2;
      }
      return r.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-sell-out-reports"] }),
  });
}

export function useDeleteSellOutReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_sell_out_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-sell-out-reports"] }),
  });
}

export interface SellInVsSellOutRow {
  product_id: string | null;
  product_name: string | null;
  gtin: string | null;
  cnk_code: string | null;
  sell_in_units: number;
  sell_in_ca_htva_cents: number;
  sell_out_units: number;
  sell_out_net_cents: number;
  delta_units: number;
  sell_through_pct: number | null;
}

export function useSellInVsSellOut(reportId: string | null) {
  return useQuery({
    queryKey: ["vendor-sell-in-vs-out", reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("vendor_sell_in_vs_sell_out", { _report_id: reportId });
      if (error) throw error;
      return (data ?? []) as SellInVsSellOutRow[];
    },
  });
}
