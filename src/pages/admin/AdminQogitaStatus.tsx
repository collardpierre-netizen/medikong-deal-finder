import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Activity, AlertTriangle, CheckCircle2, Clock, PackageX, Play, Recycle } from "lucide-react";
import QogitaReconciliationPanel from "@/components/admin/QogitaReconciliationPanel";
import { formatUpdatedAtFull } from "@/lib/format-date";
import { toast } from "sonner";

type ResyncLog = {
  id: string;
  mode: string;
  status: string;
  triggered_by: string | null;
  country_code: string | null;
  products_targeted: number | null;
  products_processed: number | null;
  mute_products_detected: number | null;
  offers_processed: number | null;
  offers_updated: number | null;
  offers_created: number | null;
  offers_deactivated: number | null;
  tiers_synced: number | null;
  errors_by_endpoint: Record<string, number> | null;
  total_errors: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
};

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "success" || s === "completed") return "default";
  if (s === "failed" || s === "needs_review") return "destructive";
  if (s === "running") return "secondary";
  return "outline";
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

const MODES = [
  "all",
  "daily_stale_refresh",
  "incremental",
  "full",
  "mute_detection",
  "manual",
  "reconciliation_sweep",
];

const STATUSES = ["all", "running", "success", "completed", "failed", "needs_review", "skipped_guardrail"];

