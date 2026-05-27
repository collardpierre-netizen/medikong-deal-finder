import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  Filter,
  Download,
} from "lucide-react";

type AuditRow = {
  id: string;
  category: string;
  action: string;
  severity: "info" | "warning" | "critical";
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  total_count: number;
};

type Kpis = {
  total?: number;
  critical?: number;
  warning?: number;
  by_category?: Record<string, number>;
};

const PAGE_SIZE = 50;
const CATEGORIES = ["all", "rfq_admin", "storage", "ddl", "auth_role", "other"] as const;
const SEVERITIES = ["all", "info", "warning", "critical"] as const;

const SEV_BADGE: Record<string, string> = {
  info: "bg-slate-100 text-slate-700 border-slate-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

const CAT_LABEL: Record<string, string> = {
  rfq_admin: "RFQ admin",
  storage: "Storage",
  ddl: "Schéma / DDL",
  auth_role: "Rôles admin",
  other: "Autre",
};

export function SecurityAuditPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [kpis, setKpis] = useState<Kpis>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const totalCount = rows[0]?.total_count ?? 0;

  const fetchKpis = useCallback(async () => {
    const { data } = await supabase.rpc("admin_security_audit_kpis" as never, {});
    if (data) setKpis(data as Kpis);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_security_audit_query" as never,
        {
          _category: category === "all" ? null : category,
          _severity: severity === "all" ? null : severity,
          _actor_id: null,
          _from: null,
          _to: null,
          _search: search || null,
          _limit: PAGE_SIZE,
          _offset: page * PAGE_SIZE,
        } as never,
      );
      if (rpcError) throw rpcError;
      setRows((data ?? []) as AuditRow[]);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [category, severity, search, page]);

  useEffect(() => {
    void fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = [
      "created_at",
      "category",
      "action",
      "severity",
      "actor_email",
      "actor_role",
      "target_type",
      "target_id",
      "payload",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.created_at,
          r.category,
          r.action,
          r.severity,
          r.actor_email ?? "",
          r.actor_role ?? "",
          r.target_type ?? "",
          r.target_id ?? "",
          JSON.stringify(r.payload ?? {}).replace(/"/g, '""'),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = useMemo(
    () => [
      { label: "Événements (30j)", value: kpis.total ?? 0, tone: "text-slate-900" },
      { label: "Critiques", value: kpis.critical ?? 0, tone: "text-red-700" },
      { label: "Avertissements", value: kpis.warning ?? 0, tone: "text-amber-700" },
    ],
    [kpis],
  );

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-600" />
          Audit sécurité — actions sensibles
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void fetchRows()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Rafraîchir
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-px bg-slate-200">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white p-4">
            <div className="text-xs text-slate-500">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.tone}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="p-4 border-b bg-white flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" /> Filtres
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(0); }}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "Toutes catégories" : CAT_LABEL[c] ?? c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => { setSeverity(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="Sévérité" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "Toutes sévérités" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setSearch(searchInput.trim()); setPage(0); }
          }}
          placeholder="Action, email, payload…"
          className="h-9 text-sm w-64"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => { setSearch(searchInput.trim()); setPage(0); }}
        >
          Rechercher
        </Button>
        {search && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setSearchInput(""); setSearch(""); setPage(0); }}
          >
            Effacer
          </Button>
        )}
      </div>

      {/* Table */}
      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-50 border-b">{error}</div>
      )}
      {loading && rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          Aucun événement.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2 font-medium">Date</th>
                <th className="text-left p-2 font-medium">Sév.</th>
                <th className="text-left p-2 font-medium">Catégorie</th>
                <th className="text-left p-2 font-medium">Action</th>
                <th className="text-left p-2 font-medium">Acteur</th>
                <th className="text-left p-2 font-medium">Cible</th>
                <th className="text-left p-2 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50/60 align-top">
                  <td className="p-2 whitespace-nowrap text-slate-600">
                    {new Date(r.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "medium" })}
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={SEV_BADGE[r.severity] ?? ""}>
                      {r.severity}
                    </Badge>
                  </td>
                  <td className="p-2 text-slate-700">{CAT_LABEL[r.category] ?? r.category}</td>
                  <td className="p-2 font-mono text-[11px] text-slate-900">{r.action}</td>
                  <td className="p-2 text-slate-700">
                    {r.actor_email ?? <span className="italic text-slate-400">système</span>}
                    {r.actor_role && (
                      <div className="text-[10px] text-slate-500">{r.actor_role}</div>
                    )}
                  </td>
                  <td className="p-2 text-slate-700">
                    {r.target_type && (
                      <div className="text-[10px] text-slate-500">{r.target_type}</div>
                    )}
                    <div className="font-mono text-[11px]">{r.target_id ?? "—"}</div>
                  </td>
                  <td className="p-2 max-w-md">
                    <details>
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
                        {Object.keys(r.payload ?? {}).length} champ(s)
                      </summary>
                      <pre className="mt-1 text-[10px] bg-slate-50 p-2 rounded overflow-x-auto max-h-48">
                        {JSON.stringify(r.payload ?? {}, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="p-3 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-600">
        <div>
          {totalCount.toLocaleString("fr-BE")} événement{totalCount > 1 ? "s" : ""}
          {totalCount > 0 && (
            <> · page {page + 1} / {totalPages}</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Précédent
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant →
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default SecurityAuditPanel;
