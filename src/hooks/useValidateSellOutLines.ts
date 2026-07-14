import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SellOutLineInput } from "@/hooks/useVendorSellOut";

export type LineMatchStatus = "matched_gtin" | "matched_cnk" | "unmatched";

export interface ValidatedLine {
  input: SellOutLineInput;
  index: number;
  product_id: string | null;
  status: LineMatchStatus;
  warnings: string[];
}

export interface ValidationResult {
  lines: ValidatedLine[];
  summary: {
    total: number;
    matched: number;
    matchedGtin: number;
    matchedCnk: number;
    unmatched: number;
    warnings: number;
    totalUnits: number;
    totalNetCents: number;
    totalGrossCents: number;
  };
}

export function useValidateSellOutLines(lines: SellOutLineInput[] | null) {
  return useQuery({
    queryKey: [
      "validate-sell-out",
      lines?.length ?? 0,
      lines?.map((l) => `${l.gtin ?? ""}|${l.cnk_code ?? ""}`).join(",") ?? "",
    ],
    enabled: !!lines && lines.length > 0,
    queryFn: async (): Promise<ValidationResult> => {
      const src = lines ?? [];
      const gtins = Array.from(new Set(src.map((l) => l.gtin).filter(Boolean))) as string[];
      const cnks = Array.from(new Set(src.map((l) => l.cnk_code).filter(Boolean))) as string[];

      const gtinMap = new Map<string, string>();
      if (gtins.length) {
        const { data } = await supabase.from("products").select("id, gtin").in("gtin", gtins);
        (data ?? []).forEach((p: any) => {
          if (p.gtin) gtinMap.set(String(p.gtin), p.id);
        });
      }

      const cnkMap = new Map<string, string>();
      if (cnks.length) {
        const { data } = await supabase
          .from("product_market_codes")
          .select("code_value, product_id, market_code_types!inner(code)")
          .eq("market_code_types.code", "CNK")
          .in("code_value", cnks);
        (data ?? []).forEach((r: any) => {
          if (r.code_value && r.product_id) cnkMap.set(String(r.code_value), r.product_id);
        });
      }

      let matchedGtin = 0;
      let matchedCnk = 0;
      let unmatched = 0;
      let warnings = 0;
      let totalUnits = 0;
      let totalNet = 0;
      let totalGross = 0;

      const validated: ValidatedLine[] = src.map((input, index) => {
        const ws: string[] = [];
        let product_id: string | null = null;
        let status: LineMatchStatus = "unmatched";
        if (input.gtin && gtinMap.has(input.gtin)) {
          product_id = gtinMap.get(input.gtin)!;
          status = "matched_gtin";
          matchedGtin++;
        } else if (input.cnk_code && cnkMap.has(input.cnk_code)) {
          product_id = cnkMap.get(input.cnk_code)!;
          status = "matched_cnk";
          matchedCnk++;
        } else {
          unmatched++;
          ws.push(input.gtin ? "GTIN inconnu au catalogue" : "CNK inconnu au catalogue");
        }
        if (input.units <= 0) ws.push("Unités = 0");
        if (input.net_revenue_cents <= 0 && input.gross_revenue_cents <= 0) ws.push("CA nul");
        if (
          input.gross_revenue_cents > 0 &&
          input.net_revenue_cents > 0 &&
          input.net_revenue_cents > input.gross_revenue_cents
        )
          ws.push("CA net > CA brut");
        if (ws.length) warnings++;

        totalUnits += input.units || 0;
        totalNet += input.net_revenue_cents || 0;
        totalGross += input.gross_revenue_cents || 0;

        return { input, index, product_id, status, warnings: ws };
      });

      return {
        lines: validated,
        summary: {
          total: src.length,
          matched: matchedGtin + matchedCnk,
          matchedGtin,
          matchedCnk,
          unmatched,
          warnings,
          totalUnits,
          totalNetCents: totalNet,
          totalGrossCents: totalGross,
        },
      };
    },
  });
}
