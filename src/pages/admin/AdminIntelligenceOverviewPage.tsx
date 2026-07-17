import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ArrowRight, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatUpdatedAt } from "@/lib/format-date";
import { formatMoneyFromCents, useMoneyFormat } from "@/lib/money-format";

type ModuleCode = "veille_marche" | "analytics" | "bundle";
type Status = "none" | "trial" | "active" | "expired" | "cancelled";

type Row = {
  vendor_id: string;
  vendor_name: string | null;
  module: ModuleCode;
  status: Status;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  subscription_current_period_end: string | null;
  plan_label: string | null;
  monthly_price_cents: number | null;
  is_permanent: boolean;
  has_access: boolean;
};

type VendorPivot = {
  vendor_id: string;
  vendor_name: string;
  veille_marche?: Row;
  analytics?: Row;
};

const STATUS_META: Record<Status, { label: string; cls: string; icon: any }> = {
  none:      { label: "Non activé", cls: "bg-muted text-muted-foreground", icon: Lock },
  trial:     { label: "Essai",       cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: Sparkles },
  active:    { label: "Abonné",      cls: "bg-primary text-primary-foreground", icon: CheckCircle2 },
  expired:   { label: "Expiré",      cls: "bg-amber-100 text-amber-800 border-amber-300", icon: AlertTriangle },
  cancelled: { label: "Annulé",      cls: "bg-rose-100 text-rose-800 border-rose-300", icon: AlertTriangle },
};

type StatusFilter = "all" | Status | "has_access" | "no_access";

function ModuleCell({ row, locale }: { row?: Row; locale: string }) {
  if (!row || row.status === "none") {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Lock className="h-3 w-3" /> Non activé
      </div>
    );
  }
  const meta = STATUS_META[row.status];
  const Icon = meta.icon;
  const endDate = row.trial_ends_at || row.subscription_current_period_end || null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge className={meta.cls}>
          <Icon className="h-3 w-3 mr-1" />
          {meta.label}
        </Badge>
        {row.is_permanent && <Badge variant="outline" className="text-[10px]">Permanent</Badge>}
      </div>
      {row.plan_label && (
        <div className="text-[11px] text-foreground">
          {row.plan_label}
          {row.monthly_price_cents != null && row.monthly_price_cents > 0 && (
            <span className="text-muted-foreground ml-1">
              · {formatMoneyFromCents(row.monthly_price_cents, { locale, fractionDigits: 0 })}/mois
            </span>
          )}
        </div>
      )}
      {row.status === "trial" && endDate && (
        <div className="text-[11px] text-muted-foreground">
          Essai jusqu'au <strong>{formatUpdatedAt(endDate)}</strong>
          {row.trial_days_remaining != null && (
            <span className="ml-1">· J-{row.trial_days_remaining}</span>
          )}
        </div>
      )}
      {row.status === "active" && endDate && (
        <div className="text-[11px] text-muted-foreground">
          Renouvellement le <strong>{formatUpdatedAt(endDate)}</strong>
        </div>
      )}
      {(row.status === "expired" || row.status === "cancelled") && endDate && (
        <div className="text-[11px] text-muted-foreground">
          Fin le <strong>{formatUpdatedAt(endDate)}</strong>
        </div>
      )}
    </div>
  );
}

