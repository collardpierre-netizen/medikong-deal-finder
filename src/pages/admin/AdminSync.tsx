import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/admin/StatusBadge";
import {
  RefreshCw, Database, Tag, Package, Store, Layers, Clock, AlertTriangle,
  Play, Settings, Eye, EyeOff, CheckCircle, XCircle, Loader2,
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

export default function AdminSync() {
  const qc = useQueryClient();
  const { data: logs, isLoading: logsLoading } = useSyncLogs();
  const { data: config } = useQogitaConfig();
  const [showToken, setShowToken] = useState(false);
  const [runningSyncs, setRunningSyncs] = useState<Set<string>>(new Set());

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
      toast.success(`Sync ${type} terminee`, { description: JSON.stringify(data?.stats || data) });
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
      toast.success("Configuration mise a jour");
      qc.invalidateQueries({ queryKey: ["qogita-config"] });
    },
  });

  const syncButtons: { type: SyncType; label: string; icon: React.ElementType; desc: string }[] = [
    { type: "categories", label: "Categories", icon: Layers, desc: "Sync arborescence Qogita" },
    { type: "brands", label: "Marques", icon: Tag, desc: "Sync marques Qogita" },
    { type: "products", label: "Produits (CSV)", icon: Package, desc: "Bulk CSV tous produits" },
    { type: "offers_detail", label: "Offres detail", icon: Store, desc: "Sync fine offre par offre" },
    { type: "recalculate", label: "Recalculer prix", icon: RefreshCw, desc: "Recalcule toutes les marges" },
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Derniere sync produits"
          value={config?.last_full_sync_at
            ? formatDistanceToNow(new Date(config.last_full_sync_at), { addSuffix: true, locale: fr })
            : "Jamais"}
          icon={Package}
        />
        <KpiCard
          label="Derniere sync offres"
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
          value={config?.shipping_mode === "via_warehouse" ? "Via entrepot" : "Direct client"}
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
              <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>Bearer Token</label>
              <div className="flex gap-2">
                <input
                  type={showToken ? "text" : "password"}
                  value={config?.bearer_token || ""}
                  readOnly
                  className="flex-1 text-[12px] border rounded-md px-3 py-2"
                  style={{ borderColor: "#E2E8F0" }}
                />
                <button onClick={() => setShowToken(!showToken)} className="p-2 border rounded-md" style={{ borderColor: "#E2E8F0" }}>
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
                className="w-full text-[12px] border rounded-md px-3 py-2"
                style={{ borderColor: "#E2E8F0" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium block mb-1" style={{ color: "#616B7C" }}>Pays par defaut</label>
              <input
                type="text"
                value={config?.default_country || "BE"}
                readOnly
                className="w-full text-[12px] border rounded-md px-3 py-2"
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
                {config?.sync_enabled ? "Active" : "Desactive"}
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
                  {mode === "direct_to_customer" ? "Direct client" : "Via entrepot MediKong"}
                </button>
              ))}
            </div>
            {config?.shipping_mode === "via_warehouse" && (
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
                <p className="text-[11px] font-semibold" style={{ color: "#616B7C" }}>Adresse entrepot</p>
                <div className="text-[12px]" style={{ color: "#1E293B" }}>
                  {config?.warehouse_address_line1 || "Non configuree"}<br />
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
          <span className="text-[11px]" style={{ color: "#8B95A5" }}>{logs?.length || 0} entrees</span>
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
              <span>Debut</span>
              <span>Duree</span>
              <span className="col-span-2">Statistiques</span>
            </div>
            {logs.map(log => {
              const duration = log.completed_at && log.started_at
                ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                : null;
              const stats = (log.stats as any) || {};
              return (
                <div key={log.id} className="grid grid-cols-1 sm:grid-cols-6 gap-2 px-5 py-3 items-center hover:bg-[#F8FAFC]">
                  <span className="text-[12px] font-medium capitalize" style={{ color: "#1E293B" }}>
                    {log.sync_type.replace("_", " ")}
                  </span>
                  <StatusBadge
                    status={statusColor(log.status)}
                    label={log.status === "completed" ? "OK" : log.status === "error" ? "Erreur" : log.status}
                  />
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>
                    {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: fr })}
                  </span>
                  <span className="text-[11px]" style={{ color: "#616B7C" }}>
                    {duration !== null ? `${duration}s` : "—"}
                  </span>
                  <div className="col-span-2 text-[11px] flex flex-wrap gap-2" style={{ color: "#616B7C" }}>
                    {Object.entries(stats).map(([k, v]) => (
                      <span key={k} className="bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {k}: <strong>{String(v)}</strong>
                      </span>
                    ))}
                    {log.error_message && (
                      <span className="text-red-500 text-[10px]">{log.error_message.slice(0, 60)}</span>
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
            <p className="text-[13px] font-semibold text-red-700">Derniere erreur de synchronisation</p>
            <p className="text-[12px] text-red-600 mt-1">{config.sync_error_message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
