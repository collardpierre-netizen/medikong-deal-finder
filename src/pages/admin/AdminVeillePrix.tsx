import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, TrendingDown, TrendingUp, Download, ArrowUpDown, Upload, Plus, Loader2, Trash2, ExternalLink, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type SortKey = "ecart" | "name" | "qogita" | string;
type SortDir = "asc" | "desc";
type PriceType = "grossiste" | "pharmacien" | "public";

interface MarketSource {
  id: string;
  name: string;
  slug: string;
  country_code: string | null;
  source_type: string;
  total_products: number | null;
  is_active: boolean | null;
}

export default function AdminVeillePrix() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ecartMinFilter, setEcartMinFilter] = useState<number | null>(null);
  const [priceType, setPriceType] = useState<PriceType>("grossiste");
  const [sortKey, setSortKey] = useState<SortKey>("ecart");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const perPage = 100;

  // Source management
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceCountry, setNewSourceCountry] = useState("BE");
  const [newSourceType, setNewSourceType] = useState("wholesaler");

  // Import
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importSourceId, setImportSourceId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{ total: number; matched: number; inserted: number } | null>(null);
  const [importProgress, setImportProgress] = useState<{ phase: string; current: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<{ matched: number; total: number } | null>(null);

  // Fetch sources
  const { data: sources = [] } = useQuery({
    queryKey: ["market-sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("market_price_sources").select("*").order("name");
      if (error) throw error;
      return (data || []) as MarketSource[];
    },
    staleTime: 60_000,
  });

  // Fetch unmatched count
  const { data: unmatchedCount = 0 } = useQuery({
    queryKey: ["market-prices-unmatched-count"],
    queryFn: async () => {
      const { count } = await supabase.from("market_prices").select("id", { count: "exact", head: true }).eq("is_matched", false);
      return count || 0;
    },
    staleTime: 60_000,
  });

  // Re-matcher: attempt to match unmatched lines against current products
  const handleRematch = useCallback(async () => {
    setRematching(true);
    setRematchResult(null);
    try {
      // Fetch all products for matching
      const allProducts: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("products").select("id, gtin, cnk_code").range(from, from + 999);
        if (!data || data.length === 0) break;
        allProducts.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      // Fetch market codes
      const allMarketCodes: any[] = [];
      from = 0;
      while (true) {
        const { data } = await supabase.from("product_market_codes").select("product_id, code_value").range(from, from + 999);
        if (!data || data.length === 0) break;
        allMarketCodes.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      const gtinMap = new Map<string, string>();
      const cnkMap = new Map<string, string>();
      const codeMap = new Map<string, string>();
      for (const p of allProducts) {
        if (p.gtin) gtinMap.set(p.gtin.replace(/^0+/, ""), p.id);
        if (p.cnk_code) cnkMap.set(p.cnk_code.replace(/^0+/, ""), p.id);
      }
      for (const mc of allMarketCodes) {
        if (mc.code_value) codeMap.set(mc.code_value.replace(/^0+/, ""), mc.product_id);
      }

      // Fetch unmatched lines in batches
      const unmatched: any[] = [];
      from = 0;
      while (true) {
        const { data } = await supabase.from("market_prices").select("id, ean, cnk").eq("is_matched", false).range(from, from + 999);
        if (!data || data.length === 0) break;
        unmatched.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      let matchedCount = 0;
      const updates: { id: string; product_id: string }[] = [];

      for (const row of unmatched) {
        const ean = row.ean ? String(row.ean).trim().replace(/^0+/, "") : "";
        const cnk = row.cnk ? String(row.cnk).trim().replace(/^0+/, "") : "";
        let pid: string | null = null;
        if (ean && gtinMap.has(ean)) pid = gtinMap.get(ean)!;
        if (!pid && cnk && cnkMap.has(cnk)) pid = cnkMap.get(cnk)!;
        if (!pid && cnk && codeMap.has(cnk)) pid = codeMap.get(cnk)!;
        if (!pid && ean && codeMap.has(ean)) pid = codeMap.get(ean)!;
        if (pid) { updates.push({ id: row.id, product_id: pid }); matchedCount++; }
      }

      // Batch update
      for (let i = 0; i < updates.length; i += 100) {
        const batch = updates.slice(i, i + 100);
        for (const u of batch) {
          await supabase.from("market_prices").update({ product_id: u.product_id, is_matched: true }).eq("id", u.id);
        }
      }

      setRematchResult({ matched: matchedCount, total: unmatched.length });
      if (matchedCount > 0) {
        toast.success(`${matchedCount} nouvelles lignes matchées sur ${unmatched.length}`);
        qc.invalidateQueries({ queryKey: ["veille-prix-data"] });
        qc.invalidateQueries({ queryKey: ["market-prices-unmatched-count"] });
      } else {
        toast.info(`Aucune nouvelle correspondance trouvée (${unmatched.length} lignes analysées)`);
      }
    } catch (e: any) {
      toast.error("Erreur re-matching: " + (e.message || e));
    } finally {
      setRematching(false);
    }
  }, [qc]);

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["veille-prix-data"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("market_prices")
          .select("id, product_id, prix_grossiste, prix_pharmacien, prix_public, tva_rate, source_id, market_price_sources(name, slug, country_code)")
          .eq("is_matched", true)
          .not("product_id", "is", null)
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      return all;
    },
    staleTime: 60_000,
  });

  // Fetch products for matched IDs
  const productIds = useMemo(() => [...new Set(rawData.map((r: any) => r.product_id).filter(Boolean))], [rawData]);

  const { data: products = [] } = useQuery({
    queryKey: ["veille-prix-products", productIds.length],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const all: any[] = [];
      for (let i = 0; i < productIds.length; i += 100) {
        const batch = productIds.slice(i, i + 100);
        const { data } = await supabase.from("products").select("id, name, gtin, brand_name, category_name, best_price_excl_vat").in("id", batch);
        if (data) all.push(...data);
      }
      return all;
    },
    enabled: productIds.length > 0,
    staleTime: 60_000,
  });

  // Discover dynamic source slugs from data
  const sourceSlugs = useMemo(() => {
    const slugSet = new Map<string, { name: string; slug: string; country_code: string | null }>();
    for (const mp of rawData) {
      const src = (mp as any).market_price_sources;
      if (src?.slug && !slugSet.has(src.slug)) {
        slugSet.set(src.slug, { name: src.name, slug: src.slug, country_code: src.country_code });
      }
    }
    return [...slugSet.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rawData]);

  // Helper to get the right price from a market_price row based on selected type
  const getSourcePrice = useCallback((mp: any): number | null => {
    if (priceType === "grossiste") return mp?.prix_grossiste || null;
    if (priceType === "pharmacien") return mp?.prix_pharmacien || null;
    if (priceType === "public") return mp?.prix_public || null;
    return mp?.prix_grossiste || mp?.prix_pharmacien || mp?.prix_public || null;
  }, [priceType]);

  // Build comparison rows — dynamic per source
  const rows = useMemo(() => {
    const productMap = Object.fromEntries(products.map((p: any) => [p.id, p]));
    const grouped: Record<string, { product: any; sources: Record<string, any> }> = {};

    for (const mp of rawData) {
      const pid = mp.product_id;
      if (!pid || !productMap[pid]) continue;
      const slug = (mp as any).market_price_sources?.slug;
      const srcCountry = (mp as any).market_price_sources?.country_code;
      if (!slug) continue;

      if (countryFilter !== "all" && srcCountry !== countryFilter) continue;
      if (sourceFilter !== "all" && slug !== sourceFilter) continue;

      if (!grouped[pid]) grouped[pid] = { product: productMap[pid], sources: {} };
      grouped[pid].sources[slug] = mp;
    }

    return Object.values(grouped).map((row) => {
      const qogitaPrice = row.product.best_price_excl_vat || 0;
      let refPrice: number | null = null;
      for (const src of Object.values(row.sources)) {
        const p = getSourcePrice(src);
        if (p && (refPrice === null || p < refPrice)) refPrice = p;
      }
      const ecart = refPrice && qogitaPrice > 0 ? ((refPrice - qogitaPrice) / refPrice) * 100 : null;
      return { ...row, qogitaPrice, ecart };
    });
  }, [rawData, products, countryFilter, sourceFilter, getSourcePrice]);

  // Visible source columns (based on active filters)
  const visibleSources = useMemo(() => {
    if (sourceFilter !== "all") return sourceSlugs.filter(s => s.slug === sourceFilter);
    if (countryFilter !== "all") return sourceSlugs.filter(s => s.country_code === countryFilter);
    return sourceSlugs;
  }, [sourceSlugs, sourceFilter, countryFilter]);

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
      if (sortKey === "name") return sortDir === "asc" ? (a.product.name || "").localeCompare(b.product.name || "") : (b.product.name || "").localeCompare(a.product.name || "");
      if (sortKey === "qogita") return sortDir === "asc" ? a.qogitaPrice - b.qogitaPrice : b.qogitaPrice - a.qogitaPrice;
      if (sortKey === "ecart") {
        const aV = a.ecart ?? -999; const bV = b.ecart ?? -999;
        return sortDir === "asc" ? aV - bV : bV - aV;
      }
      // Source-specific sort
      const aPrice = getSourcePrice(a.sources[sortKey]) || 0;
      const bPrice = getSourcePrice(b.sources[sortKey]) || 0;
      return sortDir === "asc" ? aPrice - bPrice : bPrice - aPrice;
    });
    return r;
  }, [rows, search, brandFilter, categoryFilter, ecartMinFilter, sortKey, sortDir, getSourcePrice]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const pagedRows = filteredRows.slice((page - 1) * perPage, page * perPage);

  const brands = useMemo(() => [...new Set(rows.map(r => r.product.brand_name).filter(Boolean))].sort(), [rows]);
  const categories = useMemo(() => [...new Set(rows.map(r => r.product.category_name).filter(Boolean))].sort(), [rows]);
  const countries = useMemo(() => [...new Set(sources.map(s => s.country_code).filter(Boolean))].sort() as string[], [sources]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const formatPrice = (n: number | null | undefined) => n != null && n > 0 ? `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "—";

  const SortIcon = ({ k }: { k: SortKey }) => (
    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-0.5 hover:text-foreground">
      <ArrowUpDown size={12} className={sortKey === k ? "text-primary" : ""} />
    </button>
  );

  // ——— Create Source ———
  const handleCreateSource = async () => {
    if (!newSourceName.trim()) return;
    const slug = newSourceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("market_price_sources").insert({
      name: newSourceName.trim(),
      slug,
      country_code: newSourceCountry,
      source_type: newSourceType,
    });
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success(`Source "${newSourceName}" créée`);
    setNewSourceName("");
    setShowSourceDialog(false);
    qc.invalidateQueries({ queryKey: ["market-sources"] });
  };

  // ——— Import XLSX ———
  const handleImport = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !importSourceId) { toast.error("Sélectionnez un fichier et une source"); return; }

    setImporting(true);
    setImportReport(null);
    setImportProgress({ phase: "Lecture du fichier…", current: 0, total: 0 });
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (jsonRows.length === 0) { toast.error("Fichier vide"); setImporting(false); return; }

      // Detect columns
      const headers = Object.keys(jsonRows[0]).map(h => h.toLowerCase().trim());
      const findCol = (patterns: string[]) => {
        const orig = Object.keys(jsonRows[0]);
        for (const p of patterns) {
          const idx = headers.findIndex(h => h.includes(p));
          if (idx >= 0) return orig[idx];
        }
        return null;
      };

      const colEan = findCol(["ean", "gtin", "code barre", "barcode"]);
      const colCnk = findCol(["cnk", "cnk_code"]);
      const colName = findCol(["nom", "name", "désignation", "designation", "libellé", "libelle", "produit", "product"]);
      const colPrixGros = findCol(["grossiste", "prix achat", "prix_achat", "wholesale", "prix grossiste", "p.achat", "prix de gros"]);
      const colPrixPharma = findCol(["pharmacien", "prix vente", "prix_vente", "pharma", "prix pharmacien", "pvp", "p.vente"]);
      const colPrixPublic = findCol(["public", "prix public", "prix_public", "pvp ttc", "retail"]);
      const colTva = findCol(["tva", "vat", "tax"]);

      // Fetch all products for matching
      setImportProgress({ phase: "Chargement des produits…", current: 0, total: 0 });
      const allProducts: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("products").select("id, gtin, cnk_code").range(from, from + 999);
        if (!data || data.length === 0) break;
        allProducts.push(...data);
        setImportProgress({ phase: "Chargement des produits…", current: allProducts.length, total: 0 });
        if (data.length < 1000) break;
        from += 1000;
      }

      // Also fetch market_codes for cross-matching
      const allMarketCodes: any[] = [];
      from = 0;
      while (true) {
        const { data } = await supabase.from("product_market_codes").select("product_id, code_value").range(from, from + 999);
        if (!data || data.length === 0) break;
        allMarketCodes.push(...data);
        if (data.length < 1000) break;
        from += 1000;
      }

      const gtinMap = new Map<string, string>();
      const cnkMap = new Map<string, string>();
      const marketCodeMap = new Map<string, string>(); // code_value -> product_id
      for (const p of allProducts) {
        if (p.gtin) gtinMap.set(p.gtin.replace(/^0+/, ""), p.id);
        if (p.cnk_code) cnkMap.set(p.cnk_code.replace(/^0+/, ""), p.id);
      }
      for (const mc of allMarketCodes) {
        if (mc.code_value) marketCodeMap.set(mc.code_value.replace(/^0+/, ""), mc.product_id);
      }

      setImportProgress({ phase: "Matching des lignes…", current: 0, total: jsonRows.length });
      let inserted = 0, matched = 0;
      const batchInsert: any[] = [];

      for (const row of jsonRows) {
        const ean = colEan ? String(row[colEan] || "").trim().replace(/^0+/, "") : "";
        const cnk = colCnk ? String(row[colCnk] || "").trim().replace(/^0+/, "") : "";
        const name = colName ? String(row[colName] || "").trim() : "";

        // Double matching: EAN→gtin, CNK→cnk_code, CNK→market_codes, EAN→market_codes
        let productId: string | null = null;
        if (ean && gtinMap.has(ean)) productId = gtinMap.get(ean)!;
        if (!productId && cnk && cnkMap.has(cnk)) productId = cnkMap.get(cnk)!;
        if (!productId && cnk && marketCodeMap.has(cnk)) productId = marketCodeMap.get(cnk)!;
        if (!productId && ean && marketCodeMap.has(ean)) productId = marketCodeMap.get(ean)!;

        if (productId) matched++;

        const parseNum = (v: any) => { const n = parseFloat(String(v || "").replace(",", ".")); return isNaN(n) ? null : n; };

        batchInsert.push({
          source_id: importSourceId,
          ean: colEan ? String(row[colEan] || "").trim() : null,
          cnk: colCnk ? String(row[colCnk] || "").trim() : null,
          product_name_source: name || null,
          prix_grossiste: colPrixGros ? parseNum(row[colPrixGros]) : null,
          prix_pharmacien: colPrixPharma ? parseNum(row[colPrixPharma]) : null,
          prix_public: colPrixPublic ? parseNum(row[colPrixPublic]) : null,
          tva_rate: colTva ? parseNum(row[colTva]) : null,
          product_id: productId,
          is_matched: !!productId,
        });
      }

      // Split rows: those with EAN use source_id,ean conflict; those with only CNK use source_id,cnk
      const rowsWithEan = batchInsert.filter(r => r.ean && r.ean.trim() !== "");
      const rowsWithCnkOnly = batchInsert.filter(r => (!r.ean || r.ean.trim() === "") && r.cnk && r.cnk.trim() !== "");

      const totalToInsert = rowsWithEan.length + rowsWithCnkOnly.length;
      let insertedSoFar = 0;

      const upsertBatches = async (rows: any[], conflictKey: string) => {
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const deduped = new Map<string, any>();
          for (const r of batch) {
            const key = conflictKey === "source_id,ean" ? `${r.source_id}__${r.ean}` : `${r.source_id}__${r.cnk}`;
            deduped.set(key, r);
          }
          const dedupedRows = Array.from(deduped.values());
          const { error } = await supabase.from("market_prices").upsert(dedupedRows, { onConflict: conflictKey });
          if (error) {
            console.error(`Upsert error (${conflictKey}):`, error);
            for (const r of dedupedRows) {
              try { await supabase.from("market_prices").upsert(r, { onConflict: conflictKey }); } catch {}
            }
          }
          inserted += dedupedRows.length;
          insertedSoFar += dedupedRows.length;
          setImportProgress({ phase: "Insertion en base…", current: insertedSoFar, total: totalToInsert });
        }
      };

      if (rowsWithEan.length > 0) await upsertBatches(rowsWithEan, "source_id,ean");
      if (rowsWithCnkOnly.length > 0) await upsertBatches(rowsWithCnkOnly, "source_id,cnk");

      // Update source stats
      await supabase.from("market_price_sources").update({
        total_products: inserted,
        last_import_at: new Date().toISOString(),
      }).eq("id", importSourceId);

      setImportReport({ total: jsonRows.length, matched, inserted });
      toast.success(`${inserted} lignes importées, ${matched} matchées`);
      qc.invalidateQueries({ queryKey: ["veille-prix-data"] });
      qc.invalidateQueries({ queryKey: ["market-sources"] });
    } catch (e: any) {
      toast.error("Erreur d'import: " + (e.message || e));
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }, [importSourceId, qc]);

  // Export
  const handleExport = () => {
    const exportData = filteredRows.map(r => {
      const base: any = {
        Produit: r.product.name,
        GTIN: r.product.gtin,
        Marque: r.product.brand_name,
        "Prix MediKong (HTVA)": r.qogitaPrice?.toFixed(2),
      };
      for (const src of visibleSources) {
        const mp = r.sources[src.slug];
        base[`${src.name} (gros)`] = mp?.prix_grossiste?.toFixed(2) || "";
        base[`${src.name} (pharma)`] = mp?.prix_pharmacien?.toFixed(2) || "";
      }
      base["Écart %"] = r.ecart?.toFixed(1) || "";
      return base;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), "Veille prix");
    XLSX.writeFile(wb, `veille-prix-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <AdminTopBar title="Veille prix" subtitle={`${filteredRows.length} produits comparés`} />

      {/* Actions bar */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" className="gap-1.5" onClick={() => setShowImportDialog(true)}>
          <Upload size={14} /> Importer XLSX
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSourceDialog(true)}>
          <Plus size={14} /> Nouvelle source
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
          <Download size={14} /> Export XLSX
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-background border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Produits matchés</p>
          <p className="text-2xl font-bold text-foreground">{rows.length.toLocaleString("fr-FR")}</p>
        </div>
        {visibleSources.slice(0, 2).map(src => {
          const count = rows.filter(r => r.sources[src.slug]).length;
          return (
            <div key={src.slug} className="bg-background border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Avec prix {src.name}</p>
              <p className="text-2xl font-bold text-foreground">{count.toLocaleString("fr-FR")}</p>
            </div>
          );
        })}
        <div className="bg-background border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Écart moyen</p>
          <p className="text-2xl font-bold text-foreground">
            {rows.filter(r => r.ecart !== null).length > 0
              ? (rows.filter(r => r.ecart !== null).reduce((s, r) => s + (r.ecart || 0), 0) / rows.filter(r => r.ecart !== null).length).toFixed(1) + " %"
              : "—"}
          </p>
        </div>
      </div>

      {/* Sources overview */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {sources.map(s => (
            <Badge key={s.id} variant="outline" className="text-xs gap-1">
              {s.country_code && <span>{s.country_code}</span>}
              {s.name}
              <span className="text-muted-foreground">({s.total_products || 0})</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher par nom, GTIN, marque..." className="pl-9 h-9 text-sm" />
        </div>
        <Select value={countryFilter} onValueChange={v => { setCountryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Pays" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les pays</SelectItem>
            {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sources</SelectItem>
            {sources.map(s => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={v => { setBrandFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Marque" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les marques</SelectItem>
            {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ecartMinFilter?.toString() || "all"} onValueChange={v => { setEcartMinFilter(v === "all" ? null : Number(v)); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Écart min" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout écart</SelectItem>
            <SelectItem value="5">≥ 5%</SelectItem>
            <SelectItem value="10">≥ 10%</SelectItem>
            <SelectItem value="20">≥ 20%</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priceType} onValueChange={v => { setPriceType(v as PriceType); setPage(1); }}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Type de prix" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grossiste">Prix grossiste</SelectItem>
            <SelectItem value="pharmacien">Prix pharmacien</SelectItem>
            <SelectItem value="public">Prix public</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price type legend */}
      <div className="text-xs text-muted-foreground mb-3">
        Comparaison sur le <span className="font-semibold text-foreground">prix {priceType}</span> — L'écart % est calculé entre le prix MediKong et le prix {priceType} de la source.
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <>
          <div className="border border-border rounded-xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] min-w-[250px]">Produit <SortIcon k="name" /></TableHead>
                  <TableHead className="text-[11px]">GTIN</TableHead>
                  <TableHead className="text-[11px] text-right">Prix MediKong <SortIcon k="qogita" /></TableHead>
                  {visibleSources.map(src => (
                    <TableHead key={src.slug} className="text-[11px] text-right">
                      {src.name} <span className="text-muted-foreground capitalize">({priceType})</span> <SortIcon k={src.slug} />
                    </TableHead>
                  ))}
                  <TableHead className="text-[11px] text-right">Écart % <SortIcon k="ecart" /></TableHead>
                  <TableHead className="text-[11px] text-center w-[60px]">Fiche</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map((row) => (
                  <TableRow key={row.product.id}>
                    <TableCell>
                      <p className="text-[13px] font-medium text-foreground truncate max-w-[300px]">{row.product.name}</p>
                      <p className="text-[11px] text-muted-foreground">{row.product.brand_name}</p>
                    </TableCell>
                    <TableCell className="text-[12px] font-mono text-muted-foreground">{row.product.gtin}</TableCell>
                    <TableCell className="text-right text-[13px] font-medium">{formatPrice(row.qogitaPrice)}</TableCell>
                    {visibleSources.map(src => {
                      const mp = row.sources[src.slug];
                      const price = getSourcePrice(mp);
                      return <TableCell key={src.slug} className="text-right text-[13px]">{formatPrice(price)}</TableCell>;
                    })}
                    <TableCell className="text-right">
                      {row.ecart !== null ? (
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-bold ${row.ecart > 0 ? "text-green-700 border-green-300 bg-green-50" : row.ecart < -5 ? "text-red-700 border-red-300 bg-red-50" : "text-muted-foreground"}`}
                        >
                          {row.ecart > 0 ? <TrendingDown size={12} className="mr-0.5" /> : <TrendingUp size={12} className="mr-0.5" />}
                          {row.ecart > 0 ? "-" : "+"}{Math.abs(row.ecart).toFixed(1)}%
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <a href={`/produit/${row.product.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                        <ExternalLink size={14} className="text-muted-foreground hover:text-primary" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              {filteredRows.length} résultats — Page {page}/{totalPages}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
            </div>
          </div>
        </>
      )}

      {/* ——— Import Dialog ——— */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importer des prix marché (XLSX/CSV)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Source de prix</Label>
              <Select value={importSourceId} onValueChange={setImportSourceId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une source…" /></SelectTrigger>
                <SelectContent>
                  {sources.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.country_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sources.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Aucune source. Créez-en une d'abord.</p>
              )}
            </div>
            <div>
              <Label className="text-sm">Fichier XLSX ou CSV</Label>
              <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="mt-1" />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Colonnes reconnues :</p>
              <p>EAN/GTIN, CNK, Nom/Désignation, Prix grossiste, Prix pharmacien, Prix public, TVA</p>
              <p>Le matching se fait par EAN → CNK vers vos produits existants.</p>
            </div>
            {importing && importProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{importProgress.phase}</span>
                  {importProgress.total > 0 && (
                    <span className="text-muted-foreground">{importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}</span>
                  )}
                  {importProgress.total === 0 && importProgress.current > 0 && (
                    <span className="text-muted-foreground">{importProgress.current.toLocaleString()} chargés</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: importProgress.total > 0 ? `${Math.min(100, (importProgress.current / importProgress.total) * 100)}%` : '100%' }}
                  />
                </div>
                {importProgress.total === 0 && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden -mt-4">
                    <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
                  </div>
                )}
              </div>
            )}
            {importReport && (
              <div className="bg-accent/50 border border-border rounded-lg p-3 text-sm">
                <p className="font-medium">Import terminé ✓</p>
                <p className="text-muted-foreground">{importReport.inserted} lignes insérées, {importReport.matched} matchées sur {importReport.total} total</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Fermer</Button>
            <Button onClick={handleImport} disabled={importing || !importSourceId}>
              {importing && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ——— New Source Dialog ——— */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle source de prix</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Nom</Label>
              <Input value={newSourceName} onChange={e => setNewSourceName(e.target.value)} placeholder="Ex: Medi-Market, Farmaline…" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Pays</Label>
              <Select value={newSourceCountry} onValueChange={setNewSourceCountry}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BE">Belgique</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="LU">Luxembourg</SelectItem>
                  <SelectItem value="NL">Pays-Bas</SelectItem>
                  <SelectItem value="DE">Allemagne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Type</Label>
              <Select value={newSourceType} onValueChange={setNewSourceType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesaler">Grossiste</SelectItem>
                  <SelectItem value="pharmacy">Pharmacie</SelectItem>
                  <SelectItem value="retailer">Détaillant</SelectItem>
                  <SelectItem value="online">E-commerce</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSourceDialog(false)}>Annuler</Button>
            <Button onClick={handleCreateSource} disabled={!newSourceName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
