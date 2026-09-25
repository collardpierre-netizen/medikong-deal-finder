import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface ScanCustomer { id: string; company_name: string | null; is_test: boolean | null; }

/** Officine de l'utilisateur (propriétaire ou membre) + les deux interrupteurs Scan. */
export async function fetchScanAccess(userId: string): Promise<{ customer: ScanCustomer | null; allowed: boolean }> {
  const cols = "id, company_name, is_test, scan_enabled";
  let { data: own } = await sb.from("customers").select(cols).eq("auth_user_id", userId).limit(1);
  let customer = own?.[0] ?? null;
  if (!customer) {
    const { data: mem } = await sb.from("account_memberships").select("account_id")
      .eq("user_id", userId).eq("account_kind", "buyer").eq("status", "active").limit(1);
    if (mem?.[0]) {
      const { data } = await sb.from("customers").select(cols).eq("id", mem[0].account_id).maybeSingle();
      customer = data;
    }
  }
  const { data: cfg } = await sb.from("site_config").select("scan_enabled").eq("id", 1).maybeSingle();
  const allowed = !!customer?.scan_enabled && !!cfg?.scan_enabled;
  return { customer: allowed ? customer : null, allowed };
}

export interface ScanResult {
  scan_event_id: string;
  match_status: string;
  product: { id: string; name: string; pack: number | null; cnk: string | null; image: string | null } | null;
  scanned_packaging?: { packaging_level: "unit" | "pack" | "carton"; units_per_pack: number } | null;
  lot: string | null;
  expiry_date: string | null;
  verdict: "green" | "orange" | "red" | "none";
  delta: number | null;
  best: { price: number; vendor_label: string | null; vendor_id?: string; franco: number | null; lead_time_days: number | null; offer_id: string; stock_quantity?: number | null } | null;
  references: { source: string; label: string; discount_pct: number; net: number }[];
  best_reference_price: number | null;
  in_test_scope: boolean;
  latency_ms: number;
  error?: string;
}

export async function resolveScan(input: {
  raw_code: string; symbology: "ean13" | "datamatrix" | "manual_cnk" | "other"; client_decode_ms?: number | null;
}): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke("scan-resolve", {
    body: { ...input, mode: "single" },
  });
  if (error) throw error;
  return data as ScanResult;
}
