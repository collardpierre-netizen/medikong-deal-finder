import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import KpiCard from "@/components/admin/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, MailCheck, MailX, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getVendorOnboardingModeBadgeColors,
  getVendorOnboardingModeLabel,
  type VendorOnboardingMode,
} from "@/lib/vendor-onboarding-mode-labels";

interface LogRow {
  id: string;
  vendor_id: string | null;
  mode: "create" | "attach" | "self_register";
  template_name: string;
  locale: string | null;
  recipient_email: string;
  idempotency_key: string;
  message_id: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

function modeBadge(mode: string) {
  const c = getVendorOnboardingModeBadgeColors(mode as VendorOnboardingMode);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {getVendorOnboardingModeLabel(mode as VendorOnboardingMode)}
    </span>
  );
}

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "sent") return <Badge className="bg-emerald-100 text-emerald-800">Livré</Badge>;
  if (s === "enqueued" || s === "pending") return <Badge className="bg-amber-100 text-amber-800">En file</Badge>;
  if (s === "suppressed") return <Badge className="bg-slate-200 text-slate-700">Supprimé</Badge>;
  if (s === "bounced" || s === "complained") return <Badge className="bg-orange-100 text-orange-800">{s}</Badge>;
  if (s === "failed" || s === "dlq") return <Badge className="bg-red-100 text-red-800">Échec</Badge>;
  return <Badge variant="outline">{s || "—"}</Badge>;
}

export default function AdminVendorOnboardingEmailsPage() {
  const [mode, setMode] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vendor-onboarding-email-logs", mode, status, limit],
    queryFn: async () => {
      let q = supabase
        .from("vendor_onboarding_email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (mode !== "all") q = q.eq("mode", mode);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const filteredLogs = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter(
      (l) =>
        l.recipient_email.toLowerCase().includes(s) ||
        (l.vendor_id ?? "").toLowerCase().includes(s) ||
        l.idempotency_key.toLowerCase().includes(s),
    );
  }, [logs, search]);

  // Statut de livraison final via email_send_log (dédupliqué par message_id)
  const idemKeys = filteredLogs.map((l) => l.idempotency_key);
  const { data: deliveries = {} } = useQuery({
    queryKey: ["vendor-onboarding-email-deliveries", idemKeys.join(",")],
    enabled: idemKeys.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("message_id, status, error_message, created_at")
        .in("message_id", idemKeys)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, DeliveryRow>();
      for (const row of (data ?? []) as DeliveryRow[]) {
        if (row.message_id && !latest.has(row.message_id)) latest.set(row.message_id, row);
      }
      return Object.fromEntries(latest);
    },
  });

  const kpis = useMemo(() => {
    const total = logs.length;
    const enqueued = logs.filter((l) => l.status === "enqueued").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    const delivered = logs.filter(
      (l) => (deliveries as Record<string, DeliveryRow>)[l.idempotency_key]?.status === "sent",
    ).length;
    return { total, enqueued, failed, delivered };
  }, [logs, deliveries]);

  return (
    <div>
      <AdminTopBar
        title="Emails onboarding vendeur"
        subtitle="Audit des envois (création, rattachement, auto-inscription)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Mail} label="Total" value={String(kpis.total)} />
        <KpiCard icon={MailCheck} label="Livrés" value={String(kpis.delivered)} />
        <KpiCard icon={Mail} label="En file / enqueued" value={String(kpis.enqueued)} />
        <KpiCard icon={MailX} label="Échecs" value={String(kpis.failed)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Input
          placeholder="Recherche email / vendor_id / clé"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            <SelectItem value="create">Création admin</SelectItem>
            <SelectItem value="attach">Rattachement</SelectItem>
            <SelectItem value="self_register">Auto-inscription</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="enqueued">Enqueued</SelectItem>
            <SelectItem value="failed">Échec</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[50, 100, 250, 500].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} lignes</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Rafraîchir
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" /> Chargement…
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucun envoi enregistré.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent text-xs">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Mode</th>
                <th className="text-left p-3">Template</th>
                <th className="text-left p-3">Locale</th>
                <th className="text-left p-3">Destinataire</th>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Enqueue</th>
                <th className="text-left p-3">Livraison</th>
                <th className="text-left p-3">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((l) => {
                const d = (deliveries as Record<string, DeliveryRow>)[l.idempotency_key];
                return (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(l.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                    </td>
                    <td className="p-3">{modeBadge(l.mode)}</td>
                    <td className="p-3 font-mono text-xs">{l.template_name}</td>
                    <td className="p-3 uppercase text-xs">{l.locale ?? "—"}</td>
                    <td className="p-3">{l.recipient_email}</td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">
                      {l.vendor_id ? l.vendor_id.slice(0, 8) : "—"}
                    </td>
                    <td className="p-3">{statusBadge(l.status)}</td>
                    <td className="p-3">{statusBadge(d?.status ?? null)}</td>
                    <td className="p-3 text-xs text-destructive max-w-[240px] truncate">
                      {l.error_message || d?.error_message || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        "Enqueue" = mise en file côté MediKong. "Livraison" = statut final remonté par le worker d'envoi
        (dédupliqué par clé d'idempotence sur le journal d'emails).
      </p>
    </div>
  );
}
