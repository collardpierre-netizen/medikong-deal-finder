import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Database, Search, Loader2 } from "lucide-react";
import { useState } from "react";

export default function RestockAdminPriceReferences() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setDebouncedSearch(val.trim()), 350);
    setTimer(t);
  };

  const { data: results = [], isLoading, isFetching } = useQuery({
    queryKey: ["market-prices-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const q = debouncedSearch;
      const isCode = /^\d+$/.test(q);

      let query = supabase
        .from("market_prices")
        .select("id, ean, cnk, product_name_source, prix_grossiste, prix_pharmacien, prix_public, tva_rate, supplier_name, source:market_price_sources(name)")
        .order("product_name_source")
        .limit(100);

      if (isCode && q.length <= 7) {
        query = query.ilike("cnk", `%${q}%`);
      } else if (isCode) {
        query = query.ilike("ean", `%${q}%`);
      } else {
        query = query.ilike("product_name_source", `%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearch.length >= 2,
  });

  const { data: stats } = useQuery({
    queryKey: ["market-prices-stats"],
    queryFn: async () => {
      const { count: total } = await supabase.from("market_prices").select("id", { count: "exact", head: true });
      const { data: sources } = await supabase
        .from("market_price_sources")
        .select("name, total_products")
        .eq("is_active", true)
        .order("total_products", { ascending: false });
      return { total: total || 0, sources: sources || [] };
    },
  });

  const formatPrice = (p: number | null) => {
    if (!p) return "—";
    return `${Number(p).toFixed(2)} €`;
  };

  const getSourceName = (row: any) => {
    if (typeof row.source === "object" && row.source?.name) return row.source.name;
    return row.supplier_name || "—";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Database size={24} className="text-[#1C58D9]" />
        <h1 className="text-2xl font-bold text-[#1E252F]">Référentiel Prix</h1>
      </div>
      <p className="text-sm text-[#5C6470] mb-4">
        Recherchez parmi {stats?.total?.toLocaleString("fr-FR") || "—"} références de prix importées.
      </p>

      {/* Source badges */}
      {stats?.sources && stats.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {stats.sources.map((s: any) => (
            <Badge key={s.name} variant="outline" className="text-xs gap-1 border-[#D0D5DC]">
              {s.name} <span className="text-[#1C58D9] font-semibold">{(s.total_products || 0).toLocaleString("fr-FR")}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
        <Input
          placeholder="Rechercher par EAN, CNK ou nom de produit (min. 2 caractères)…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 border-[#D0D5DC] rounded-lg text-sm"
        />
        {isFetching && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#1C58D9]" />
        )}
      </div>

      {/* Results */}
      {!debouncedSearch || debouncedSearch.length < 2 ? (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-16 text-center shadow-sm">
          <Search size={40} className="mx-auto mb-3 text-[#D0D5DC]" />
          <p className="text-[#5C6470] text-sm">Tapez au moins 2 caractères pour lancer une recherche</p>
          <p className="text-[#8B929C] text-xs mt-1">Exemple : "dafalgan", "5410063", "0031"</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : results.length === 0 ? (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-12 text-center shadow-sm">
          <p className="text-[#5C6470] text-sm">Aucun résultat pour « {debouncedSearch} »</p>
        </div>
      ) : (
        <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-[#F7F8FA] border-b border-[#D0D5DC] flex items-center justify-between">
            <span className="text-xs text-[#5C6470]">{results.length} résultat{results.length > 1 ? "s" : ""} (max 100)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F8FA] text-[#5C6470]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">EAN</th>
                  <th className="text-left px-4 py-3 font-medium">CNK</th>
                  <th className="text-left px-4 py-3 font-medium">Désignation</th>
                  <th className="text-right px-4 py-3 font-medium">Prix grossiste</th>
                  <th className="text-right px-4 py-3 font-medium">Prix pharmacien</th>
                  <th className="text-right px-4 py-3 font-medium">Prix public</th>
                  <th className="text-center px-4 py-3 font-medium">TVA</th>
                  <th className="text-left px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id} className="border-t border-[#D0D5DC]/50 hover:bg-[#F7F8FA]/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#1E252F]">{r.ean || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#5C6470]">{r.cnk || "—"}</td>
                    <td className="px-4 py-2.5 text-[#1E252F] max-w-[300px] truncate">{r.product_name_source || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-[#5C6470]">{formatPrice(r.prix_grossiste)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-[#1C58D9]">{formatPrice(r.prix_pharmacien)}</td>
                    <td className="px-4 py-2.5 text-right text-[#1E252F]">{formatPrice(r.prix_public)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.tva_rate ? <Badge variant="outline" className="text-[10px]">{r.tva_rate}%</Badge> : <span className="text-[#8B929C]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[#8B929C] text-xs">{getSourceName(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}