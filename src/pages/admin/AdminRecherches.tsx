import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MousePointerClick, Ban, Hash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

type Period = 7 | 30;

interface KpiData {
  days: number;
  total_searches: number;
  unique_queries: number;
  clicks: number;
  zero_results: number;
  click_rate: number;
  zero_result_rate: number;
  error?: string;
}

interface TopRow {
  normalized_query: string;
  sample_query: string;
  searches: number;
  clicks: number;
  zero_result_searches: number;
  click_rate: number;
  zero_result_rate: number;
  last_searched_at: string;
}

interface ZeroRow {
  normalized_query: string;
  sample_query: string;
  searches: number;
  last_searched_at: string;
}

interface SuggestionItem {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean;
  similarity: number;
}

interface GapRow {
  normalized_query: string;
  sample_query: string;
  searches: number;
  last_searched_at: string;
  suggested_brands: SuggestionItem[];
  suggested_categories: SuggestionItem[];
  matching_products_count: number;
  recommendation: "boost_seo" | "activate_brand" | "enrich_category" | "add_to_catalog";
}

const RECO_LABEL: Record<GapRow["recommendation"], { label: string; variant: "default" | "secondary" | "outline" | "destructive"; hint: string }> = {
  boost_seo: { label: "Booster SEO / synonymes", variant: "secondary", hint: "Des produits existent mais ne ressortent pas. Ajouter des synonymes / mots-clés." },
  activate_brand: { label: "Activer / référencer marque", variant: "default", hint: "Une marque proche existe — l'activer ou rattacher des produits." },
  enrich_category: { label: "Enrichir catégorie", variant: "default", hint: "Catégorie connue mais peu fournie. Ajouter des produits." },
  add_to_catalog: { label: "Ajouter au catalogue", variant: "destructive", hint: "Aucune marque ni catégorie proche. Vraie opportunité d'ajout." },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-BE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KpiCard({ icon: Icon, label, value, hint }: { icon: typeof Search; label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRecherches() {
  const [period, setPeriod] = useState<Period>(7);

  const kpis = useQuery({
    queryKey: ["admin-search-kpis", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_kpis", { _days: period });
      if (error) throw error;
      return data as unknown as KpiData;
    },
  });

  const top = useQuery({
    queryKey: ["admin-search-top", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_top_queries", { _days: period, _limit: 100 });
      if (error) throw error;
      return (data ?? []) as unknown as TopRow[];
    },
  });

  const zero = useQuery({
    queryKey: ["admin-search-zero", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_zero_results", { _days: period, _limit: 100 });
      if (error) throw error;
      return (data ?? []) as unknown as ZeroRow[];
    },
  });

  const gaps = useQuery({
    queryKey: ["admin-search-gaps", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_search_zero_results_with_suggestions", { _days: period, _limit: 100 });
      if (error) throw error;
      return (data ?? []) as unknown as GapRow[];
    },
  });

  const k = kpis.data;

  return (
    <Layout>
      <div className="container mx-auto py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Recherches</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Mots-clés tapés par les utilisateurs, recherches sans résultat et taux de clic.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={period === 7 ? "default" : "outline"} size="sm" onClick={() => setPeriod(7)}>
              7 jours
            </Button>
            <Button variant={period === 30 ? "default" : "outline"} size="sm" onClick={() => setPeriod(30)}>
              30 jours
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Search} label="Recherches" value={kpis.isLoading ? "—" : (k?.total_searches ?? 0).toLocaleString("fr-BE")} hint={`${period} derniers jours`} />
          <KpiCard icon={Hash} label="Mots-clés uniques" value={kpis.isLoading ? "—" : (k?.unique_queries ?? 0).toLocaleString("fr-BE")} />
          <KpiCard icon={MousePointerClick} label="Taux de clic" value={kpis.isLoading ? "—" : `${k?.click_rate ?? 0}%`} hint={`${(k?.clicks ?? 0).toLocaleString("fr-BE")} clics`} />
          <KpiCard icon={Ban} label="Sans résultat" value={kpis.isLoading ? "—" : `${k?.zero_result_rate ?? 0}%`} hint={`${(k?.zero_results ?? 0).toLocaleString("fr-BE")} recherches`} />
        </div>

        <Tabs defaultValue="top">
          <TabsList>
            <TabsTrigger value="top">Top mots-clés</TabsTrigger>
            <TabsTrigger value="zero">Sans résultat</TabsTrigger>
            <TabsTrigger value="gaps">Trous catalogue</TabsTrigger>
          </TabsList>

          <TabsContent value="top" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top mots-clés ({period}j)</CardTitle>
              </CardHeader>
              <CardContent>
                {top.isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
                  </div>
                ) : (top.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Aucune recherche enregistrée sur la période.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="text-left py-2 font-medium">Requête</th>
                          <th className="text-right py-2 font-medium">Recherches</th>
                          <th className="text-right py-2 font-medium">Clics</th>
                          <th className="text-right py-2 font-medium">Taux clic</th>
                          <th className="text-right py-2 font-medium">Sans résultat</th>
                          <th className="text-right py-2 font-medium">Dernière</th>
                          <th className="text-right py-2 font-medium">Voir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.data!.map((r) => (
                          <tr key={r.normalized_query} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 font-medium">{r.sample_query}</td>
                            <td className="py-2 text-right tabular-nums">{r.searches.toLocaleString("fr-BE")}</td>
                            <td className="py-2 text-right tabular-nums">{r.clicks.toLocaleString("fr-BE")}</td>
                            <td className="py-2 text-right tabular-nums">
                              <Badge variant={r.click_rate >= 30 ? "default" : r.click_rate >= 10 ? "secondary" : "outline"}>
                                {r.click_rate}%
                              </Badge>
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {r.zero_result_rate > 0 ? (
                                <Badge variant={r.zero_result_rate >= 50 ? "destructive" : "outline"}>
                                  {r.zero_result_rate}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2 text-right text-xs text-muted-foreground">{formatDate(r.last_searched_at)}</td>
                            <td className="py-2 text-right">
                              <Link
                                to={`/catalogue?q=${encodeURIComponent(r.sample_query)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline text-xs"
                              >
                                Tester →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zero" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recherches sans résultat ({period}j)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Indicateurs pour repérer les trous catalogue (produits absents ou mal référencés).
                </p>
              </CardHeader>
              <CardContent>
                {zero.isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
                  </div>
                ) : (zero.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Aucune recherche sans résultat sur la période. 🎉
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="text-left py-2 font-medium">Requête</th>
                          <th className="text-right py-2 font-medium">Occurrences</th>
                          <th className="text-right py-2 font-medium">Dernière</th>
                          <th className="text-right py-2 font-medium">Voir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zero.data!.map((r) => (
                          <tr key={r.normalized_query} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 font-medium">{r.sample_query}</td>
                            <td className="py-2 text-right tabular-nums">{r.searches.toLocaleString("fr-BE")}</td>
                            <td className="py-2 text-right text-xs text-muted-foreground">{formatDate(r.last_searched_at)}</td>
                            <td className="py-2 text-right">
                              <Link
                                to={`/catalogue?q=${encodeURIComponent(r.sample_query)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline text-xs"
                              >
                                Tester →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gaps" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trous catalogue ({period}j)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Recherches sans résultat avec suggestions de marques / catégories existantes proches, et recommandation d'action.
                </p>
              </CardHeader>
              <CardContent>
                {gaps.isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
                  </div>
                ) : (gaps.data?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    Aucun trou catalogue détecté sur la période. 🎉
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gaps.data!.map((g) => {
                      const reco = RECO_LABEL[g.recommendation];
                      return (
                        <div key={g.normalized_query} className="border rounded-lg p-4 hover:bg-muted/20">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{g.sample_query}</span>
                                <Badge variant="outline" className="text-xs">{g.searches} recherches</Badge>
                                {g.matching_products_count > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {g.matching_products_count} produit(s) actif(s)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{reco.hint}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={reco.variant}>{reco.label}</Badge>
                              <Link
                                to={`/catalogue?q=${encodeURIComponent(g.sample_query)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline text-xs"
                              >
                                Tester →
                              </Link>
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-3 mt-3">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                                Marques proches
                              </div>
                              {g.suggested_brands.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Aucune</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {g.suggested_brands.map((b) => (
                                    <Link
                                      key={b.id}
                                      to={`/admin/marques/${b.slug ?? b.id}/edit`}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted"
                                    >
                                      <span>{b.name}</span>
                                      <span className="text-muted-foreground">({Math.round(b.similarity * 100)}%)</span>
                                      {!b.is_active && <Badge variant="outline" className="text-[10px] py-0 px-1">inactive</Badge>}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                                Catégories proches
                              </div>
                              {g.suggested_categories.length === 0 ? (
                                <span className="text-xs text-muted-foreground">Aucune</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {g.suggested_categories.map((c) => (
                                    <Link
                                      key={c.id}
                                      to={`/categorie/${c.slug ?? c.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted"
                                    >
                                      <span>{c.name}</span>
                                      <span className="text-muted-foreground">({Math.round(c.similarity * 100)}%)</span>
                                      {!c.is_active && <Badge variant="outline" className="text-[10px] py-0 px-1">inactive</Badge>}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
