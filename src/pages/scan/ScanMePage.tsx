import { useQuery } from "@tanstack/react-query";
import { Loader2, ScanLine, TrendingDown, Euro, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useScanCustomer } from "./ScanGate";

interface ScanRow {
  product_id: string | null;
  verdict: string | null;
  delta_excl_vat: number | null;
  best_price_excl_vat: number | null;
}

const eur = (v: number) => v.toFixed(2).replace(".", ",") + " €";

/** Onglet « Moi » : activité de scan de l'officine (nombre de scans, gain moyen, prix moyen par produit). */
export default function ScanMePage() {
  const customer = useScanCustomer();
  const { data, isLoading } = useQuery({
    queryKey: ["scan-me-stats", customer.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("scan_events")
        .select("product_id, verdict, delta_excl_vat, best_price_excl_vat")
        .eq("customer_id", customer.id)
        .order("scanned_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ScanRow[];
    },
  });

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const rows = data ?? [];
  const totalScans = rows.length;

  // Gain moyen : moyenne des économies (prix de référence − prix MediKong) sur les scans où MediKong est moins cher.
  const gains = rows.filter((r) => (r.delta_excl_vat ?? 0) > 0).map((r) => Number(r.delta_excl_vat));
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;

  // Prix moyen par produit : moyenne des prix MediKong proposés par produit scanné.
  const byProduct = new Map<string, { prices: number[]; scans: number }>();
  for (const r of rows) {
    if (!r.product_id) continue;
    const entry = byProduct.get(r.product_id) ?? { prices: [], scans: 0 };
    entry.scans += 1;
    if (r.best_price_excl_vat != null) entry.prices.push(Number(r.best_price_excl_vat));
    byProduct.set(r.product_id, entry);
  }
  const allPrices = rows.filter((r) => r.best_price_excl_vat != null).map((r) => Number(r.best_price_excl_vat));
  const avgPrice = allPrices.length ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : null;
  const products = [...byProduct.entries()]
    .map(([id, v]) => ({ id, scans: v.scans, avg: v.prices.length ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : null }))
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 20);

  return (
    <div className="space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold">Moi</h1>
        <p className="text-sm text-muted-foreground">{customer.company_name ?? "Votre officine"}</p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center">
          <ScanLine className="mx-auto h-5 w-5 text-scan-emerald" />
          <p className="mt-1 text-xl font-extrabold">{totalScans}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">scans</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <TrendingDown className="mx-auto h-5 w-5 text-scan-emerald" />
          <p className="mt-1 text-xl font-extrabold">{avgGain != null ? eur(avgGain) : "—"}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">gain moyen</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <Euro className="mx-auto h-5 w-5 text-scan-emerald" />
          <p className="mt-1 text-xl font-extrabold">{avgPrice != null ? eur(avgPrice) : "—"}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">prix moyen</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Prix moyen par produit</h2>
        {products.length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-6 w-6" />
            Aucun produit scanné pour le moment.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">{p.scans} scan{p.scans > 1 ? "s" : ""}</span>
                <span className="text-sm font-semibold">{p.avg != null ? eur(p.avg) : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