export default function AdminQogitaStatus() {
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [staleBusy, setStaleBusy] = useState(false);
  const [sweepBusy, setSweepBusy] = useState(false);

  async function runStaleRefresh() {
    if (staleBusy) return;
    setStaleBusy(true);
    try {
      const { data, error } = await supabase.rpc("enqueue_qogita_resync_batch", {
        _batch_size: 500,
        _mode: "daily_stale_refresh",
      });
      if (error) throw error;
      const d = data as any;
      if (d?.rate_limited) {
        toast.warning(`Rate limit Qogita — ${d.available ?? 0} tokens dispo (demandé ${d.requested})`);
      } else {
        toast.success(`Batch enqueued : ${d?.enqueued ?? 0} produits`);
      }
      refetch();
    } catch (e: any) {
      toast.error(`Échec relance stale refresh : ${e?.message ?? e}`);
    } finally {
      setStaleBusy(false);
    }
  }

  async function runReconciliationSweep() {
    if (sweepBusy) return;
    setSweepBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qogita-reconcile", {
        body: { sweep: "staleness", threshold_days: 7, dry_run: false },
      });
      if (error) throw error;
      toast.success(`Reconciliation sweep déclenché${(data as any)?.deactivated != null ? ` — ${(data as any).deactivated} désactivations` : ""}`);
      refetch();
    } catch (e: any) {
      toast.error(`Échec reconciliation sweep : ${e?.message ?? e}`);
    } finally {
      setSweepBusy(false);
    }
  }


  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["qogita-resync-logs", modeFilter, statusFilter],
    queryFn: async (): Promise<ResyncLog[]> => {
      let q = supabase
        .from("qogita_resync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      if (modeFilter !== "all") q = q.eq("mode", modeFilter as any);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ResyncLog[];
    },
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return logs ?? [];
    const s = search.trim().toLowerCase();
    return (logs ?? []).filter(
      (l) =>
        l.id.toLowerCase().includes(s) ||
        (l.country_code ?? "").toLowerCase().includes(s) ||
        (l.triggered_by ?? "").toLowerCase().includes(s) ||
        (l.mode ?? "").toLowerCase().includes(s),
    );
  }, [logs, search]);

  const lastRun = logs?.[0];
  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const recent = (logs ?? []).filter((l) => new Date(l.started_at).getTime() >= cutoff);
    return {
      runs: recent.length,
      processed: recent.reduce((a, l) => a + (l.offers_processed ?? 0), 0),
      updated: recent.reduce((a, l) => a + (l.offers_updated ?? 0), 0),
      created: recent.reduce((a, l) => a + (l.offers_created ?? 0), 0),
      deactivated: recent.reduce((a, l) => a + (l.offers_deactivated ?? 0), 0),
      errors: recent.reduce((a, l) => a + (l.total_errors ?? 0), 0),
      failed: recent.filter((l) => l.status === "failed" || l.status === "needs_review").length,
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Statut sync Qogita</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des runs de synchronisation, erreurs et désactivations par <code>sync_run_id</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Rafraîchir
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Runs (24h)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{last24h.runs}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Offres traitées</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{last24h.processed.toLocaleString("fr-FR")}</div>
            <p className="text-[11px] text-muted-foreground mt-1">+{last24h.created} créées · {last24h.updated} màj</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><PackageX className="h-3 w-3" /> Désactivées (24h)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{last24h.deactivated.toLocaleString("fr-FR")}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Erreurs (24h)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" style={{ color: last24h.errors > 0 ? "#EF4444" : undefined }}>{last24h.errors}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{last24h.failed} run(s) en échec</p>
          </CardContent>
        </Card>
      </div>

      {/* Last run */}
      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Dernier run
              <Badge variant={statusVariant(lastRun.status)}>{lastRun.status}</Badge>
              <Badge variant="outline">{lastRun.mode}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">sync_run_id</div><code className="text-[11px] break-all">{lastRun.id}</code></div>
              <div><div className="text-xs text-muted-foreground">Démarré</div>{formatUpdatedAtFull(lastRun.started_at)}</div>
              <div><div className="text-xs text-muted-foreground">Terminé</div>{lastRun.completed_at ? formatUpdatedAtFull(lastRun.completed_at) : "En cours…"}</div>
              <div><div className="text-xs text-muted-foreground">Durée</div>{formatDuration(lastRun.duration_ms)}</div>
              <div><div className="text-xs text-muted-foreground">Pays</div>{lastRun.country_code ?? "—"}</div>
              <div><div className="text-xs text-muted-foreground">Déclenché par</div>{lastRun.triggered_by ?? "—"}</div>
              <div><div className="text-xs text-muted-foreground">Produits</div>{lastRun.products_processed ?? 0} / {lastRun.products_targeted ?? 0}</div>
              <div><div className="text-xs text-muted-foreground">Offres</div>{lastRun.offers_processed ?? 0} traitées · {lastRun.offers_deactivated ?? 0} ✕</div>
            </div>
            {lastRun.errors_by_endpoint && Object.keys(lastRun.errors_by_endpoint).length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">Erreurs par endpoint</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(lastRun.errors_by_endpoint).map(([ep, n]) => (
                    <Badge key={ep} variant="destructive" className="text-[11px]">{ep}: {n}</Badge>
                  ))}
                </div>
              </div>
            )}
            {lastRun.error_message && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {lastRun.error_message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Historique des runs</TabsTrigger>
          <TabsTrigger value="reconciliation">Réconciliation & désactivations</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Mode</label>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (<SelectItem key={m} value={m}>{m === "all" ? "Tous" : m}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s === "all" ? "Tous" : s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Recherche (id, pays, déclencheur…)</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: BE, daily…" />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4">Chargement…</p>
              ) : !filtered.length ? (
                <p className="text-sm text-muted-foreground p-4">Aucun run pour les filtres choisis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-2">Démarré</th>
                        <th className="text-left p-2">sync_run_id</th>
                        <th className="text-left p-2">Mode</th>
                        <th className="text-left p-2">Statut</th>
                        <th className="text-left p-2">Pays</th>
                        <th className="text-right p-2">Produits</th>
                        <th className="text-right p-2">Offres ⇄</th>
                        <th className="text-right p-2">Créées</th>
                        <th className="text-right p-2">MàJ</th>
                        <th className="text-right p-2">✕</th>
                        <th className="text-right p-2">Tiers</th>
                        <th className="text-right p-2">Erreurs</th>
                        <th className="text-right p-2">Durée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((l) => (
                        <tr key={l.id} className="border-b hover:bg-muted/20">
                          <td className="p-2 whitespace-nowrap">{new Date(l.started_at).toLocaleString("fr-FR")}</td>
                          <td className="p-2"><code className="text-[10px]">{l.id.slice(0, 8)}…</code></td>
                          <td className="p-2"><Badge variant="outline" className="text-[10px]">{l.mode}</Badge></td>
                          <td className="p-2"><Badge variant={statusVariant(l.status)} className="text-[10px]">{l.status}</Badge></td>
                          <td className="p-2">{l.country_code ?? "—"}</td>
                          <td className="p-2 text-right">{l.products_processed ?? 0}</td>
                          <td className="p-2 text-right">{l.offers_processed ?? 0}</td>
                          <td className="p-2 text-right text-emerald-600">{l.offers_created ?? 0}</td>
                          <td className="p-2 text-right">{l.offers_updated ?? 0}</td>
                          <td className="p-2 text-right text-red-600">{l.offers_deactivated ?? 0}</td>
                          <td className="p-2 text-right">{l.tiers_synced ?? 0}</td>
                          <td className="p-2 text-right" style={{ color: (l.total_errors ?? 0) > 0 ? "#EF4444" : undefined }}>{l.total_errors ?? 0}</td>
                          <td className="p-2 text-right">{formatDuration(l.duration_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <QogitaReconciliationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
