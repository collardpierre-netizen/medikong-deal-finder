import { useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceTypeInfo } from "@/components/product/PriceTypeInfo";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useDiscountSearch,
  useDiscountByVendor,
  fetchAllDiscountResults,
  type DiscountReference,
  type VendorGroup,
} from "@/hooks/useDiscountSearch";
import { exportDiscountCsv, exportDiscountXlsx } from "@/lib/discount-export";
import {
  Download, FileSpreadsheet, Percent, ShieldCheck, AlertCircle, Loader2,
  Search, X, CheckSquare, Square, Store, Package, Truck, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getVendorPublicName, sanitizeVendorLabel } from "@/lib/vendor-display";
import { usePvpVsMarketComparison } from "@/hooks/usePvpVsMarketComparison";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const COUNTRIES = ["BE", "FR", "LU"];

const fmtEur = (cents: number) =>
  (cents / 100).toLocaleString("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

interface MultiPickerProps {
  label: string;
  items: { id: string; name: string; product_count?: number | null }[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  placeholder: string;
}

function MultiPicker({ label, items, selected, setSelected, placeholder }: MultiPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name?.toLowerCase().includes(q));
  }, [items, query]);
  const visibleIds = filtered.map((i) => i.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelected(selected.filter((id) => !visibleIds.includes(id)));
    } else {
      const set = new Set([...selected, ...visibleIds]);
      setSelected(Array.from(set));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {selected.length}
            </Badge>
          )}
        </Label>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelected([])}>
              <X className="h-3 w-3 mr-1" /> Vider
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={toggleAllVisible}>
            {allVisibleSelected ? <Square className="h-3 w-3 mr-1" /> : <CheckSquare className="h-3 w-3 mr-1" />}
            {allVisibleSelected ? "Tout désélectionner" : `Tout sélectionner${query ? ` (${filtered.length})` : ""}`}
          </Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="h-48 overflow-y-auto rounded-md border bg-muted/20 divide-y">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground p-3 text-center">Aucun résultat.</p>
        )}
        {filtered.slice(0, 500).map((item) => {
          const checked = selected.includes(item.id);
          return (
            <label
              key={item.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-background transition-colors",
                checked && "bg-primary/5"
              )}
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={checked}
                onChange={() =>
                  setSelected(checked ? selected.filter((x) => x !== item.id) : [...selected, item.id])
                }
              />
              <span className="flex-1 truncate">{item.name}</span>
              {item.product_count ? (
                <span className="text-xs text-muted-foreground tabular-nums">{item.product_count}</span>
              ) : null}
            </label>
          );
        })}
        {filtered.length > 500 && (
          <p className="text-xs text-muted-foreground p-2 text-center bg-background">
            {filtered.length - 500} résultats supplémentaires — affinez la recherche
          </p>
        )}
      </div>
    </div>
  );
}

