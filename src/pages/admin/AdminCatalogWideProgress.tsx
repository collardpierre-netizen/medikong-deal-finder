import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, RefreshCw, Activity, Package, TrendingUp, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type Progress24h = {
  window_hours: number;
  now: string;
  catalog_wide: {
    runs: number;
    runs_success: number;
    runs_failed: number;
    runs_throttled: number;
    throttle_hits_total: number;
    products_processed: number;
    products_targeted: number;
    offers_created: number;
    offers_updated: number;
    tiers_written: number;
    vendors_created: number;
    stale_recalculated: number;
    errors: number;
    avg_duration_ms: number;
    last_run_at: string | null;
    last_run_status: string | null;
  };
  basket: {
    runs: number;
    products_processed: number;
    offers_created: number;
    last_run_at: string | null;
  };
  hourly: Array<{
    bucket: string;
    runs_wide: number;
    products_wide: number;
    offers_wide: number;
    products_basket: number;
    throttled_runs: number;
    errors: number;
  }>;
  recent_runs: Array<{
    id: string;
    sub_mode: string | null;
    status: string;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    products_targeted: number;
    products_processed: number;
    offers_created: number;
    offers_updated: number;
    throttled: boolean | null;
    throttle_hits: number;
    total_errors: number;
    stale_recalc: number;
  }>;
};

