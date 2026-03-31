import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, Database, Tag, Package, Store, Layers, Clock, AlertTriangle,
  Play, Settings, Eye, EyeOff, CheckCircle, XCircle, Loader2, Wifi, Search, Edit3,
  ChevronDown, ChevronUp, Zap, RotateCcw, FlaskConical,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

/* ─── Hooks ───────────────────────────────────── */

const useSyncLogs = () =>
  useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

const useQogitaConfig = () =>
  useQuery({
    queryKey: ["qogita-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qogita_config").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

const usePipelineRuns = () =>
  useQuery({
    queryKey: ["pipeline-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_pipeline_runs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 5000,
  });

const useSyncCountries = () =>
  useQuery({
    queryKey: ["sync-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("code, name, flag_emoji, qogita_sync_enabled")
        .eq("is_active", true)
        .eq("qogita_sync_enabled", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

const useLastSyncDates = () =>
  useQuery({
    queryKey: ["last-sync-dates"],
    queryFn: async () => {
      const { data: lastProducts } = await supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("status", "completed")
        .eq("sync_type", "products")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: lastOffers } = await supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("status", "completed")
        .eq("sync_type", "offers_detail")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        lastProductsSync: lastProducts?.completed_at || null,
        lastOffersSync: lastOffers?.completed_at || null,
      };
    },
    refetchInterval: 10000,
  });

/* ─── Helpers ─────────────────────────────────── */

function formatDurationStr(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? "0" : ""}${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m < 10 ? "0" : ""}${m}m`;
}

const stepIcon = (status: string) => {
  if (status === "completed") return <CheckCircle size={16} className="text-green-600" />;
  if (status === "running") return <Loader2 size={16} className="text-blue-600 animate-spin" />;
  if (status === "failed") return <XCircle size={16} className="text-red-500" />;
  if (status === "skipped") return <span className="text-[12px] text-muted-foreground">—</span>;
  return <Clock size={16} className="text-muted-foreground" />;
};

type SyncType = "categories" | "brands" | "products" | "offers_detail" | "offers_multi_vendor" | "recalculate";

/* ─── Pipeline Card ───────────────────────────── */

function PipelineRunCard({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(run.status === "running");
  const steps = (run.steps_status as any[]) || [];
  const completedSteps = steps.filter((s: any) => s.status === "completed").length;
  const pct = run.total_steps > 0 ? Math.round((completedSteps / run.total_steps) * 100) : 0;
  const duration =
    run.completed_at && run.started_at
      ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
      : run.started_at
        ? Math.round((Date.now() - new Date(run.started_at).getTime()) / 1000)
        : 0;

  const statusColor =
    run.status === "completed" ? "text-green-700 bg-green-50" :
    run.status === "failed" ? "text-red-700 bg-red-50" :
    run.status === "running" ? "text-blue-700 bg-blue-50" :
    "text-muted-foreground bg-muted";

  return (
    <div className="bg-card rounded-xl border p-4" style={{ borderColor: run.status === "running" ? "#93C5FD" : undefined }}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          {run.status === "running" ? (
            <Loader2 size={18} className="text-blue-600 animate-spin" />
          ) : run.status === "completed" ? (
            <CheckCircle size={18} className="text-green-600" />
          ) : run.status === "failed" ? (
            <XCircle size={18} className="text-red-500" />
          ) : (
            <Clock size={18} className="text-muted-foreground" />
          )}
          <div>
            <span className="text-[13px] font-bold" style={{ color: "#1E293B" }}>
              Pipeline {run.country_code}
            </span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
              {run.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]" style={{ color: "#616B7C" }}>
          <span>{run.triggered_by === "cron" ? "⏰ Cron" : "👤 Manuel"}</span>
          <span>{formatDurationStr(duration)}</span>
          <span>{format(new Date(run.created_at), "dd/MM HH:mm", { locale: fr })}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {run.status === "running" && (
        <div className="mt-3">
          <Progress value={pct} className="h-2" />
          <span className="text-[11px] mt-1 block" style={{ color: "#616B7C" }}>
            Étape {completedSteps + 1}/{run.total_steps} — {pct}%
          </span>
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-2">
          {steps.map((s: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px]"
              style={{
                backgroundColor: s.status === "running" ? "#EFF6FF" : s.status === "failed" ? "#FEF2F2" : "#F8FAFC",
              }}
            >
              {stepIcon(s.status)}
              <span className="font-medium flex-1" style={{ color: "#1E293B" }}>
                {i + 1}. {s.label || s.step}
              </span>
              {s.stats && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-white border" style={{ color: "#616B7C" }}>
                  {typeof s.stats === "object"
                    ? Object.entries(s.stats)
                        .filter(([k]) => k !== "error")
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" | ")
                    : String(s.stats)}
                </span>
              )}
              {s.completed_at && s.started_at && (
                <span className="text-[10px]" style={{ color: "#8B95A5" }}>
                  {formatDurationStr(Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000))}
                </span>
              )}
            </div>
          ))}
          {run.error_message && (
            <div className="text-[11px] text-red-600 mt-2 px-3">{run.error_message}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Running Sync Progress (individual) ──────── */

function SyncProgressBar({ log }: { log: any }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(log.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [log.started_at]);

  const current = log.progress_current || 0;
  const total = log.progress_total || 0;
  const message = log.progress_message || "Synchronisation en cours...";
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  return (
    <div className="bg-card rounded-xl border p-4 mb-4" style={{ borderColor: "#BFDBFE" }}>
      <div className="flex items-center gap-2 mb-2">
        <Loader2 size={16} className="text-blue-600 animate-spin" />
        <span className="text-[13px] font-bold capitalize" style={{ color: "#1E293B" }}>
          {log.sync_type?.replace("_", " ")} en cours
        </span>
        <span className="ml-auto text-[16px] font-bold text-blue-600">{pct}%</span>
      </div>
      <Progress value={total > 0 ? pct : undefined} className="h-2 mb-2" />
      <div className="flex justify-between text-[11px]" style={{ color: "#616B7C" }}>
        <span>{message}</span>
        <span>{formatDurationStr(elapsed)}</span>
      </div>
    </div>
  );
}

/* ─── Test API Offers Component ────────────────── */

function TestApiOffers() {
  const [gtin, setGtin] = useState("0008080153555");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const testApi = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-qogita-offers", {
        body: { gtin },
      });
      setResult(error ? { error: error.message } : data);
      setOpen(true);
    } catch (e: any) {
      setResult({ error: e.message });
      setOpen(true);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="border border-dashed border-amber-300 rounded-xl p-5 bg-amber-50/50">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical size={18} className="text-amber-600" />
          <span className="text-sm font-semibold text-foreground">Test API Qogita (Debug)</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Teste l'endpoint /offers/ pour un produit et affiche la réponse JSON brute.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={gtin}
            onChange={(e) => setGtin(e.target.value)}
            placeholder="GTIN ou EAN du produit"
            className="max-w-xs"
          />
          <button
            onClick={testApi}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
            {loading ? "Appel en cours..." : "Tester API Offers"}
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Réponse API Qogita — Test Offers</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-4">
              {result.analysis && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">Résumé</h4>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <p>Produit : {result.variant?.name}</p>
                    <p>GTIN : {result.variant?.gtin}</p>
                    <p>Nombre d'offres : <strong>{result.analysis.offersCount}</strong></p>
                    <p>Vendeurs uniques : <strong>{result.analysis.uniqueSellers}</strong></p>
                    <p>Prix min : {result.analysis.priceRange?.min}€</p>
                    <p>Prix max : {result.analysis.priceRange?.max}€</p>
                    <p>sellerCount (variant) : {result.variant?.sellerCount}</p>
                    <p>Paliers par vendeur : {result.analysis.hasMultiplePricesPerSeller ? "OUI" : "NON"}</p>
                  </div>
                </div>
              )}

              {result.analysis?.sellers?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Offres reçues de l'API</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Vendeur</th>
                          <th className="text-left p-2">Prix</th>
                          <th className="text-left p-2">MOV</th>
                          <th className="text-left p-2">Stock</th>
                          <th className="text-left p-2">QID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.analysis.sellers.map((s: any, i: number) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{s.seller}</td>
                            <td className="p-2">{s.price}€</td>
                            <td className="p-2">{s.mov}€</td>
                            <td className="p-2">{s.inventory}</td>
                            <td className="p-2 font-mono text-[10px]">{s.qid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.variant?.images?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Images ({result.variant.images.length})</h4>
                  <div className="flex gap-2 flex-wrap">
                    {result.variant.images.map((img: any, i: number) => (
                      <img key={i} src={typeof img === "string" ? img : img.url} alt="" className="h-16 w-16 object-contain rounded border" />
                    ))}
                  </div>
                </div>
              )}

              <details>
                <summary className="text-xs font-medium cursor-pointer text-muted-foreground">Réponse JSON brute complète (cliquer pour voir)</summary>
                <pre className="mt-2 text-[10px] bg-muted p-3 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Main Page ───────────────────────────────── */

export default function AdminSync() {
  const qc = useQueryClient();
  const { data: logs } = useSyncLogs();
  const { data: config } = useQogitaConfig();
  const { data: pipelineRuns } = usePipelineRuns();
  const { data: syncCountries } = useSyncCountries();
  const { data: lastSyncDates } = useLastSyncDates();
  const [selectedCountry, setSelectedCountry] = useState("BE");
  const [showManual, setShowManual] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [runningSyncs, setRunningSyncs] = useState<Set<string>>(new Set());
  const [loopProgress, setLoopProgress] = useState<Record<string, { processed: number; remaining: number; errors: number }>>({});
  const [qogitaEmail, setQogitaEmail] = useState("");
  const [qogitaPassword, setQogitaPassword] = useState("");
  const [emailDirty, setEmailDirty] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [creatingOffers, setCreatingOffers] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Check for running individual sync
  const [runningLog, setRunningLog] = useState<any>(null);
  useEffect(() => {
    const hasRunning = logs?.some((l) => l.status === "running");
    if (!hasRunning) { setRunningLog(null); return; }
    const poll = async () => {
      const { data } = await supabase
        .from("sync_logs").select("*").eq("status", "running")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      setRunningLog(data);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [logs]);

  const displayEmail = emailDirty ? qogitaEmail : (config as any)?.qogita_email || "";
  const displayPassword = passwordDirty ? qogitaPassword : (config as any)?.qogita_password || "";

  // ─ Launch pipeline
  const launchPipeline = useMutation<any, Error, { stepOnly?: string } | undefined>({
    mutationFn: async (opts?: { stepOnly?: string }) => {
      const { data, error } = await supabase.functions.invoke("run-sync-pipeline", {
        body: { country: selectedCountry, triggeredBy: "manual", ...opts },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Pipeline lancé ✅", { description: `Run ID: ${data?.runId?.slice(0, 8)}` });
      qc.invalidateQueries({ queryKey: ["pipeline-runs"] });
    },
    onError: (err: any) => toast.error("Erreur pipeline", { description: err.message }),
  });

  // ─ Individual sync (with auto-loop for offers)
  const runSyncOnce = async (type: SyncType) => {
    const fnMap: Record<string, string> = {
      recalculate: "recalculate-all-prices",
      offers_detail: "sync-qogita-offers-detail",
      offers_multi_vendor: "sync-qogita-offers-detail",
    };
    const fnName = fnMap[type] || `sync-qogita-${type}`;
    const body: any = { country: selectedCountry };
    if (type === "offers_multi_vendor") body.multi_vendor = true;
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) throw error;
    return data;
  };

  const runSyncLooping = async (type: SyncType) => {
    setRunningSyncs((prev) => new Set(prev).add(type));
    setLoopProgress((prev) => ({ ...prev, [type]: { processed: 0, remaining: 0, errors: 0 } }));

    const isLoopType = type === "offers_detail" || type === "offers_multi_vendor";

    try {
      if (!isLoopType) {
        await runSyncOnce(type);
        toast.success(`Sync ${type} lancée`);
      } else {
        // Step 1: Kick off the first call (creates or resumes sync_log)
        await runSyncOnce(type);
        const syncType = type === "offers_multi_vendor" ? "offers_multi_vendor" : "offers_detail";

        // Step 2: Poll sync_logs until completed/error; re-invoke on "partial"
        let done = false;
        while (!done) {
          await new Promise((r) => setTimeout(r, 3000));

          const { data: latestLog } = await supabase
            .from("sync_logs")
            .select("status, stats, progress_current, progress_total")
            .eq("sync_type", syncType)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const logStatus = latestLog?.status;
          const logStats = (latestLog?.stats as any) || {};
          const current = latestLog?.progress_current || 0;
          const total = latestLog?.progress_total || 0;
          const remaining = total - current;

          setLoopProgress((prev) => ({
            ...prev,
            [type]: { processed: current, remaining, errors: logStats.errors || 0 },
          }));

          if (logStatus === "completed" || logStatus === "error") {
            done = true;
          } else if (logStatus === "partial") {
            // Edge function timed out — re-invoke to resume from last_offset
            await runSyncOnce(type);
            // Continue polling
          }
          // If "running", just keep polling
        }

        toast.success(`Sync ${type} terminée`);
      }
    } catch (err: any) {
      toast.error(`Erreur sync ${type}`, { description: err.message });
    } finally {
      setRunningSyncs((prev) => { const s = new Set(prev); s.delete(type); return s; });
      setLoopProgress((prev) => { const n = { ...prev }; delete n[type]; return n; });
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
    }
  };

  const updateConfig = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("qogita_config").update(updates).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration mise à jour");
      qc.invalidateQueries({ queryKey: ["qogita-config"] });
      setEmailDirty(false);
      setPasswordDirty(false);
    },
  });

  const updateLogStatus = useMutation({
    mutationFn: async ({ logId, newStatus }: { logId: string; newStatus: string }) => {
      const updates: any = { status: newStatus };
      if (newStatus === "completed" || newStatus === "error") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("sync_logs").update(updates).eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      setEditingLogId(null);
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const email = emailDirty ? qogitaEmail : (config as any)?.qogita_email;
      const password = passwordDirty ? qogitaPassword : (config as any)?.qogita_password;
      if (!email || !password) { toast.error("Email et mot de passe requis"); return; }
      const baseUrl = config?.base_url || "https://api.qogita.com";
      const res = await fetch(`${baseUrl}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { toast.error(`Connexion échouée (${res.status})`); return; }
      const data = await res.json();
      if (data.accessToken) {
        toast.success("Connexion Qogita réussie ✅");
        const updates: any = { bearer_token: data.accessToken };
        if (emailDirty) updates.qogita_email = qogitaEmail;
        if (passwordDirty) updates.qogita_password = qogitaPassword;
        updateConfig.mutate(updates);
      }
    } catch (err: any) {
      toast.error("Erreur de connexion", { description: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const activePipeline = pipelineRuns?.find((r: any) => r.status === "running");
  const lastCompletedPipeline = pipelineRuns?.find((r: any) => r.status === "completed");

  const syncButtons: { type: SyncType; label: string; icon: React.ElementType; desc: string }[] = [
    { type: "products", label: "Produits (CSV)", icon: Package, desc: "Import CSV + auto-crée marques & catégories" },
    { type: "offers_detail", label: "Offres détail", icon: Store, desc: "Enrichissement (meilleur prix)" },
    { type: "offers_multi_vendor", label: "Offres multi-vendeurs", icon: Layers, desc: "Toutes les offres vendeurs" },
    { type: "recalculate", label: "Recalculer prix", icon: RefreshCw, desc: "Recalcule les marges" },
    { type: "brands", label: "Marques", icon: Tag, desc: "Re-sync marques" },
    { type: "categories", label: "Catégories", icon: Layers, desc: "Re-sync catégories" },
  ];

  const statusColor = (s: string) => {
    if (s === "completed") return "active";
    if (s === "error") return "error";
    if (s === "running") return "pending";
    return "inactive";
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Synchronisation Qogita" subtitle="Pipeline automatisé & gestion du catalogue" />

      {/* Running individual sync */}
      {runningLog && <SyncProgressBar log={runningLog} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Dernière sync produits"
          value={lastSyncDates?.lastProductsSync
            ? formatDistanceToNow(new Date(lastSyncDates.lastProductsSync), { addSuffix: true, locale: fr })
            : "Jamais"}
          icon={Package}
        />
        <KpiCard
          label="Dernière sync offres"
          value={lastSyncDates?.lastOffersSync
            ? formatDistanceToNow(new Date(lastSyncDates.lastOffersSync), { addSuffix: true, locale: fr })
            : "Jamais"}
          icon={Store}
        />
        <KpiCard
          label="Dernier pipeline"
          value={lastCompletedPipeline
            ? formatDistanceToNow(new Date(lastCompletedPipeline.completed_at), { addSuffix: true, locale: fr })
            : "Jamais"}
          icon={Zap}
        />
        <KpiCard
          label="Statut"
          value={activePipeline ? "Pipeline en cours" : config?.sync_status || "idle"}
          icon={activePipeline ? Loader2 : CheckCircle}
        />
      </div>

      {/* ═══════ PIPELINE SECTION ═══════ */}
      <div className="bg-card rounded-xl border p-6" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "#1E293B" }}>
              <Zap size={18} className="text-blue-600" />
              Pipeline de synchronisation
            </h3>
            <p className="text-[12px] mt-1" style={{ color: "#616B7C" }}>
              Exécute les 6 étapes dans l'ordre : CSV → Marques → Enrichissement → Offres → Prix → Recherche
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-[140px] h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(syncCountries || []).map((c: any) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.flag_emoji} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => launchPipeline.mutate(undefined)}
              disabled={launchPipeline.isPending || !!activePipeline}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {launchPipeline.isPending || activePipeline ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {activePipeline ? "Pipeline en cours..." : "Lancer pipeline complet"}
            </button>
          </div>
        </div>

        {/* Active pipeline */}
        {activePipeline && <PipelineRunCard run={activePipeline} />}

        {/* Pipeline history */}
        <div className="mt-4">
          <h4 className="text-[13px] font-semibold mb-3" style={{ color: "#1E293B" }}>
            Historique des exécutions
          </h4>
          <div className="space-y-2">
            {(pipelineRuns || [])
              .filter((r: any) => r.id !== activePipeline?.id)
              .slice(0, 5)
              .map((run: any) => (
                <PipelineRunCard key={run.id} run={run} />
              ))}
            {(!pipelineRuns || pipelineRuns.length === 0) && (
              <p className="text-[12px] text-center py-4" style={{ color: "#8B95A5" }}>
                Aucune exécution de pipeline
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ MANUAL ACTIONS (collapsible) ═══════ */}
      <div className="bg-card rounded-xl border" style={{ borderColor: "#E2E8F0" }}>
        <button
          onClick={() => setShowManual(!showManual)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-xl"
        >
          <h3 className="text-[14px] font-bold flex items-center gap-2" style={{ color: "#1E293B" }}>
            <Settings size={16} />
            Actions manuelles (avancé)
          </h3>
          {showManual ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showManual && (
          <div className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {syncButtons.map(({ type, label, icon: Icon, desc }) => {
                const isRunning = runningSyncs.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => runSyncLooping(type)}
                    disabled={isRunning}
                    className="flex flex-col items-start gap-2 p-4 border rounded-lg text-left transition-all hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50"
                    style={{ borderColor: "#E2E8F0" }}
                  >
                    <div className="flex items-center gap-2">
                      {isRunning ? <Loader2 size={14} className="text-blue-600 animate-spin" /> : <Icon size={14} className="text-blue-600" />}
                      <span className="text-[13px] font-semibold" style={{ color: "#1E293B" }}>{label}</span>
                    </div>
                    <span className="text-[11px]" style={{ color: "#8B95A5" }}>{desc}</span>
                    {loopProgress[type] && (
                      <div className="w-full mt-1">
                        <Progress value={loopProgress[type].processed + loopProgress[type].remaining > 0
                          ? Math.round((loopProgress[type].processed / (loopProgress[type].processed + loopProgress[type].remaining)) * 100)
                          : 0} className="h-1.5" />
                        <span className="text-[10px] mt-0.5 block" style={{ color: "#616B7C" }}>
                          {loopProgress[type].processed} traités • {loopProgress[type].remaining} restants • {loopProgress[type].errors} erreurs
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Utility buttons */}
            <div className="flex flex-wrap gap-3 pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
              <button
                onClick={async () => {
                  setResolving(true);
                  try {
                    await supabase.rpc("resolve_product_brands");
                    await supabase.rpc("resolve_product_categories");
                    await supabase.rpc("update_brand_product_counts");
                    toast.success("Liens résolus ✅");
                  } catch (err: any) {
                    toast.error("Erreur résolution", { description: err.message });
                  } finally {
                    setResolving(false);
                  }
                }}
                disabled={resolving}
                className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:bg-muted/50 transition-colors"
                style={{ borderColor: "#E2E8F0", color: "#1E293B" }}
              >
                {resolving ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                Résoudre liens manquants
              </button>

              <button
                onClick={async () => {
                  setCreatingOffers(true);
                  try {
                    const { data, error } = await supabase.rpc("create_offers_from_products", { _country_code: selectedCountry });
                    if (error) throw error;
                    toast.success("Offres créées ✅", { description: `${(data as any)?.offers_upserted || 0} offres` });
                    qc.invalidateQueries({ queryKey: ["sync-logs"] });
                  } catch (err: any) {
                    toast.error("Erreur", { description: err.message });
                  } finally {
                    setCreatingOffers(false);
                  }
                }}
                disabled={creatingOffers}
                className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:bg-muted/50 transition-colors"
                style={{ borderColor: "#E2E8F0", color: "#1E293B" }}
              >
                {creatingOffers ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
                Créer offres depuis produits
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ CONFIGURATION (collapsible) ═══════ */}
      <div className="bg-card rounded-xl border" style={{ borderColor: "#E2E8F0" }}>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-xl"
        >
          <h3 className="text-[14px] font-bold flex items-center gap-2" style={{ color: "#1E293B" }}>
            <Wifi size={16} />
            Configuration Qogita
          </h3>
          {showConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showConfig && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Credentials */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>Email Qogita</label>
                  <input
                    type="email"
                    value={displayEmail}
                    onChange={(e) => { setQogitaEmail(e.target.value); setEmailDirty(true); }}
                    placeholder="votre-email@example.com"
                    className="w-full text-[12px] border rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    style={{ borderColor: "#E2E8F0" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>Mot de passe Qogita</label>
                  <div className="flex gap-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={displayPassword}
                      onChange={(e) => { setQogitaPassword(e.target.value); setPasswordDirty(true); }}
                      className="flex-1 text-[12px] border rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none"
                      style={{ borderColor: "#E2E8F0" }}
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="p-2 border rounded-md hover:bg-muted/50" style={{ borderColor: "#E2E8F0" }}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      const updates: any = {};
                      if (emailDirty) updates.qogita_email = qogitaEmail;
                      if (passwordDirty) updates.qogita_password = qogitaPassword;
                      if (Object.keys(updates).length > 0) updateConfig.mutate(updates);
                    }}
                    disabled={!emailDirty && !passwordDirty}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-[12px] font-semibold disabled:opacity-40 hover:bg-blue-700"
                  >
                    Sauvegarder
                  </button>
                  <button
                    onClick={testConnection}
                    disabled={testingConnection}
                    className="flex items-center gap-1.5 px-3 py-2 border rounded-md text-[12px] font-semibold hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50"
                    style={{ borderColor: "#E2E8F0", color: "#1B5BDA" }}
                  >
                    {testingConnection ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                    Tester
                  </button>
                </div>
                <div className="pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>Bearer Token</label>
                  <div className="flex gap-2">
                    <input
                      type={showToken ? "text" : "password"}
                      value={config?.bearer_token || "Aucun token"}
                      readOnly
                      className="flex-1 text-[11px] border rounded-md px-3 py-2 bg-muted"
                      style={{ borderColor: "#E2E8F0", color: "#8B95A5" }}
                    />
                    <button onClick={() => setShowToken(!showToken)} className="p-2 border rounded-md hover:bg-muted/50" style={{ borderColor: "#E2E8F0" }}>
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[12px] font-medium" style={{ color: "#616B7C" }}>Sync automatique</span>
                  <button
                    onClick={() => updateConfig.mutate({ sync_enabled: !config?.sync_enabled })}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold ${
                      config?.sync_enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {config?.sync_enabled ? "Activé" : "Désactivé"}
                  </button>
                </div>
              </div>

              {/* Shipping mode */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-semibold" style={{ color: "#1E293B" }}>Mode de livraison</h4>
                <div className="flex gap-3">
                  {(["direct_to_customer", "via_warehouse"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateConfig.mutate({ shipping_mode: mode })}
                      className={`flex-1 p-3 border rounded-lg text-[12px] font-medium transition-all ${
                        config?.shipping_mode === mode ? "border-blue-500 bg-blue-50 text-blue-600" : ""
                      }`}
                      style={config?.shipping_mode !== mode ? { borderColor: "#E2E8F0", color: "#616B7C" } : {}}
                    >
                      {mode === "direct_to_customer" ? "Direct client" : "Via entrepôt"}
                    </button>
                  ))}
                </div>
                {config?.shipping_mode === "via_warehouse" && (
                  <div className="text-[12px] space-y-1 pt-2 border-t" style={{ borderColor: "#F1F5F9", color: "#616B7C" }}>
                    <p>{config?.warehouse_address_line1 || "Non configurée"}</p>
                    <p>{config?.warehouse_postal_code} {config?.warehouse_city}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ SYNC HISTORY ═══════ */}
      <div className="bg-card rounded-xl border" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
          <h3 className="text-[14px] font-bold" style={{ color: "#1E293B" }}>Historique des synchronisations individuelles</h3>
          <span className="text-[11px]" style={{ color: "#8B95A5" }}>{logs?.length || 0} entrées</span>
        </div>
        {!logs?.length ? (
          <div className="p-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune synchronisation</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
            <div className="hidden sm:grid grid-cols-7 gap-2 px-5 py-2 text-[11px] font-semibold" style={{ color: "#8B95A5", backgroundColor: "#F8FAFC" }}>
              <span>Type</span><span>Statut</span><span>Début</span><span>Durée</span><span className="col-span-2">Détails</span><span>Actions</span>
            </div>
            {logs.map((log) => {
              const duration = log.completed_at && log.started_at
                ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                : null;
              const stats = (log.stats as any) || {};
              const isRunning = log.status === "running";
              return (
                <div key={log.id} className="grid grid-cols-1 sm:grid-cols-7 gap-2 px-5 py-3 items-center hover:bg-muted/30">
                  <span className="text-[12px] font-medium capitalize flex items-center gap-1.5" style={{ color: "#1E293B" }}>
                    {isRunning && <Loader2 size={12} className="text-blue-600 animate-spin" />}
                    {log.sync_type?.replace("_", " ")}
                  </span>
                  <StatusBadge
                    status={statusColor(log.status)}
                    label={log.status === "completed" ? "OK" : log.status === "error" ? "Erreur" : log.status}
                  />
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>
                    {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: fr })}
                  </span>
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>
                    {duration !== null ? formatDurationStr(duration) : isRunning ? "En cours..." : "—"}
                  </span>
                  <div className="col-span-2 text-[11px]" style={{ color: "#616B7C" }}>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(stats).map(([k, v]) => (
                        <span key={k} className="bg-muted px-2 py-0.5 rounded text-[10px]">
                          {k}: <strong>{String(v)}</strong>
                        </span>
                      ))}
                      {log.error_message && <span className="text-red-500 text-[10px]">{log.error_message.slice(0, 80)}</span>}
                    </div>
                  </div>
                  <div>
                    {editingLogId === log.id ? (
                      <Select
                        defaultValue={log.status}
                        onValueChange={(v) => updateLogStatus.mutate({ logId: log.id, newStatus: v })}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <button
                        onClick={() => setEditingLogId(log.id)}
                        className="text-[11px] flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors"
                        style={{ color: "#8B95A5" }}
                      >
                        <Edit3 size={11} /> Statut
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Test API Offers */}
      <TestApiOffers />

      {/* Error banner */}
      {config?.sync_error_message && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-700">Dernière erreur</p>
            <p className="text-[12px] text-red-600 mt-1">{config.sync_error_message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
