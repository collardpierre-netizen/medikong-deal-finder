import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, Database, Tag, Package, Store, Layers, Clock, AlertTriangle,
  Play, Settings, Eye, EyeOff, CheckCircle, XCircle, Loader2, Wifi, Search, Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

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

type SyncType = "categories" | "brands" | "products" | "offers_detail" | "recalculate";

// ─── SyncProgressBar ─────────────────────────────
function SyncProgressBar({ log }: { log: any }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(log.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [log.started_at]);

  const current = (log as any).progress_current || 0;
  const total = (log as any).progress_total || 0;
  const message = (log as any).progress_message || "Synchronisation en cours...";
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

  // Estimate remaining time
  const speed = elapsed > 0 && current > 0 ? current / elapsed : 0;
  const remaining = speed > 0 && total > current ? Math.round((total - current) / speed) : 0;

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec < 10 ? "0" : ""}${sec}s`;
  };

  return (
    <div className="bg-white rounded-xl border p-5 mb-5" style={{ borderColor: "#BFDBFE" }}>
      <div className="flex items-center gap-3 mb-3">
        <Loader2 size={18} className="text-[#2563EB] animate-spin" />
        <span className="text-[14px] font-bold capitalize" style={{ color: "#1E293B" }}>
          {log.sync_type.replace("_", " ")} en cours
        </span>
        <span className="ml-auto text-[20px] font-bold" style={{ color: "#2563EB" }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full overflow-hidden mb-3" style={{ backgroundColor: "#EFF6FF" }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${total > 0 ? pct : 100}%`,
            backgroundColor: "#2563EB",
            ...(total === 0 ? { animation: "pulse 2s ease-in-out infinite" } : {}),
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[12px]" style={{ color: "#616B7C" }}>
        <span>{message}</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <Clock size={12} /> Durée : {formatDuration(elapsed)}
          </span>
          {remaining > 0 && (
            <span>~{formatDuration(remaining)} restant</span>
          )}
        </div>
      </div>

      {total > 0 && (
        <div className="mt-2 text-[11px]" style={{ color: "#8B95A5" }}>
          {current.toLocaleString()} / {total.toLocaleString()} éléments
        </div>
      )}
    </div>
  );
}