type Coverage = {
  total_qogita_offers: number;
  distinct_qogita_products: number;
  fresh_12h: number;
  fresh_48h: number;
  never_verified: number;
  price_stale: number;
  pct_fresh_48h: number;
  pct_fresh_12h: number;
  pct_never: number;
  products_last_24h: number;
  eta_days_full_cycle: number | null;
  computed_at: string;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

const fmtInt = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString("fr-FR") : "—";

export default function AdminCatalogWideProgress() {
  const [hours, setHours] = useState<24 | 48 | 72>(24);

  const progressQ = useQuery({
    queryKey: ["admin-catalog-wide-progress", hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_catalog_wide_progress", {
        _hours: hours,
      });
      if (error) throw error;
      return data as unknown as Progress24h;
    },
    refetchInterval: 60_000,
  });

  const coverageQ = useQuery({
    queryKey: ["admin-catalog-wide-coverage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_catalog_wide_coverage");
      if (error) throw error;
      return data as unknown as Coverage;
    },
    refetchInterval: 60_000,
  });

  const p = progressQ.data;
  const c = coverageQ.data;

  const cw = p?.catalog_wide;
  const throttleRate =
    cw && cw.runs > 0 ? Math.round((100 * cw.runs_throttled) / cw.runs) : 0;
  const throttleTone = throttleRate >= 20 ? "danger" : throttleRate >= 5 ? "warning" : "success";

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progression scraper catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Suivi du mode <code>catalog_wide</code> (batch 200 / 15 min) et couverture du catalogue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(hours)} onValueChange={(v) => setHours(Number(v) as 24 | 48 | 72)}>
            <TabsList>
              <TabsTrigger value="24">24h</TabsTrigger>
              <TabsTrigger value="48">48h</TabsTrigger>
              <TabsTrigger value="72">72h</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              progressQ.refetch();
              coverageQ.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Coverage row */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Couverture catalogue Qogita</h2>
        {coverageQ.isLoading || !c ? (
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <StatCard
                icon={Package}
                label="Offres Qogita actives"
                value={fmtInt(c.total_qogita_offers)}
                hint={`${fmtInt(c.distinct_qogita_products)} produits distincts`}
              />
              <StatCard
                icon={TrendingUp}
                label="Fraîches < 48h"
                value={`${c.pct_fresh_48h}%`}
                hint={`${fmtInt(c.fresh_48h)} offres · ${fmtInt(c.fresh_12h)} en < 12h`}
                tone={c.pct_fresh_48h >= 50 ? "success" : c.pct_fresh_48h >= 10 ? "warning" : "danger"}
              />
              <StatCard
                icon={AlertTriangle}
                label="Jamais vérifiées"
                value={`${c.pct_never}%`}
                hint={`${fmtInt(c.never_verified)} offres · price_stale: ${fmtInt(c.price_stale)}`}
                tone={c.pct_never >= 50 ? "danger" : c.pct_never >= 20 ? "warning" : "default"}
              />
              <StatCard
                icon={Clock}
                label="ETA cycle complet"
                value={c.eta_days_full_cycle ? `${c.eta_days_full_cycle} j` : "—"}
                hint={
                  c.products_last_24h > 0
                    ? `${fmtInt(c.products_last_24h)} produits/24h`
                    : "Aucun run catalog_wide 24h"
                }
              />
            </div>
            <div className="mt-3">
              <Progress value={Math.min(100, c.pct_fresh_48h)} aria-label="Fraîcheur 48h" />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Fraîcheur cible : 100% en &lt; 48h</span>
                <span>Actuel : {c.pct_fresh_48h}%</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Run stats */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Activité <code>catalog_wide</code> · {hours}h
        </h2>
        {progressQ.isLoading || !cw ? (
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard
              icon={Activity}
              label="Runs"
              value={fmtInt(cw.runs)}
              hint={`${cw.runs_success} OK · ${cw.runs_failed} échec`}
              tone={cw.runs_failed > 0 ? "warning" : "success"}
            />
            <StatCard
              icon={Package}
              label="Produits vérifiés"
              value={fmtInt(cw.products_processed)}
              hint={`sur ${fmtInt(cw.products_targeted)} ciblés`}
            />
            <StatCard
              icon={TrendingUp}
              label="Offres upsertées"
              value={fmtInt(cw.offers_created + cw.offers_updated)}
              hint={`+${fmtInt(cw.offers_created)} créées · ${fmtInt(cw.offers_updated)} MAJ · ${fmtInt(cw.tiers_written)} paliers`}
            />
            <StatCard
              icon={AlertTriangle}
              label="Throttle & erreurs"
              value={`${throttleRate}%`}
              hint={`${cw.runs_throttled}/${cw.runs} runs throttled · ${cw.errors} erreurs`}
              tone={throttleTone}
            />
          </div>
        )}
        {cw && cw.last_run_at ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Dernier run : {formatDistanceToNow(new Date(cw.last_run_at), { addSuffix: true, locale: fr })} ·{" "}
            <Badge variant={cw.last_run_status === "success" ? "secondary" : "destructive"}>
              {cw.last_run_status ?? "?"}
            </Badge>{" "}
            · durée moyenne {Math.round((cw.avg_duration_ms || 0) / 1000)}s ·{" "}
            {fmtInt(cw.stale_recalculated)} offres dé-stalées
          </div>
        ) : null}
      </section>

      {/* Hourly chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produits vérifiés par heure</CardTitle>
        </CardHeader>
        <CardContent>
          {progressQ.isLoading || !p ? (
            <Skeleton className="h-64" />
          ) : p.hourly.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun run sur la fenêtre sélectionnée.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={p.hourly.map((h) => ({
                    ...h,
                    label: format(new Date(h.bucket), "HH'h' dd/MM"),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <ReTooltip
                    labelFormatter={(_, items) => {
                      const it = items?.[0]?.payload;
                      return it ? format(new Date(it.bucket), "EEE dd/MM HH'h'", { locale: fr }) : "";
                    }}
                    formatter={(v: number, name: string) => [fmtInt(v), name]}
                  />
                  <Bar dataKey="products_wide" name="catalog_wide" fill="hsl(var(--primary))" />
                  <Bar dataKey="products_basket" name="hourly basket" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derniers runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Démarré</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Produits</TableHead>
                  <TableHead className="text-right">Offres</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead className="text-right">Throttle</TableHead>
                  <TableHead className="text-right">Err.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progressQ.isLoading || !p ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-8" />
                    </TableCell>
                  </TableRow>
                ) : p.recent_runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      Aucun run récent.
                    </TableCell>
                  </TableRow>
                ) : (
                  p.recent_runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.started_at), "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.sub_mode === "catalog_wide" ? "default" : "outline"}>
                          {r.sub_mode ?? "storefront"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "success"
                              ? "secondary"
                              : r.status === "running"
                                ? "outline"
                                : "destructive"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(r.products_processed)}
                        <span className="text-muted-foreground">/{fmtInt(r.products_targeted)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt((r.offers_created ?? 0) + (r.offers_updated ?? 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.duration_ms ? `${Math.round(r.duration_ms / 1000)}s` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.throttled ? (
                          <Badge variant="destructive">×{r.throttle_hits}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.total_errors > 0 ? (
                          <span className="text-destructive">{r.total_errors}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
