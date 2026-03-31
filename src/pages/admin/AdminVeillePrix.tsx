import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, TrendingDown, TrendingUp, Download, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";

type SortKey = "ecart" | "name" | "qogita" | "febelco" | "cerp";
type SortDir = "asc" | "desc";

export default function AdminVeillePrix() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ecartMinFilter, setEcartMinFilter] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ecart");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Fetch matched market prices with product info
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["veille-prix-data"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_prices")
        .select("id, product_id, prix_grossiste, prix_pharmacien, prix_public, tva_rate, source_id, market_price_sources(name, slug)")
        .eq("is_matched", true)
        .not("product_id", "is", null);
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch products for matched IDs
  const productIds = useMemo(() => [...new Set(rawData.map((r: any) => r.product_id).filter(Boolean))], [rawData]);

  const { data: products = [] } = useQuery({
    queryKey: ["veille-prix-products", productIds.length],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      // Batch in groups of 100
      const all: any[] = [];
      for (let i = 0; i < productIds.length; i += 100) {
        const batch = productIds.slice(i, i + 100);
        const { data } = await supabase
          .from("products")
          .select("id, name, gtin, brand_name, category_name, best_price_excl_vat")
          .in("id", batch);
        if (data) all.push(...data);
      }
      return all;
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
  });

  // Build comparison rows
  const rows = useMemo(() => {
    const productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));
    const grouped: Record<string, { product: any; febelco: any; cerp: any }> = {};

    for (const mp of rawData) {
      const pid = mp.product_id;
      if (!pid || !productMap[pid]) continue;
      if (!grouped[pid]) grouped[pid] = { product: productMap[pid], febelco: null, cerp: null };
      const slug = (mp as any).market_price_sources?.slug;
      if (slug === "febelco") grouped[pid].febelco = mp;
      else if (slug === "cerp") grouped[pid].cerp = mp;
    }

    return Object.values(grouped).map((row) => {
      const qogitaPrice = row.product.best_price_excl_vat || 0;
      const febelcoPrice = row.febelco?.prix_grossiste || null;
      const cerpPrice = row.cerp?.prix_pharmacien || null;
      const refPrice = febelcoPrice || cerpPrice;
      const ecart = refPrice && qogitaPrice > 0 ? ((refPrice - qogitaPrice) / refPrice) * 100 : null;

      return {
        ...row,
        qogitaPrice,
        febelcoPrice,
        cerpPrice,
        ecart,
      };
    });
  }, [rawData, products]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(({ product }) =>
        product.name?.toLowerCase().includes(q) || product.gtin?.includes(q) || product.brand_name?.toLowerCase().includes(q)
      );
    }
    if (brandFilter !== "all") r = r.filter(({ product }) => product.brand_name === brandFilter);
    if (categoryFilter !== "all") r = r.filter(({ product }) => product.category_name === categoryFilter);
    if (ecartMinFilter !== null) r = r.filter(({ ecart }) => ecart !== null && Math.abs(ecart) >= ecartMinFilter);

    r.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortKey) {
        case "ecart": aVal = a.ecart ?? -999; bVal = b.ecart ?? -999; break;
        case "name": return sortDir === "asc" ? (a.product.name || "").localeCompare(b.product.name || "") : (b.product.name || "").localeCompare(a.product.name || "");
        case "qogita": aVal = a.qogitaPrice; bVal = b.qogitaPrice; break;
        case "febelco": aVal = a.febelcoPrice ?? 0; bVal = b.febelcoPrice ?? 0; break;
        case "cerp": aVal = a.cerpPrice ?? 0; bVal = b.cerpPrice ?? 0; break;
        default: aVal = 0; bVal = 0;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return r;
  }, [rows, search, brandFilter, categoryFilter, ecartMinFilter, sortKey, sortDir]);

  // Unique brands/categories for filters
  const brands = useMemo(() => [...new Set(rows.map(r => r.product.brand_name).filter(Boolean))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.map(r => r.product.category_name).filter(Boolean))].sort(), [rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleExport = () => {
    const exportData = filteredRows.map(r => ({
      Produit: r.product.name,
      GTIN: r.product.gtin,
      Marque: r.product.brand_name,
      "Prix Qogita (HTVA)": r.qogitaPrice?.toFixed(2),
      "Febelco Grossiste": r.febelcoPrice?.toFixed(2) || "",
      "CERP Pharmacien": r.cerpPrice?.toFixed(2) || "",
      "Écart %": r.ecart?.toFixed(1) || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), "Veille prix");
    XLSX.writeFile(wb, `veille-prix-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const formatPrice = (n: number | null) => n != null ? `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—";

  const SortIcon = ({ k }: { k: SortKey }) => (
    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-0.5 hover:text-foreground">
      <ArrowUpDown size={12} className={sortKey === k ? "text-primary" : ""} />
    </button>
  );

  return (
    <div>
      <AdminTopBar title="Veille prix" subtitle={`${filteredRows.length} produits comparés`} />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-background border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Produits matchés</p>
          <p className="text-2xl font-bold text-foreground">{rows.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Avec prix Febelco</p>
          <p className="text-2xl font-bold text-foreground">{rows.filter(r => r.febelcoPrice).length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Avec prix CERP</p>
          <p className="text-2xl font-bold text-foreground">{rows.filter(r => r.cerpPrice).length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Écart moyen</p>
          <p className="text-2xl font-bold text-foreground">
            {rows.filter(r => r.ecart !== null).length > 0
              ? (rows.filter(r => r.ecart !== null).reduce((s, r) => s + (r.ecart || 0), 0) / rows.filter(r => r.ecart !== null).length).toFixed(1) + " %"
              : "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, GTIN, marque..." className="pl-9 h-9 text-sm" />
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Marque" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les marques</SelectItem>
            {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ecartMinFilter?.toString() || "all"} onValueChange={v => setEcartMinFilter(v === "all" ? null : Number(v))}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Écart min" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout écart</SelectItem>
            <SelectItem value="5">≥ 5%</SelectItem>
            <SelectItem value="10">≥ 10%</SelectItem>
            <SelectItem value="20">≥ 20%</SelectItem>
            <SelectItem value="30">≥ 30%</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
          <Download size={14} /> Export XLSX
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px]">Produit <SortIcon k="name" /></TableHead>
                <TableHead className="text-[11px]">GTIN</TableHead>
                <TableHead className="text-[11px] text-right">Prix Qogita <SortIcon k="qogita" /></TableHead>
                <TableHead className="text-[11px] text-right">Febelco (gros) <SortIcon k="febelco" /></TableHead>
                <TableHead className="text-[11px] text-right">CERP (pharma) <SortIcon k="cerp" /></TableHead>
                <TableHead className="text-[11px] text-right">Écart % <SortIcon k="ecart" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.slice(0, 200).map((row) => (
                <TableRow key={row.product.id}>
                  <TableCell>
                    <p className="text-[13px] font-medium text-foreground truncate max-w-[300px]">{row.product.name}</p>
                    <p className="text-[11px] text-muted-foreground">{row.product.brand_name}</p>
                  </TableCell>
                  <TableCell className="text-[12px] font-mono text-muted-foreground">{row.product.gtin}</TableCell>
                  <TableCell className="text-right text-[13px] font-medium">{formatPrice(row.qogitaPrice)}</TableCell>
                  <TableCell className="text-right text-[13px]">{formatPrice(row.febelcoPrice)}</TableCell>
                  <TableCell className="text-right text-[13px]">{formatPrice(row.cerpPrice)}</TableCell>
                  <TableCell className="text-right">
                    {row.ecart !== null ? (
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-bold ${row.ecart > 0 ? "text-green-700 border-green-300 bg-green-50" : row.ecart < -5 ? "text-red-700 border-red-300 bg-red-50" : "text-muted-foreground"}`}
                      >
                        {row.ecart > 0 ? <TrendingDown size={12} className="mr-0.5" /> : <TrendingUp size={12} className="mr-0.5" />}
                        {row.ecart > 0 ? "-" : "+"}{Math.abs(row.ecart).toFixed(1)}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRows.length > 200 && (
            <p className="text-xs text-center text-muted-foreground py-3">Affichage limité à 200 lignes. Utilisez les filtres ou exportez le fichier complet.</p>
          )}
        </div>
      )}
    </div>
  );
}
