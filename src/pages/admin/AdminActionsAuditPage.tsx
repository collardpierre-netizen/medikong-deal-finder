import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Download, Shield, Eye, Trash2, UserCheck, Pencil, Activity } from "lucide-react";
import KpiCard from "@/components/admin/KpiCard";

interface Row {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  target_id: string | null;
  target_type: string | null;
  path: string | null;
  metadata: any;
  created_at: string;
}

const ACTION_GROUPS: Record<string, { label: string; icon: any; tone: string }> = {
  "impersonate.start":  { label: "Impersonate — début", icon: Shield,   tone: "bg-red-100 text-red-800" },
  "impersonate.stop":   { label: "Impersonate — fin",   icon: Shield,   tone: "bg-red-50 text-red-700" },
  "impersonate.page_view": { label: "Impersonate — page", icon: Eye,    tone: "bg-amber-50 text-amber-700" },
  "customer.verify":    { label: "Validation compte",    icon: UserCheck, tone: "bg-emerald-100 text-emerald-800" },
  "customer.suspend":   { label: "Suspension compte",    icon: UserCheck, tone: "bg-orange-100 text-orange-800" },
  "customer.profile_change.customer_type":       { label: "Profil — type",       icon: Pencil, tone: "bg-blue-100 text-blue-800" },
  "customer.profile_change.visibility_profile":  { label: "Profil — visibilité", icon: Pencil, tone: "bg-blue-50 text-blue-700" },
  "order.hard_delete":  { label: "Hard delete commande", icon: Trash2,  tone: "bg-red-100 text-red-800" },
  "order.commission_override": { label: "Override commission", icon: Pencil, tone: "bg-purple-100 text-purple-800" },
};

function actionMeta(a: string) {
  return ACTION_GROUPS[a] || { label: a, icon: Activity, tone: "bg-muted text-muted-foreground" };
}

function toCsv(rows: Row[]) {
  const header = ["created_at", "admin_email", "action", "target_type", "target_id", "path", "metadata"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vals = [
      r.created_at,
      r.admin_email || "",
      r.action,
      r.target_type || "",
      r.target_id || "",
      r.path || "",
      JSON.stringify(r.metadata || {}),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

export default function AdminActionsAuditPage() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [targetFilter, setTargetFilter] = useState<string>("");
  const [days, setDays] = useState<number>(30);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-audit-log", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("admin_audit_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (emailFilter && !(r.admin_email || "").toLowerCase().includes(emailFilter.toLowerCase())) return false;
      if (targetFilter && r.target_id !== targetFilter && !(r.metadata?.target_email || "").includes(targetFilter)) return false;
      return true;
    });
  }, [rows, actionFilter, emailFilter, targetFilter]);

  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    const byAdmin = new Set<string>();
    for (const r of filtered) {
      byAction[r.action] = (byAction[r.action] || 0) + 1;
      if (r.admin_email) byAdmin.add(r.admin_email);
    }
    return {
      total: filtered.length,
      admins: byAdmin.size,
      impersonate: (byAction["impersonate.start"] || 0),
      sensitive: (byAction["order.hard_delete"] || 0)
        + (byAction["customer.profile_change.customer_type"] || 0)
        + (byAction["customer.profile_change.visibility_profile"] || 0)
        + (byAction["customer.verify"] || 0)
        + (byAction["customer.suspend"] || 0),
    };
  }, [filtered]);

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allActions = Object.keys(ACTION_GROUPS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit des actions admin</h1>
          <p className="text-sm text-muted-foreground">
            Impersonate (avec pages consultées), changements de profil pro, validations/suspensions de comptes, hard delete commandes, overrides commission.
            Rétention 12 mois.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>Rafraîchir</Button>
          <Button size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Activity} label="Événements (période)" value={String(stats.total)} />
        <KpiCard icon={UserCheck} label="Admins distincts" value={String(stats.admins)} />
        <KpiCard icon={Shield} label="Impersonate (start)" value={String(stats.impersonate)} />
        <KpiCard icon={Pencil} label="Actions sensibles" value={String(stats.sensitive)} />
      </div>

      <div className="flex flex-wrap gap-3 items-end border rounded-lg p-3">
        <div>
          <Label className="text-xs">Période</Label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">24 h</SelectItem>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
              <SelectItem value="365">12 mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {allActions.map((a) => (
                <SelectItem key={a} value={a}>{actionMeta(a).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Email admin</Label>
          <Input className="w-56" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="admin@…" />
        </div>
        <div>
          <Label className="text-xs">ID cible / email cible</Label>
          <Input className="w-72" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} placeholder="uuid ou email" />
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Admin</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Cible</th>
              <th className="text-left p-3">Page</th>
              <th className="text-left p-3">Détails</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Chargement…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun événement.</td></tr>
            )}
            {filtered.map((r) => {
              const meta = actionMeta(r.action);
              const Icon = meta.icon;
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "dd/MM/yy HH:mm:ss", { locale: fr })}
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.admin_email || <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="p-3">
                    <Badge className={`${meta.tone} gap-1 border-transparent`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {r.target_type ? <Badge variant="outline" className="mr-1">{r.target_type}</Badge> : null}
                    <span className="font-mono text-[11px] text-muted-foreground">{r.target_id?.slice(0, 8) || "—"}</span>
                    {r.metadata?.target_email && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r.metadata.target_email}</div>
                    )}
                  </td>
                  <td className="p-3 text-[11px] text-muted-foreground font-mono break-all max-w-[220px]">{r.path || "—"}</td>
                  <td className="p-3 text-[11px] max-w-[320px]">
                    {r.metadata && Object.keys(r.metadata).length > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-primary">voir</summary>
                        <pre className="bg-muted p-2 rounded mt-1 overflow-x-auto text-[10px]">{JSON.stringify(r.metadata, null, 2)}</pre>
                      </details>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