function VendorMovCard({ group, displayName }: { group: VendorGroup; displayName: string }) {
  const mov = group.max_mov_eur_cents || 0;
  const basket = Number(group.min_basket_at_moq_eur_cents || 0);
  const reach = mov > 0 ? Math.min(100, Math.round((basket / mov) * 100)) : 100;
  const movReached = mov === 0 || basket >= mov;
  const remaining = Math.max(0, mov - basket);
  const [expanded, setExpanded] = useState(false);
  const products = group.products || [];
  const visible = expanded ? products : products.slice(0, 5);

  return (
    <Card className="border-l-4 border-l-primary/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{displayName}</CardTitle>
            <Badge variant="secondary">{group.product_count} produit{group.product_count > 1 ? "s" : ""}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              Économie totale {fmtEur(Number(group.total_savings_eur_cents))}
            </Badge>
            <Badge variant="outline">≈ {group.avg_discount_pct}% moy.</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Panier MOQ : <strong className="text-foreground">{fmtEur(basket)}</strong>
              {mov > 0 && (
                <> &nbsp;•&nbsp; MOV vendeur : <strong className="text-foreground">{fmtEur(mov)}</strong></>
              )}
            </span>
            {mov > 0 ? (
              movReached ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">MOV atteint ✓</Badge>
              ) : (
                <Badge variant="destructive">+ {fmtEur(remaining)} pour atteindre le MOV</Badge>
              )
            ) : (
              <Badge variant="outline">Sans MOV</Badge>
            )}
          </div>
          {mov > 0 && <Progress value={reach} className="h-2" />}
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-2 py-1">Produit</th>
                <th className="px-2 py-1">Marque</th>
                <th className="px-2 py-1 text-right">Prix HTVA</th>
                <th className="px-2 py-1 text-right">MOQ</th>
                <th className="px-2 py-1 text-right">Stock</th>
                <th className="px-2 py-1 text-right">Économie</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.product_id} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1.5">
                    {p.product_slug ? (
                      <Link to={`/produit/${p.product_slug}`} className="text-primary hover:underline">
                        {p.product_name}
                      </Link>
                    ) : p.product_name}
                    {p.cnk && <div className="text-[10px] text-muted-foreground">CNK {p.cnk}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.brand_name || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">{fmtEur(p.best_price_htva_cents)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.moq}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {p.stock_quantity > 0 ? (
                      <span className="text-emerald-700">{p.stock_quantity}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      −{p.discount_pct}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length > 5 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((s) => !s)}>
            {expanded ? "Replier" : `Voir les ${products.length - 5} autres produits`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function BonnesAffairesPage() {
  const { user, isVerifiedBuyer, verificationLoading } = useAuth();
  const { currentCountry } = useCountry();

  const [reference, setReference] = useState<DiscountReference>("pvp");
  const [minPct, setMinPct] = useState<number>(30);
  const [country, setCountry] = useState<string>(String(currentCountry || "BE"));
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [mfIds, setMfIds] = useState<string[]>([]);
  const [view, setView] = useState<"products" | "vendors">("products");
  const [submitted, setSubmitted] = useState<null | {
    reference: DiscountReference; minPct: number; country: string; brandIds: string[]; mfIds: string[];
  }>(null);

  const { data: brands = [] } = useQuery({
    queryKey: ["bonnes-affaires-brands-all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const PAGE = 1000;
      let all: { id: string; name: string; product_count: number | null }[] = [];
      let page = 0;
      while (true) {
        const from = page * PAGE;
        const { data, error } = await supabase
          .from("brands")
          .select("id,name,product_count")
          .order("product_count", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
        page++;
      }
      return all;
    },
  });
  const { data: manufacturers = [] } = useQuery({
    queryKey: ["bonnes-affaires-manufacturers-all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const PAGE = 1000;
      let all: { id: string; name: string }[] = [];
      let page = 0;
      while (true) {
        const from = page * PAGE;
        const { data, error } = await supabase
          .from("manufacturers")
          .select("id,name")
          .order("name", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
        page++;
      }
      return all;
    },
  });

  const searchParams = submitted
    ? {
        reference: submitted.reference,
        minDiscountPct: submitted.minPct,
        country: submitted.country,
        brandIds: submitted.brandIds,
        manufacturerIds: submitted.mfIds,
      }
    : null;

  const productsQuery = useDiscountSearch(
    searchParams ?? { reference: "pvp", minDiscountPct: 0, country: "BE" },
    !!searchParams && !!user && isVerifiedBuyer && view === "products",
  );

  const vendorsQuery = useDiscountByVendor(
    searchParams ?? { reference: "pvp", minDiscountPct: 0, country: "BE" },
    !!searchParams && !!user && isVerifiedBuyer && view === "vendors",
  );

  const rows = useMemo(() => productsQuery.data?.pages.flat() ?? [], [productsQuery.data]);
  const total = rows[0]?.total_count ?? 0;
  const vendorGroups = vendorsQuery.data ?? [];

  // Comparatif PVP TTC vs Prix marché (HTVA → TTC) pour les lignes visibles.
  const visibleProductIds = useMemo(
    () => rows.map((r) => r.product_id).filter(Boolean),
    [rows],
  );
  const { data: pvpVsMarket } = usePvpVsMarketComparison(visibleProductIds);

  // Collect all vendor IDs surfaced in the current results and resolve their
  // public/anonymised display name via vendors_public + getVendorPublicName.
  const vendorIds = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.vendor_id) set.add(r.vendor_id); });
    vendorGroups.forEach((g) => { if (g.vendor_id) set.add(g.vendor_id); });
    return Array.from(set).sort();
  }, [rows, vendorGroups]);

  const { data: vendorMeta = [] } = useQuery({
    queryKey: ["bonnes-affaires-vendors-public", vendorIds],
    enabled: vendorIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors_public")
        .select("id,display_code,type")
        .in("id", vendorIds);
      if (error) throw error;
      return data || [];
    },
  });

  const vendorNameById = useMemo(() => {
    const m = new Map<string, string>();
    vendorMeta.forEach((v: any) => {
      m.set(v.id, getVendorPublicName(v));
    });
    return m;
  }, [vendorMeta]);

  const resolveVendorName = (vendor_id?: string | null, fallback?: string | null) => {
    if (vendor_id && vendorNameById.has(vendor_id)) return vendorNameById.get(vendor_id)!;
    // fallback: at minimum strip Qogita from raw label
    return sanitizeVendorLabel(fallback ?? "", null);
  };

  const reset = () => {
    setReference("pvp"); setMinPct(30); setBrandIds([]); setMfIds([]);
    setSubmitted(null);
  };

  const runExport = async (format: "xlsx" | "csv") => {
    if (!searchParams) return;
    const tid = toast.loading("Préparation de l'export…");
    try {
      const all = await fetchAllDiscountResults(searchParams, 5000);
      if (!all.length) { toast.error("Aucun résultat à exporter", { id: tid }); return; }

      // Anonymise vendor labels for export (resolve via vendors_public for the
      // full set — current page map only covers visible results).
      const exportIds = Array.from(new Set(all.map((r) => r.vendor_id).filter(Boolean) as string[]));
      let exportMap = new Map(vendorNameById);
      const missing = exportIds.filter((id) => !exportMap.has(id));
      if (missing.length) {
        const { data: extra } = await supabase
          .from("vendors_public")
          .select("id,display_code,type")
          .in("id", missing);
        (extra || []).forEach((v: any) => exportMap.set(v.id, getVendorPublicName(v)));
      }
      const anonymised = all.map((r) => ({
        ...r,
        vendor_name: r.vendor_id && exportMap.has(r.vendor_id)
          ? exportMap.get(r.vendor_id)!
          : sanitizeVendorLabel(r.vendor_name, null),
      }));
      if (format === "xlsx") {
        exportDiscountXlsx(anonymised, { reference: searchParams.reference, minDiscountPct: searchParams.minDiscountPct, country: searchParams.country });
      } else {
        exportDiscountCsv(anonymised);
      }
      toast.success(`${all.length} ligne(s) exportées`, { id: tid });
    } catch (e: any) {
      toast.error("Export échoué", { id: tid, description: e?.message });
    }
  };

  if (verificationLoading) {
    return <Layout><div className="container py-12"><Skeleton className="h-64 w-full" /></div></Layout>;
  }

  if (!user || !isVerifiedBuyer) {
    return (
      <Layout>
        <div className="container max-w-2xl py-16">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3"><ShieldCheck className="text-primary" /></div>
                <div>
                  <CardTitle>Bonnes affaires — réservé aux acheteurs vérifiés</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Cet outil permet de scanner tout le catalogue MediKong pour identifier les produits offrant au moins X% de remise vs PVP ou prix marché.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              {!user ? (
                <Button asChild><Link to="/connexion">Se connecter</Link></Button>
              ) : (
                <Button asChild><Link to="/compte">Compléter ma vérification</Link></Button>
              )}
              <Button variant="outline" asChild><Link to="/catalogue">Retour au catalogue</Link></Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const activeFilterCount =
    (brandIds.length ? 1 : 0) +
    (mfIds.length ? 1 : 0) +
    (minPct !== 30 ? 1 : 0) +
    (reference !== "pvp" ? 1 : 0);

  return (
    <Layout>
      <Helmet><title>Bonnes affaires — MediKong</title></Helmet>
      <div className="container py-8 space-y-6 max-w-7xl">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Percent className="text-primary h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Bonnes affaires</h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Identifiez les produits offrant le plus d'économie face au PVP conseillé ou au prix marché moyen.
            Vue <strong>par produit</strong> pour scanner les remises, vue <strong>par vendeur</strong> pour
            atteindre le MOV en regroupant plusieurs produits du même fournisseur.
          </p>
        </header>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Critères de recherche
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}</Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Prix de référence
                  <PriceTypeInfo type={reference === "pvp" ? "pvp" : "market"} />
                </Label>
                <Tabs value={reference} onValueChange={(v) => setReference(v as DiscountReference)}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="pvp">PVP conseillé</TabsTrigger>
                    <TabsTrigger value="market">Prix marché</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {reference === "pvp"
                    ? "PVP conseillé : prix public TTC officiel (APB / PMR ou indiqué par le fabricant). Référence utilisée en pharmacie."
                    : "Prix marché : prix HTVA médian observé chez les autres grossistes/plateformes B2B (veille concurrentielle agrégée). Indique le niveau de prix d'achat habituel pour les professionnels."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Remise minimale : <span className="font-bold text-primary tabular-nums">{minPct}%</span></Label>
                <div className="flex items-center gap-3">
                  <Slider min={5} max={90} step={5} value={[minPct]} onValueChange={(v) => setMinPct(v[0])} className="flex-1" />
                  <Input type="number" min={1} max={99} value={minPct} onChange={(e) => setMinPct(Number(e.target.value) || 0)} className="w-20 tabular-nums" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pays</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <MultiPicker
                label="Marques"
                items={brands as any[]}
                selected={brandIds}
                setSelected={setBrandIds}
                placeholder="Rechercher une marque…"
              />
              <MultiPicker
                label="Fabricants"
                items={manufacturers as any[]}
                selected={mfIds}
                setSelected={setMfIds}
                placeholder="Rechercher un fabricant…"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t">
              <Button
                onClick={() => {
                  // Option A : "tout sélectionné" = "aucun filtre" côté RPC.
                  // Évite qu'une liste exhaustive soit interprétée comme un
                  // sous-ensemble exclusif (qui exclurait les produits sans
                  // brand/manufacturer).
                  const effectiveBrandIds = brandIds.length === brands.length ? [] : brandIds;
                  const effectiveMfIds = mfIds.length === manufacturers.length ? [] : mfIds;
                  setSubmitted({ reference, minPct, country, brandIds: effectiveBrandIds, mfIds: effectiveMfIds });
                }}
                size="lg"
                className="min-w-[140px]"
              >
                <Search className="mr-2 h-4 w-4" />Rechercher
              </Button>
              <Button variant="outline" onClick={reset}>Réinitialiser</Button>
              <div className="flex-1" />
              <Button variant="outline" disabled={!submitted || !rows.length} onClick={() => runExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Exporter XLSX
              </Button>
              <Button variant="outline" disabled={!submitted || !rows.length} onClick={() => runExport("csv")}>
                <Download className="mr-2 h-4 w-4" />Exporter CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {submitted && (
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" /> Par produit
                {view === "products" && total > 0 && <Badge variant="secondary" className="ml-1">{total.toLocaleString("fr-BE")}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="vendors" className="gap-2">
                <Truck className="h-4 w-4" /> Par vendeur (MOV)
                {view === "vendors" && vendorGroups.length > 0 && <Badge variant="secondary" className="ml-1">{vendorGroups.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-0">
              <Card>
                <CardContent className="pt-6">
                  {productsQuery.isError && (
                    <div className="flex items-start gap-2 text-destructive p-4 border border-destructive/30 rounded-md bg-destructive/5">
                      <AlertCircle className="h-4 w-4 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium">Erreur de chargement</p>
                        <p className="text-xs opacity-80">{(productsQuery.error as any)?.message}</p>
                      </div>
                    </div>
                  )}

                  {productsQuery.isPending && (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  )}

                  {!productsQuery.isPending && !productsQuery.isError && rows.length === 0 && (
                    <p className="text-center text-muted-foreground py-12">
                      Aucun produit ne correspond à ces critères. Essayez de baisser la remise minimale ou de retirer des filtres.
                    </p>
                  )}

                  {rows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b sticky top-0 bg-background">
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-2 pr-3">Produit</th>
                            <th className="py-2 pr-3">Marque</th>
                            <th className="py-2 pr-3">Vendeur</th>
                            <th className="py-2 pr-3 text-right">Prix MK HTVA</th>
                            <th className="py-2 pr-3 text-right">Réf.</th>
                            <th className="py-2 pr-3 text-right">MOQ</th>
                            <th className="py-2 pr-3 text-right">Stock</th>
                            <th className="py-2 pr-3 text-right">MOV</th>
                            <th className="py-2 pr-3 text-right">
                              <span className="inline-flex items-center gap-1">
                                PVP vs Marché (TTC)
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground cursor-help" aria-label="Détails du calcul">ⓘ</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs">
                                      <p className="font-medium mb-1">Comparatif PVP vs prix marché</p>
                                      <p>PVP conseillé (TTC) vs prix marché HTVA médian (autres grossistes B2B) converti en TTC via la TVA résolue du produit (6 % méd. / 21 % OTC).</p>
                                      <p className="mt-1">Δ % et € : économie réalisée par rapport au PVP si l'on s'aligne sur le prix marché.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </span>
                            </th>
                            <th className="py-2 pr-3 text-right">Économie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => {
                            const cmp = pvpVsMarket?.get(r.product_id);
                            return (
                            <tr key={`${r.product_id}-${r.country_code}`} className="border-b hover:bg-muted/30">
                              <td className="py-2 pr-3 max-w-[280px]">
                                {r.product_slug ? (
                                  <Link to={`/produit/${r.product_slug}`} className="text-primary hover:underline line-clamp-2">
                                    {r.product_name}
                                  </Link>
                                ) : <span className="line-clamp-2">{r.product_name}</span>}
                                {r.cnk && <div className="text-[10px] text-muted-foreground">CNK {r.cnk}</div>}
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground">{r.brand_name || "—"}</td>
                              <td className="py-2 pr-3 text-muted-foreground">{resolveVendorName(r.vendor_id, r.vendor_name)}</td>
                              <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmtEur(r.best_price_htva_cents)}</td>
                              <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums line-through">{fmtEur(r.reference_price_cents)}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">{r.moq}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {r.stock_quantity > 0 ? <span className="text-emerald-700 font-medium">{r.stock_quantity}</span> : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums text-xs text-muted-foreground">
                                {r.mov_eur_cents > 0 ? fmtEur(r.mov_eur_cents) : "—"}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {cmp && cmp.pvpTtcCents != null && cmp.marketTtcCents != null ? (
                                  <div className="flex flex-col items-end gap-0.5 leading-tight">
                                    <div className="text-[11px] text-muted-foreground">
                                      PVP <span className="text-foreground font-medium">{fmtEur(cmp.pvpTtcCents)}</span>
                                      <span className="mx-1">·</span>
                                      Marché <span className="text-foreground font-medium">{fmtEur(cmp.marketTtcCents)}</span>
                                    </div>
                                    {cmp.deltaCents != null && cmp.deltaPct != null ? (
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "h-5 px-1.5 text-[11px]",
                                          cmp.deltaCents > 0
                                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                            : cmp.deltaCents < 0
                                            ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                                            : ""
                                        )}
                                        title={`PVP TTC ${fmtEur(cmp.pvpTtcCents)} − Marché TTC ${fmtEur(cmp.marketTtcCents)} (TVA ${cmp.vatRatePct}%)`}
                                      >
                                        {cmp.deltaCents > 0 ? "−" : cmp.deltaCents < 0 ? "+" : ""}
                                        {Math.abs(cmp.deltaPct).toLocaleString("fr-BE", { maximumFractionDigits: 1 })}%
                                        <span className="mx-1">·</span>
                                        {fmtEur(Math.abs(cmp.deltaCents))}
                                      </Badge>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-right">
                                <Badge className="bg-emerald-600 hover:bg-emerald-600">−{r.discount_pct}%</Badge>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {productsQuery.hasNextPage && (
                        <div className="flex justify-center pt-4">
                          <Button variant="outline" disabled={productsQuery.isFetchingNextPage} onClick={() => productsQuery.fetchNextPage()}>
                            {productsQuery.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Charger plus ({rows.length} / {total.toLocaleString("fr-BE")})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendors" className="mt-0 space-y-4">
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-4 text-sm text-muted-foreground flex items-start gap-2">
                  <Truck className="h-4 w-4 mt-0.5 text-primary" />
                  <span>
                    Pour chaque vendeur, on regroupe ses meilleures offres en promo. Le <strong>panier MOQ</strong> additionne
                    le prix × MOQ minimum de chaque produit, pour vous montrer si vous pouvez atteindre le <strong>MOV</strong> du
                    vendeur en cumulant plusieurs lignes.
                  </span>
                </CardContent>
              </Card>

              {vendorsQuery.isError && (
                <div className="flex items-start gap-2 text-destructive p-4 border border-destructive/30 rounded-md bg-destructive/5">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">{(vendorsQuery.error as any)?.message}</div>
                </div>
              )}

              {vendorsQuery.isPending && (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
              )}

              {!vendorsQuery.isPending && vendorGroups.length === 0 && !vendorsQuery.isError && (
                <p className="text-center text-muted-foreground py-12">
                  Aucun groupement vendeur. Essayez de baisser la remise minimale ou élargir les filtres.
                </p>
              )}

              {vendorGroups.map((g) => (
                <VendorMovCard
                  key={g.vendor_id}
                  group={g}
                  displayName={resolveVendorName(g.vendor_id, g.vendor_name)}
                />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