// ─── Format duration for history ─────────────────
function formatDurationStr(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

export default function AdminSync() {
  const qc = useQueryClient();
  const { data: logs, isLoading: logsLoading } = useSyncLogs();
  const { data: config } = useQogitaConfig();
  const [showToken, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [runningSyncs, setRunningSyncs] = useState<Set<string>>(new Set());
  const [qogitaEmail, setQogitaEmail] = useState("");
  const [qogitaPassword, setQogitaPassword] = useState("");
  const [emailDirty, setEmailDirty] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [meiliSyncing, setMeiliSyncing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Polling for running sync progress
  const [runningLog, setRunningLog] = useState<any>(null);

  useEffect(() => {
    const hasRunning = logs?.some(l => l.status === "running");
    if (!hasRunning) {
      setRunningLog(null);
      return;
    }

    const poll = async () => {
      const { data } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setRunningLog(data);
      else setRunningLog(null);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [logs]);

  // Initialize local state from config
  const displayEmail = emailDirty ? qogitaEmail : ((config as any)?.qogita_email || "");
  const displayPassword = passwordDirty ? qogitaPassword : ((config as any)?.qogita_password || "");

  const runSync = useMutation({
    mutationFn: async (type: SyncType) => {
      setRunningSyncs(prev => new Set(prev).add(type));
      const fnName = type === "recalculate" ? "recalculate-all-prices" : `sync-qogita-${type}`;
      const { data, error } = await supabase.functions.invoke(fnName);
      if (error) throw error;
      return data;
    },
    onSuccess: (data, type) => {
      setRunningSyncs(prev => { const s = new Set(prev); s.delete(type); return s; });
      toast.success(`Sync ${type} terminée`, { description: JSON.stringify(data?.stats || data) });
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
      qc.invalidateQueries({ queryKey: ["qogita-config"] });
    },
    onError: (err: any, type) => {
      setRunningSyncs(prev => { const s = new Set(prev); s.delete(type); return s; });
      toast.error(`Erreur sync ${type}`, { description: err.message });
    },
  });

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

  const saveCredentials = () => {
    const updates: any = {};
    if (emailDirty) updates.qogita_email = qogitaEmail;
    if (passwordDirty) updates.qogita_password = qogitaPassword;
    if (Object.keys(updates).length > 0) {
      updateConfig.mutate(updates);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const email = emailDirty ? qogitaEmail : (config as any)?.qogita_email;
      const password = passwordDirty ? qogitaPassword : (config as any)?.qogita_password;
      
      if (!email || !password) {
        toast.error("Email et mot de passe Qogita requis");
        return;
      }

      const baseUrl = config?.base_url || "https://api.qogita.com";
      const res = await fetch(`${baseUrl}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errText = await res.text();
        toast.error(`Connexion échouée (${res.status})`, { description: errText.slice(0, 100) });
        return;
      }

      const data = await res.json();
      if (data.accessToken) {
        toast.success("Connexion Qogita réussie ✅", { description: "Token obtenu avec succès" });
        const updates: any = { bearer_token: data.accessToken };
        if (emailDirty) updates.qogita_email = qogitaEmail;
        if (passwordDirty) updates.qogita_password = qogitaPassword;
        updateConfig.mutate(updates);
      } else {
        toast.error("Réponse inattendue", { description: "Pas de accessToken dans la réponse" });
      }
    } catch (err: any) {
      toast.error("Erreur de connexion", { description: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const syncButtons: { type: SyncType; label: string; icon: React.ElementType; desc: string }[] = [
    { type: "products", label: "Produits (CSV)", icon: Package, desc: "PRINCIPAL — Import CSV BE + auto-crée marques & catégories" },
    { type: "offers_detail", label: "Offres détail", icon: Store, desc: "Enrichissement — sync offre par offre" },
    { type: "recalculate", label: "Recalculer prix", icon: RefreshCw, desc: "Recalcule toutes les marges" },
    { type: "brands", label: "Marques", icon: Tag, desc: "Optionnel — re-sync marques depuis produits" },
    { type: "categories", label: "Catégories", icon: Layers, desc: "Optionnel — re-sync catégories depuis produits" },
  ];

  const statusColor = (s: string) => {
    if (s === "completed") return "active";
    if (s === "error") return "error";
    if (s === "running") return "pending";
    return "inactive";
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Synchronisation Qogita" subtitle="Gestion du catalogue et des offres Qogita" />

      {/* Running sync progress bar */}
      {runningLog && <SyncProgressBar log={runningLog} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Dernière sync produits"
          value={config?.last_full_sync_at
            ? formatDistanceToNow(new Date(config.last_full_sync_at), { addSuffix: true, locale: fr })
            : "Jamais"}
          icon={Package}
        />
        <KpiCard
          label="Dernière sync offres"
          value={config?.last_offers_sync_at
            ? formatDistanceToNow(new Date(config.last_offers_sync_at), { addSuffix: true, locale: fr })
            : "Jamais"}
          icon={Store}
        />
        <KpiCard
          label="Statut sync"
          value={config?.sync_status || "idle"}
          icon={config?.sync_status === "error" ? AlertTriangle : CheckCircle}
        />
        <KpiCard
          label="Mode livraison"
          value={config?.shipping_mode === "via_warehouse" ? "Via entrepôt" : "Direct client"}
          icon={Database}
        />
      </div>

      {/* Sync Actions */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E2E8F0" }}>
        <h3 className="text-[15px] font-bold mb-4" style={{ color: "#1E293B" }}>Actions de synchronisation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {syncButtons.map(({ type, label, icon: Icon, desc }) => {
            const isRunning = runningSyncs.has(type);
            return (
              <button
                key={type}
                onClick={() => runSync.mutate(type)}
                disabled={isRunning}
                className="flex flex-col items-start gap-2 p-4 border rounded-lg text-left transition-all hover:border-[#1B5BDA] hover:bg-[#EFF6FF] disabled:opacity-50"
                style={{ borderColor: "#E2E8F0" }}
              >
                <div className="flex items-center gap-2">
                  {isRunning ? <Loader2 size={16} className="text-[#1B5BDA] animate-spin" /> : <Icon size={16} className="text-[#1B5BDA]" />}
                  <span className="text-[13px] font-semibold" style={{ color: "#1E293B" }}>{label}</span>
                </div>
                <span className="text-[11px]" style={{ color: "#8B95A5" }}>{desc}</span>
                {isRunning && <span className="text-[11px] text-[#1B5BDA] font-medium">En cours...</span>}
              </button>
            );
          })}
      </div>

      {/* Meilisearch Sync */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E2E8F0" }}>
        <h3 className="text-[15px] font-bold mb-3" style={{ color: "#1E293B" }}>
          <Search size={16} className="inline mr-2" />Meilisearch — Moteur de recherche
        </h3>
        <p className="text-[12px] mb-4" style={{ color: "#8B95A5" }}>
          Synchronise les produits, marques et catégories vers Meilisearch pour la recherche instantanée.
        </p>
        <button
          onClick={async () => {
            setMeiliSyncing(true);
            try {
              const { data, error } = await supabase.functions.invoke("sync-meilisearch", {
                body: { action: "full-sync" },
              });
              if (error) throw error;
              toast.success("Sync Meilisearch terminée ✅", {
                description: `${data?.synced?.products || 0} produits, ${data?.synced?.brands || 0} marques, ${data?.synced?.categories || 0} catégories`,
              });
            } catch (err: any) {
              toast.error("Erreur sync Meilisearch", { description: err.message });
            } finally {
              setMeiliSyncing(false);
            }
          }}
          disabled={meiliSyncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B5BDA] text-white rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:bg-[#1549B5] transition-colors"
        >
          {meiliSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {meiliSyncing ? "Synchronisation en cours..." : "Sync complète Meilisearch"}
        </button>
        <button
          onClick={async () => {
            setResolving(true);
            try {
              await supabase.rpc("resolve_product_brands");
              await supabase.rpc("resolve_product_categories");
              await supabase.rpc("update_brand_product_counts");
              toast.success("Liens résolus ✅", { description: "brand_id, category_id et compteurs mis à jour" });
            } catch (err: any) {
              toast.error("Erreur résolution", { description: err.message });
            } finally {
              setResolving(false);
            }
          }}
          disabled={resolving}
          className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:bg-[#F8FAFC] transition-colors"
          style={{ borderColor: "#E2E8F0", color: "#1E293B" }}
        >
          {resolving ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
          {resolving ? "Résolution en cours..." : "Résoudre liens manquants"}
        </button>
      </div>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Qogita Config */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[15px] font-bold mb-4" style={{ color: "#1E293B" }}>
            <Settings size={16} className="inline mr-2" />Configuration Qogita
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>Email Qogita</label>
              <input
                type="email"
                value={displayEmail}
                onChange={(e) => { setQogitaEmail(e.target.value); setEmailDirty(true); }}
                placeholder="votre-email@example.com"
                className="w-full text-[12px] border rounded-md px-3 py-2 focus:border-[#1B5BDA] focus:outline-none focus:ring-1 focus:ring-[#1B5BDA]"
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
                  placeholder="••••••••"
                  className="flex-1 text-[12px] border rounded-md px-3 py-2 focus:border-[#1B5BDA] focus:outline-none focus:ring-1 focus:ring-[#1B5BDA]"
                  style={{ borderColor: "#E2E8F0" }}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="p-2 border rounded-md hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveCredentials}
                disabled={!emailDirty && !passwordDirty}
                className="flex-1 px-3 py-2 bg-[#1B5BDA] text-white rounded-md text-[12px] font-semibold disabled:opacity-40 hover:bg-[#1549B5] transition-colors"
              >
                Sauvegarder
              </button>
              <button
                onClick={testConnection}
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-3 py-2 border rounded-md text-[12px] font-semibold hover:bg-[#EFF6FF] hover:border-[#1B5BDA] transition-colors disabled:opacity-50"
                style={{ borderColor: "#E2E8F0", color: "#1B5BDA" }}
              >
                {testingConnection ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                Tester la connexion
              </button>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
              <label className="text-[11px] font-medium block mb-1" style={{ color: "#8B95A5" }}>
                Bearer Token (auto-généré)
              </label>
              <div className="flex gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  value={config?.bearer_token || "Aucun token — testez la connexion"}
                  readOnly
                  className="flex-1 text-[11px] border rounded-md px-3 py-2 bg-[#F8FAFC]"
                  style={{ borderColor: "#E2E8F0", color: "#8B95A5" }}
                />
                <button onClick={() => setShowToken(!showToken)} className="p-2 border rounded-md hover:bg-[#F8FAFC]" style={{ borderColor: "#E2E8F0" }}>
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>URL de base</label>
              <input
                type="text"
                value={config?.base_url || ""}
                readOnly
                className="w-full text-[12px] border rounded-md px-3 py-2 bg-[#F8FAFC]"
                style={{ borderColor: "#E2E8F0" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>Pays par défaut</label>
              <input
                type="text"
                value={config?.default_country || "BE"}
                readOnly
                className="w-full text-[12px] border rounded-md px-3 py-2 bg-[#F8FAFC]"
                style={{ borderColor: "#E2E8F0" }}
              />
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
        </div>

        {/* Shipping Mode */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#E2E8F0" }}>
          <h3 className="text-[15px] font-bold mb-4" style={{ color: "#1E293B" }}>Mode de livraison Qogita</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              {(["direct_to_customer", "via_warehouse"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => updateConfig.mutate({ shipping_mode: mode })}
                  className={`flex-1 p-3 border rounded-lg text-[12px] font-medium transition-all ${
                    config?.shipping_mode === mode ? "border-[#1B5BDA] bg-[#EFF6FF] text-[#1B5BDA]" : ""
                  }`}
                  style={config?.shipping_mode !== mode ? { borderColor: "#E2E8F0", color: "#616B7C" } : {}}
                >
                  {mode === "direct_to_customer" ? "Direct client" : "Via entrepôt MediKong"}
                </button>
              ))}
            </div>
            {config?.shipping_mode === "via_warehouse" && (
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
                <p className="text-[11px] font-semibold" style={{ color: "#616B7C" }}>Adresse entrepôt</p>
                <div className="text-[12px]" style={{ color: "#1E293B" }}>
                  {config?.warehouse_address_line1 || "Non configurée"}<br />
                  {config?.warehouse_postal_code} {config?.warehouse_city}<br />
                  {config?.warehouse_country_code}
                </div>
                <p className="text-[11px]" style={{ color: "#616B7C" }}>
                  Contact : {config?.warehouse_contact_name || "—"} / {config?.warehouse_contact_phone || "—"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-xl border" style={{ borderColor: "#E2E8F0" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#F1F5F9" }}>
          <h3 className="text-[14px] font-bold" style={{ color: "#1E293B" }}>Historique des synchronisations</h3>
          <span className="text-[11px]" style={{ color: "#8B95A5" }}>{logs?.length || 0} entrées</span>
        </div>

        {logsLoading ? (
          <div className="p-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Chargement...</div>
        ) : !logs?.length ? (
          <div className="p-8 text-center text-[13px]" style={{ color: "#8B95A5" }}>Aucune synchronisation</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
            {/* Header */}
            <div className="hidden sm:grid grid-cols-6 gap-2 px-5 py-2 text-[11px] font-semibold" style={{ color: "#8B95A5", backgroundColor: "#F8FAFC" }}>
              <span>Type</span>
              <span>Statut</span>
              <span>Début</span>
              <span>Durée</span>
              <span className="col-span-2">Détails</span>
            </div>
            {logs.map(log => {
              const duration = log.completed_at && log.started_at
                ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                : null;
              const stats = (log.stats as any) || {};
              const isRunning = log.status === "running";
              const progressMsg = (log as any).progress_message;
              const progressCurrent = (log as any).progress_current || 0;
              const progressTotal = (log as any).progress_total || 0;
              const pct = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

              return (
                <div key={log.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 px-5 py-3 items-center hover:bg-[#F8FAFC]">
                  <span className="text-[12px] font-medium capitalize flex items-center gap-1.5" style={{ color: "#1E293B" }}>
                    {isRunning && <Loader2 size={12} className="text-[#2563EB] animate-spin" />}
                    {log.sync_type.replace("_", " ")}
                  </span>
                  <StatusBadge
                    status={statusColor(log.status)}
                    label={log.status === "completed" ? "OK" : log.status === "error" ? "Erreur" : log.status === "partial" ? "Partiel" : log.status}
                  />
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>
                    {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: fr })}
                  </span>
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>
                    {duration !== null ? formatDurationStr(duration) : isRunning ? "En cours..." : "—"}
                  </span>
                  <div className="col-span-2 text-[11px]" style={{ color: "#616B7C" }}>
                    {isRunning && progressTotal > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EFF6FF" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#2563EB" }} />
                          </div>
                          <span className="text-[10px] font-semibold" style={{ color: "#2563EB" }}>{pct}%</span>
                        </div>
                        {progressMsg && <span className="text-[10px]">{progressMsg}</span>}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(stats).map(([k, v]) => (
                          <span key={k} className="bg-[#F1F5F9] px-2 py-0.5 rounded text-[10px]">
                            {k}: <strong>{String(v)}</strong>
                          </span>
                        ))}
                        {log.error_message && (
                          <span className="text-red-500 text-[10px]">{log.error_message.slice(0, 80)}</span>
                        )}
                        {duration !== null && Object.keys(stats).length > 0 && (
                          <span className="bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded text-[10px] font-medium">
                            durée: {formatDurationStr(duration)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {config?.sync_error_message && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-red-700">Dernière erreur de synchronisation</p>
            <p className="text-[12px] text-red-600 mt-1">{config.sync_error_message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
