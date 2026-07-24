import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Scope = "brand" | "category";
type Summary = {
  last_date: string | null;
  last_median: number | null;
  last_avg: number | null;
  product_count: number | null;
  change_1d_pct: number | null;
  change_7d_pct: number | null;
  change_30d_pct: number | null;
};
type Point = {
  price_date: string;
  product_count: number;
  avg_price_eur: number;
  median_price_eur: number;
};

function fmtEur(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(v));
}
function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
}

function DeltaBadge({ pct, label }: { pct: number | null | undefined; label: string }) {
  const v = pct === null || pct === undefined ? null : Number(pct);
  const zero = v === null || Math.abs(v) < 0.005;
  const up = v !== null && v > 0;
  const Icon = zero ? Minus : up ? ArrowUp : ArrowDown;
  const cls = zero
    ? "bg-muted text-muted-foreground"
    : up
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-green-50 text-green-700 border-green-200";
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${cls}`}>
      <span className="text-xs font-medium">{label}</span>
      <div className="flex items-center gap-1 text-sm font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} %`}
      </div>
    </div>
  );
}

export default function TendancesPage() {
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<Scope>((params.get("scope") as Scope) || "brand");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [days, setDays] = useState<number>(parseInt(params.get("days") || "90", 10));

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("scope", scope);
    if (selectedId) next.set("id", selectedId); else next.delete("id");
    next.set("days", String(days));
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, selectedId, days]);

  // SEO
  useEffect(() => {
    document.title = "Tendances de prix marché — MediKong";
    const desc = "Suivi des prix marché : médiane, moyenne et variations J/J, 7j et 30j par marque et par catégorie.";
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) { tag = document.createElement("meta"); tag.setAttribute("name", "description"); document.head.appendChild(tag); }
    tag.setAttribute("content", desc);
  }, []);

  // Option lists — brands & categories that actually have history
  const brandsQuery = useQuery({
    queryKey: ["tendances-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qogita_price_history_by_brand_v")
        .select("brand_id, brand_name")
        .not("brand_id", "is", null)
        .limit(2000);
      if (error) throw error;
      const seen = new Map<string, string>();
      (data ?? []).forEach((r: { brand_id: string; brand_name: string | null }) => {
        if (r.brand_id && !seen.has(r.brand_id)) seen.set(r.brand_id, r.brand_name ?? "—");
      });
      return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["tendances-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qogita_price_history_by_category_v")
        .select("category_id, category_name")
        .not("category_id", "is", null)
        .limit(2000);
      if (error) throw error;
      const seen = new Map<string, string>();
      (data ?? []).forEach((r: { category_id: string; category_name: string | null }) => {
        if (r.category_id && !seen.has(r.category_id)) seen.set(r.category_id, r.category_name ?? "—");
      });
      return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const options = scope === "brand" ? brandsQuery.data ?? [] : categoriesQuery.data ?? [];

  // Auto-select first option when scope changes if current id not in list
  useEffect(() => {
    if (!options.length) return;
    if (!selectedId || !options.some(o => o.id === selectedId)) {
      setSelectedId(options[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, options.length]);

  const summaryQuery = useQuery({
    queryKey: ["tendances-summary", scope, selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const rpc = scope === "brand" ? "qogita_brand_trend_summary" : "qogita_category_trend_summary";
      const arg = scope === "brand" ? { _brand_id: selectedId } : { _category_id: selectedId };
      const { data, error } = await supabase.rpc(rpc, arg as never);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as Summary | null;
    },
  });

  const seriesQuery = useQuery({
    queryKey: ["tendances-series", scope, selectedId, days],
    enabled: !!selectedId,
    queryFn: async () => {
      const rpc = scope === "brand" ? "qogita_brand_trend_series" : "qogita_category_trend_series";
      const arg = scope === "brand"
        ? { _brand_id: selectedId, _days: days }
        : { _category_id: selectedId, _days: days };
      const { data, error } = await supabase.rpc(rpc, arg as never);
      if (error) throw error;
      return (data ?? []) as Point[];
    },
  });

  const chartData = useMemo(() => (seriesQuery.data ?? []).map(p => ({
    date: p.price_date,
    label: new Date(p.price_date).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" }),
    median: Number(p.median_price_eur),
    avg: Number(p.avg_price_eur),
    count: Number(p.product_count),
  })), [seriesQuery.data]);

  const selectedName = options.find(o => o.id === selectedId)?.name ?? "";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Tendances marché</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Prix marché — courbes & variations</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Médiane et moyenne des prix Qogita observés au fil du temps, agrégées par marque ou par catégorie.
          Variations calculées sur la médiane à J/J, 7 jours et 30 jours.
        </p>
      </header>

      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <TabsList>
          <TabsTrigger value="brand">Par marque</TabsTrigger>
          <TabsTrigger value="category">Par catégorie</TabsTrigger>
        </TabsList>

        <TabsContent value={scope} className="space-y-6 pt-4">
          <Card>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-[1fr_180px]">
              <div>
                <Label className="mb-1 block">
                  {scope === "brand" ? "Marque" : "Catégorie"}
                </Label>
                <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder={options.length ? "Sélectionner…" : "Chargement…"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {options.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Période</Label>
                <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v, 10))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 jours</SelectItem>
                    <SelectItem value="90">90 jours</SelectItem>
                    <SelectItem value="180">180 jours</SelectItem>
                    <SelectItem value="365">365 jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {!selectedId ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Sélectionne une {scope === "brand" ? "marque" : "catégorie"} pour afficher les tendances.
            </CardContent></Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Médiane</CardDescription>
                    <CardTitle className="text-2xl">{fmtEur(summaryQuery.data?.last_median ?? null)}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    au {fmtDate(summaryQuery.data?.last_date ?? null)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardDescription>Moyenne</CardDescription>
                    <CardTitle className="text-2xl">{fmtEur(summaryQuery.data?.last_avg ?? null)}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {summaryQuery.data?.product_count ?? 0} produits observés
                  </CardContent>
                </Card>
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2"><CardDescription>Variations médiane</CardDescription></CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2">
                    <DeltaBadge label="J/J" pct={summaryQuery.data?.change_1d_pct ?? null} />
                    <DeltaBadge label="7 jours" pct={summaryQuery.data?.change_7d_pct ?? null} />
                    <DeltaBadge label="30 jours" pct={summaryQuery.data?.change_30d_pct ?? null} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Évolution des prix — {selectedName}
                  </CardTitle>
                  <CardDescription>
                    Médiane et moyenne quotidiennes sur {days} jours.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {seriesQuery.isLoading ? (
                    <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                      Chargement…
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                      Aucune donnée sur cette période.
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                          <YAxis
                            tick={{ fontSize: 12 }}
                            tickFormatter={(v) => `€${Number(v).toFixed(2)}`}
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [fmtEur(value), name === "median" ? "Médiane" : "Moyenne"]}
                            labelFormatter={(l, payload) => {
                              const d = payload?.[0]?.payload?.date;
                              return d ? fmtDate(d) : String(l);
                            }}
                          />
                          <Legend
                            formatter={(v) => v === "median" ? "Médiane" : "Moyenne"}
                            wrapperStyle={{ fontSize: 12 }}
                          />
                          <Line type="monotone" dataKey="median" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="avg" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{chartData.length} points</Badge>
                    <span>Source : historique Qogita agrégé quotidiennement.</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
