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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBrands, useManufacturers } from "@/hooks/useAdminData";
import { useDiscountSearch, fetchAllDiscountResults, type DiscountReference } from "@/hooks/useDiscountSearch";
import { exportDiscountCsv, exportDiscountXlsx } from "@/lib/discount-export";
import { Download, FileSpreadsheet, Percent, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const COUNTRIES = ["BE", "FR", "LU"];

export default function BonnesAffairesPage() {
  const { user, isVerifiedBuyer, verificationLoading } = useAuth();
  const { currentCountry } = useCountry();

  const [reference, setReference] = useState<DiscountReference>("pvp");
  const [minPct, setMinPct] = useState<number>(30);
  const [country, setCountry] = useState<string>(currentCountry || "BE");
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [mfIds, setMfIds] = useState<string[]>([]);
  const [brandQuery, setBrandQuery] = useState("");
  const [mfQuery, setMfQuery] = useState("");
  const [submitted, setSubmitted] = useState<null | {
    reference: DiscountReference; minPct: number; country: string; brandIds: string[]; mfIds: string[];
  }>(null);

  const { data: brands = [] } = useBrands();
  const { data: manufacturers = [] } = useManufacturers();

  const brandOptions = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    return (brands as any[])
      .filter((b) => !q || b.name?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [brands, brandQuery]);

  const mfOptions = useMemo(() => {
    const q = mfQuery.trim().toLowerCase();
    return (manufacturers as any[])
      .filter((m) => !q || m.name?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [manufacturers, mfQuery]);

  const searchParams = submitted
    ? {
        reference: submitted.reference,
        minDiscountPct: submitted.minPct,
        country: submitted.country,
        brandIds: submitted.brandIds,
        manufacturerIds: submitted.mfIds,
      }
    : null;

  const query = useDiscountSearch(
    searchParams ?? {
      reference: "pvp", minDiscountPct: 0, country: "BE",
    },
    !!searchParams && !!user && isVerifiedBuyer,
  );

  const rows = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const total = rows[0]?.total_count ?? 0;

  const reset = () => {
    setReference("pvp"); setMinPct(30); setBrandIds([]); setMfIds([]);
    setBrandQuery(""); setMfQuery(""); setSubmitted(null);
  };

  const runExport = async (format: "xlsx" | "csv") => {
    if (!searchParams) return;
    const tid = toast.loading("Préparation de l'export…");
    try {
      const all = await fetchAllDiscountResults(searchParams, 5000);
      if (!all.length) { toast.error("Aucun résultat à exporter", { id: tid }); return; }
      if (format === "xlsx") {
        exportDiscountXlsx(all, { reference: searchParams.reference, minDiscountPct: searchParams.minDiscountPct, country: searchParams.country });
      } else {
        exportDiscountCsv(all);
      }
      toast.success(`${all.length} ligne(s) exportées`, { id: tid });
    } catch (e: any) {
      toast.error("Export échoué", { id: tid, description: e?.message });
    }
  };

  // Gate
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

  return (
    <Layout>
      <Helmet><title>Bonnes affaires — MediKong</title></Helmet>
      <div className="container py-8 space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Percent className="text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Bonnes affaires</h1>
          </div>
          <p className="text-muted-foreground">Trouvez tous les produits avec X% d'économie face au PVP conseillé ou au prix marché moyen.</p>
        </header>

        <Card>
          <CardHeader><CardTitle className="text-lg">Critères de recherche</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Prix de référence</Label>
                <Tabs value={reference} onValueChange={(v) => setReference(v as DiscountReference)}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="pvp">PVP conseillé</TabsTrigger>
                    <TabsTrigger value="market">Prix marché moyen</TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {reference === "pvp"
                    ? "Compare au Prix Public Conseillé (APB / PMR / officiel)."
                    : "Compare au prix marché public/grossiste agrégé."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Remise minimale : <span className="font-bold text-primary">{minPct}%</span></Label>
                <div className="flex items-center gap-3">
                  <Slider min={5} max={90} step={5} value={[minPct]} onValueChange={(v) => setMinPct(v[0])} className="flex-1" />
                  <Input type="number" min={1} max={99} value={minPct} onChange={(e) => setMinPct(Number(e.target.value) || 0)} className="w-20" />
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

              <div className="space-y-2">
                <Label>Marques ({brandIds.length} sélectionnée{brandIds.length > 1 ? "s" : ""})</Label>
                <Input placeholder="Rechercher une marque…" value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} />
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/30">
                  {brandOptions.length === 0 && <p className="text-xs text-muted-foreground">Aucune marque.</p>}
                  {brandOptions.map((b: any) => {
                    const checked = brandIds.includes(b.id);
                    return (
                      <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-background rounded px-1 py-0.5">
                        <input type="checkbox" checked={checked} onChange={() => setBrandIds((s) => checked ? s.filter((x) => x !== b.id) : [...s, b.id])} />
                        <span className="flex-1 truncate">{b.name}</span>
                        {b.product_count ? <span className="text-xs text-muted-foreground">{b.product_count}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fabricants ({mfIds.length} sélectionné{mfIds.length > 1 ? "s" : ""})</Label>
                <Input placeholder="Rechercher un fabricant…" value={mfQuery} onChange={(e) => setMfQuery(e.target.value)} />
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/30">
                  {mfOptions.length === 0 && <p className="text-xs text-muted-foreground">Aucun fabricant.</p>}
                  {mfOptions.map((m: any) => {
                    const checked = mfIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-background rounded px-1 py-0.5">
                        <input type="checkbox" checked={checked} onChange={() => setMfIds((s) => checked ? s.filter((x) => x !== m.id) : [...s, m.id])} />
                        <span className="flex-1 truncate">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={() => setSubmitted({ reference, minPct, country, brandIds, mfIds })}>
                Rechercher
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                Résultats {query.isPending ? "…" : <Badge variant="secondary" className="ml-2">{total.toLocaleString("fr-BE")}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {query.isError && (
                <div className="flex items-start gap-2 text-destructive p-4 border border-destructive/30 rounded-md bg-destructive/5">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Erreur de chargement</p>
                    <p className="text-xs opacity-80">{(query.error as any)?.message}</p>
                  </div>
                </div>
              )}

              {query.isPending && (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              )}

              {!query.isPending && !query.isError && rows.length === 0 && (
                <p className="text-center text-muted-foreground py-12">
                  Aucun produit ne correspond à ces critères. Essayez de baisser la remise minimale ou de retirer des filtres marque/fabricant.
                </p>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-3">Produit</th>
                        <th className="py-2 pr-3">Marque</th>
                        <th className="py-2 pr-3">Fabricant</th>
                        <th className="py-2 pr-3">Vendeur</th>
                        <th className="py-2 pr-3 text-right">Prix MK HTVA</th>
                        <th className="py-2 pr-3 text-right">Réf.</th>
                        <th className="py-2 pr-3 text-right">Économie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.product_id}-${r.country_code}`} className="border-b hover:bg-muted/30">
                          <td className="py-2 pr-3">
                            {r.product_slug ? (
                              <Link to={`/produit/${r.product_slug}`} className="text-primary hover:underline">
                                {r.product_name}
                              </Link>
                            ) : r.product_name}
                            {r.cnk && <div className="text-xs text-muted-foreground">CNK {r.cnk}</div>}
                          </td>
                          <td className="py-2 pr-3">{r.brand_name || "—"}</td>
                          <td className="py-2 pr-3">{r.manufacturer_name || "—"}</td>
                          <td className="py-2 pr-3">{r.vendor_name || "—"}</td>
                          <td className="py-2 pr-3 text-right font-medium">{(r.best_price_htva_cents / 100).toFixed(2)} €</td>
                          <td className="py-2 pr-3 text-right text-muted-foreground">{(r.reference_price_cents / 100).toFixed(2)} €</td>
                          <td className="py-2 pr-3 text-right">
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">−{r.discount_pct}%</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {query.hasNextPage && (
                    <div className="flex justify-center pt-4">
                      <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                        {query.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Charger plus ({rows.length} / {total.toLocaleString("fr-BE")})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
