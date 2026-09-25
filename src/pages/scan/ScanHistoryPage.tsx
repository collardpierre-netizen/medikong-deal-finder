import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money-format";
import { useScanCustomer } from "./ScanGate";

const sb = supabase as any;
const DOT: Record<string, string> = { green: "verdict-green", orange: "verdict-orange", red: "verdict-red" };

/** « Derniers scans » + « Mes favoris » — écran unique, réutilisable plus tard dans Moi. */
export function ScanHistoryList({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"scans" | "favs">("scans");

  const { data: scans, isLoading: loadingScans } = useQuery({
    queryKey: ["scan-history", customerId],
    queryFn: async () => {
      const { data, error } = await sb.from("scan_events")
        .select("id, scanned_at, verdict, delta_excl_vat, product_id, products(name, cnk_code)")
        .eq("customer_id", customerId).not("product_id", "is", null)
        .order("scanned_at", { ascending: false }).limit(200);
      if (error) throw error;
      // 30 derniers produits distincts (le scan le plus récent par produit)
      const seen = new Set<string>();
      return (data ?? []).filter((e: any) => !seen.has(e.product_id) && seen.add(e.product_id)).slice(0, 30);
    },
  });

  const { data: favs, isLoading: loadingFavs } = useQuery({
    queryKey: ["scan-favorites", customerId],
    enabled: tab === "favs",
    queryFn: async () => {
      const { data, error } = await sb.from("scan_favorites")
        .select("id, created_at, product_id, products(name, cnk_code)")
        .eq("customer_id", customerId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = tab === "scans" ? loadingScans : loadingFavs;
  const rows: any[] = (tab === "scans" ? scans : favs) ?? [];
  const lastScanByProduct = new Map<string, string>((scans ?? []).map((e: any) => [e.product_id, e.id]));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="tablist">
        <Button role="tab" aria-selected={tab === "scans"} variant={tab === "scans" ? "default" : "outline"} className="scan-tap" onClick={() => setTab("scans")}>Derniers scans</Button>
        <Button role="tab" aria-selected={tab === "favs"} variant={tab === "favs" ? "default" : "outline"} className="scan-tap" onClick={() => setTab("favs")}>
          <Star className="mr-1 h-4 w-4" />Mes favoris
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="scan-skeleton h-14 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{tab === "scans" ? "Aucun scan pour l'instant." : "Aucun favori. Touchez l'étoile sur un verdict."}</p>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {rows.map((row: any) => {
            const isScan = tab === "scans";
            const reopen = () => {
              const ev = isScan ? row.id : lastScanByProduct.get(row.product_id);
              if (ev) navigate(`/?reopen=${ev}`);
              else if (row.products?.cnk_code) navigate(`/?cnk=${encodeURIComponent(row.products.cnk_code)}`);
            };
            const gain = isScan && Number(row.delta_excl_vat) > 0 ? Number(row.delta_excl_vat) : null;
            return (
              <button key={row.id} type="button" onClick={reopen} className="scan-tap flex w-full items-center gap-3 px-3 py-3 text-left">
                {isScan
                  ? <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[row.verdict] ?? "bg-muted"}`} aria-label={row.verdict ?? "sans verdict"} />
                  : <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.products?.name ?? "Produit"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(isScan ? row.scanned_at : row.created_at).toLocaleDateString("fr-BE")}
                    {row.products?.cnk_code ? ` · CNK ${row.products.cnk_code}` : ""}
                  </span>
                </span>
                {gain != null && <span className="shrink-0 text-sm font-semibold">{formatMoney(gain)} / boîte</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ScanHistoryPage() {
  const customer = useScanCustomer();
  return (
    <div className="space-y-4">
      <header className="bg-scan-navy text-on-navy px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="icon" className="scan-tap" aria-label="Retour au scanner">
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-xl font-extrabold">Derniers scans</h1>
        </div>
      </header>
      <div className="px-5 pb-6"><ScanHistoryList customerId={customer.id} /></div>
    </div>
  );
}
