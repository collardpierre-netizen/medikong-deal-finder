import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { Trophy, TrendingDown, Target, Search, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface PositionRow {
  product_id: string;
  product_name: string;
  product_image: string | null;
  gtin: string | null;
  cnk_code: string | null;
  brand_name: string | null;
  country_code: string;
  my_offer_id: string;
  my_price_excl_vat: number;
  my_stock: number;
  competitors_count: number;
  total_offers: number;
  my_rank: number;
  best_price_excl_vat: number;
  best_vendor_id: string | null;
  suggested_price_excl_vat: number;
  gap_amount: number;
  gap_percentage: number;
}

const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? `${n.toFixed(2)} €` : "—";

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1) {
    return (
      <VBadge color="#16A34A" bg="#DCFCE7">
        <Trophy size={11} className="inline -mt-0.5 mr-1" />
        #1 / {total}
      </VBadge>
    );
  }
  if (rank === 2) {
    return <VBadge color="#CA8A04" bg="#FEF3C7">#{rank} / {total}</VBadge>;
  }
  return <VBadge color="#DC2626" bg="#FEE2E2">#{rank} / {total}</VBadge>;
}

export default function VendorPositioning() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = (vendor as any)?.id;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "losing" | "winning">("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendor-positioning", vendorId],
    queryFn: async (): Promise<PositionRow[]> => {
      if (!vendorId) return [];
      const { data, error } = await supabase.rpc("get_vendor_competitive_position", {
        _vendor_id: vendorId,
      });
      if (error) throw error;
      return (data as PositionRow[]) || [];
    },
    enabled: !!vendorId,
  });

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(
        (x) =>
          x.product_name?.toLowerCase().includes(s) ||
          x.gtin?.toLowerCase().includes(s) ||
          x.cnk_code?.toLowerCase().includes(s) ||
          x.brand_name?.toLowerCase().includes(s)
      );
    }
    if (filter === "losing") r = r.filter((x) => x.my_rank > 1);
    if (filter === "winning") r = r.filter((x) => x.my_rank === 1);
    return r;
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const winning = rows.filter((r) => r.my_rank === 1).length;
    const losing = total - winning;
    const avgGapPct =
      losing > 0
        ? rows.filter((r) => r.my_rank > 1).reduce((s, r) => s + r.gap_percentage, 0) / losing
        : 0;
    return { total, winning, losing, avgGapPct };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Positionnement concurrentiel</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">
          Comparez vos prix aux autres vendeurs MediKong sur les EAN partagés. Baissez votre prix pour passer #1 et apparaître en tête des résultats.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <VCard>
          <div className="text-[12px] text-[#616B7C]">EAN en concurrence</div>
          <div className="text-2xl font-bold text-[#1D2530] mt-1">{stats.total}</div>
        </VCard>
        <VCard>
          <div className="text-[12px] text-[#616B7C] flex items-center gap-1">
            <Trophy size={12} className="text-emerald-600" /> Vous êtes #1
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.winning}</div>
        </VCard>
        <VCard>
          <div className="text-[12px] text-[#616B7C] flex items-center gap-1">
            <TrendingDown size={12} className="text-red-600" /> Distancé(s)
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.losing}</div>
        </VCard>
        <VCard>
          <div className="text-[12px] text-[#616B7C]">Écart moyen vs #1</div>
          <div className="text-2xl font-bold text-[#1D2530] mt-1">
            {stats.losing > 0 ? `+${stats.avgGapPct.toFixed(1)}%` : "—"}
          </div>
        </VCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input
            placeholder="Rechercher produit, EAN, CNK, marque…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[200px] h-9 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous ({rows.length})</SelectItem>
            <SelectItem value="losing">À optimiser ({stats.losing})</SelectItem>
            <SelectItem value="winning">Position #1 ({stats.winning})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <VCard className="overflow-hidden p-0">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-[#8B95A5]">
            <Loader2 size={20} className="animate-spin mr-2" /> Analyse de la concurrence…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
            <h3 className="text-[15px] font-bold text-[#1D2530] mb-1">
              {rows.length === 0
                ? "Aucun EAN partagé avec d'autres vendeurs"
                : "Aucun résultat avec ces filtres"}
            </h3>
            <p className="text-[13px] text-[#8B95A5] max-w-md">
              {rows.length === 0
                ? "Vos offres actuelles n'ont pas encore de concurrents directs sur la plateforme."
                : "Modifiez la recherche ou changez le filtre pour voir vos positions."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F7F8FA] text-[#5C6470] text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Produit</th>
                  <th className="text-center px-3 py-3 font-semibold">Pays</th>
                  <th className="text-center px-3 py-3 font-semibold">Rang</th>
                  <th className="text-right px-3 py-3 font-semibold">Mon prix HTVA</th>
                  <th className="text-right px-3 py-3 font-semibold">Meilleur prix</th>
                  <th className="text-right px-3 py-3 font-semibold">Écart</th>
                  <th className="text-right px-3 py-3 font-semibold">Prix cible #1</th>
                  <th className="text-center px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isWinning = r.my_rank === 1;
                  return (
                    <tr key={r.my_offer_id} className="border-t border-[#E5E7EB] hover:bg-[#F7F8FA]/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {r.product_image ? (
                            <img
                              src={r.product_image}
                              alt=""
                              className="w-10 h-10 rounded object-contain bg-white border border-[#E5E7EB]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-[#F1F5F9]" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-[#1D2530] truncate max-w-[280px]">
                              {r.product_name}
                            </div>
                            <div className="text-[11px] text-[#8B95A5] flex gap-2">
                              {r.brand_name && <span>{r.brand_name}</span>}
                              {r.gtin && <span className="font-mono">EAN {r.gtin}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-[#5C6470] font-mono text-[11px]">
                        {r.country_code}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <RankBadge rank={r.my_rank} total={r.total_offers} />
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-[#1D2530]">
                        {fmt(r.my_price_excl_vat)}
                      </td>
                      <td className="px-3 py-3 text-right text-emerald-700 font-semibold">
                        {fmt(r.best_price_excl_vat)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isWinning ? (
                          <span className="text-emerald-600 text-[12px]">—</span>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-red-600 font-semibold">
                              +{r.gap_amount.toFixed(2)} €
                            </span>
                            <span className="text-[11px] text-red-500">+{r.gap_percentage}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isWinning ? (
                          <VBadge color="#16A34A" bg="#DCFCE7">
                            <Trophy size={10} className="inline -mt-0.5 mr-1" /> Vous êtes #1
                          </VBadge>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-[#1B5BDA] flex items-center gap-1">
                              <Target size={12} /> {fmt(r.suggested_price_excl_vat)}
                            </span>
                            <span className="text-[10px] text-[#8B95A5]">
                              -1% sous le #1
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isWinning ? (
                          <span className="text-[11px] text-[#8B95A5]">Maintenez</span>
                        ) : (
                          <a href={`/vendor/offers?focus=${r.my_offer_id}`}>
                            <VBtn small primary>
                              Ajuster
                            </VBtn>
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </VCard>

      {rows.length > 0 && stats.losing > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Astuce :</strong> Le prix cible suggéré est calculé à 1% sous le meilleur concurrent.
            Les acheteurs voient les vendeurs triés par prix croissant — passer #1 maximise votre visibilité et vos chances de conversion.
          </div>
        </div>
      )}
    </div>
  );
}