export default function AdminIntelligenceOverviewPage() {
  const { locale } = useMoneyFormat();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [moduleScope, setModuleScope] = useState<"any" | ModuleCode>("any");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-intel-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_intelligence_status_v" as any)
        .select("*")
        .in("module", ["veille_marche", "analytics"])
        .limit(5000);
      if (error) throw error;
      return (data as unknown as Row[]) || [];
    },
  });

  const pivots: VendorPivot[] = useMemo(() => {
    const map = new Map<string, VendorPivot>();
    for (const r of rows) {
      const key = r.vendor_id;
      const existing = map.get(key) || {
        vendor_id: r.vendor_id,
        vendor_name: r.vendor_name || "—",
      };
      if (r.module === "veille_marche") existing.veille_marche = r;
      if (r.module === "analytics") existing.analytics = r;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.vendor_name.localeCompare(b.vendor_name, "fr", { sensitivity: "base" }),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pivots.filter((p) => {
      if (q && !p.vendor_name.toLowerCase().includes(q)) return false;
      const modulesToCheck: Row[] = [];
      if (moduleScope === "any" || moduleScope === "veille_marche") {
        if (p.veille_marche) modulesToCheck.push(p.veille_marche);
      }
      if (moduleScope === "any" || moduleScope === "analytics") {
        if (p.analytics) modulesToCheck.push(p.analytics);
      }
      if (statusFilter === "all") return true;
      if (statusFilter === "has_access") return modulesToCheck.some((r) => r.has_access);
      if (statusFilter === "no_access") return modulesToCheck.every((r) => !r.has_access);
      return modulesToCheck.some((r) => r.status === statusFilter);
    });
  }, [pivots, search, statusFilter, moduleScope]);

  const kpis = useMemo(() => {
    const total = pivots.length;
    let vmActive = 0, vmTrial = 0, vmExpiring = 0;
    let anActive = 0, anTrial = 0, anExpiring = 0;
    for (const p of pivots) {
      if (p.veille_marche?.status === "active" || p.veille_marche?.is_permanent) vmActive++;
      if (p.veille_marche?.status === "trial") {
        vmTrial++;
        if ((p.veille_marche?.trial_days_remaining ?? 999) <= 14) vmExpiring++;
      }
      if (p.analytics?.status === "active" || p.analytics?.is_permanent) anActive++;
      if (p.analytics?.status === "trial") {
        anTrial++;
        if ((p.analytics?.trial_days_remaining ?? 999) <= 14) anExpiring++;
      }
    }
    return { total, vmActive, vmTrial, vmExpiring, anActive, anTrial, anExpiring };
  }, [pivots]);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Aperçu Intelligence vendeurs — Admin MediKong</title>
      </Helmet>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Aperçu Intelligence vendeurs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            État des modules Veille marché et Analytics ventes pour chaque vendeur — essai restant et palier actif.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/modules-intelligence">
            Gérer paliers &amp; entitlements
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Vendeurs suivis</div>
            <div className="text-2xl font-bold mt-1">{kpis.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Veille marché</div>
            <div className="text-2xl font-bold mt-1">{kpis.vmActive + kpis.vmTrial}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.vmActive} abonnés · {kpis.vmTrial} en essai
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Analytics ventes</div>
            <div className="text-2xl font-bold mt-1">{kpis.anActive + kpis.anTrial}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {kpis.anActive} abonnés · {kpis.anTrial} en essai
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase">Essais expirant ≤ 14j</div>
            <div className="text-2xl font-bold mt-1 text-amber-700">
              {kpis.vmExpiring + kpis.anExpiring}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              VM {kpis.vmExpiring} · Analytics {kpis.anExpiring}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un vendeur…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={moduleScope} onValueChange={(v) => setModuleScope(v as any)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Tous les modules</SelectItem>
            <SelectItem value="veille_marche">Veille marché</SelectItem>
            <SelectItem value="analytics">Analytics ventes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="has_access">Accès ouvert</SelectItem>
            <SelectItem value="no_access">Accès fermé</SelectItem>
            <SelectItem value="trial">Essai en cours</SelectItem>
            <SelectItem value="active">Abonné</SelectItem>
            <SelectItem value="expired">Expiré</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
            <SelectItem value="none">Non activé</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} vendeur{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Chargement…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left w-1/4">Vendeur</th>
                  <th className="px-3 py-2.5 text-left">Veille marché</th>
                  <th className="px-3 py-2.5 text-left">Analytics ventes</th>
                  <th className="px-3 py-2.5 text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.vendor_id} className="border-t hover:bg-muted/20 align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{p.vendor_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">
                        {p.vendor_id}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ModuleCell row={p.veille_marche} locale={locale} />
                    </td>
                    <td className="px-3 py-3">
                      <ModuleCell row={p.analytics} locale={locale} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/admin/modules-intelligence?vendor=${p.vendor_id}`}>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Gérer
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                      Aucun vendeur ne correspond aux filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
