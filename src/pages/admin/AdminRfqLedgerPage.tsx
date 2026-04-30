import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Download, Search, RotateCcw } from "lucide-react";
import { useRfqPlans } from "@/hooks/useRfqQuota";

type LedgerKind =
  | "consume" | "grant_admin" | "purchase_pack" | "subscribe_plan"
  | "monthly_reset" | "refund" | "expire_plan";

interface LedgerRow {
  id: string;
  user_id: string;
  kind: LedgerKind;
  delta_quota: number;
  delta_permanent: number;
  rfq_id: string | null;
  plan_id: string | null;
  performed_by_user_id: string | null;
  reason: string | null;
  metadata: any;
  created_at: string;
}

const KIND_LABEL: Record<LedgerKind, string> = {
  consume: "Conso",
  grant_admin: "Don admin",
  purchase_pack: "Achat pack",
  subscribe_plan: "Abonnement",
  monthly_reset: "Reset mensuel",
  refund: "Remboursement",
  expire_plan: "Expiration plan",
};

const KIND_BADGE_VARIANT: Record<LedgerKind, "default" | "secondary" | "destructive" | "outline"> = {
  consume: "destructive",
  grant_admin: "default",
  purchase_pack: "default",
  subscribe_plan: "default",
  monthly_reset: "outline",
  refund: "secondary",
  expire_plan: "outline",
};

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminRfqLedgerPage() {
  const { data: plans } = useRfqPlans();

  // Filtres
  const [buyerSearch, setBuyerSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>(startOfMonthIso());
  const [to, setTo] = useState<string>(todayIso());
  const [pageSize, setPageSize] = useState<number>(100);

  // Étape 1 : résoudre les user_ids correspondant à la recherche acheteur
  const buyerSearchTrim = buyerSearch.trim();
  const { data: matchedUserIds } = useQuery({
    queryKey: ["admin-rfq-ledger-buyers", buyerSearchTrim],
    enabled: buyerSearchTrim.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const term = `%${buyerSearchTrim}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, email")
        .or(`full_name.ilike.${term},company_name.ilike.${term},email.ilike.${term}`)
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((p: any) => p.id as string);
    },
  });

  // Étape 2 : ledger filtré
  const ledgerKey = [
    "admin-rfq-ledger",
    { buyerSearchTrim, planFilter, kindFilter, from, to, pageSize, ids: matchedUserIds?.length ?? 0 },
  ];
  const { data: rows, isLoading, isFetching, refetch } = useQuery({
    queryKey: ledgerKey,
    enabled: buyerSearchTrim.length < 2 || (matchedUserIds && matchedUserIds.length > 0) || buyerSearchTrim.length === 0,
    queryFn: async () => {
      let q = supabase
        .from("rfq_credit_ledger")
        .select("id, user_id, kind, delta_quota, delta_permanent, rfq_id, plan_id, performed_by_user_id, reason, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(pageSize);

      if (kindFilter !== "all") q = q.eq("kind", kindFilter as LedgerKind);
      if (planFilter !== "all") q = q.eq("plan_id", planFilter);
      if (from) q = q.gte("created_at", `${from}T00:00:00.000Z`);
      if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`);
      if (buyerSearchTrim.length >= 2 && matchedUserIds && matchedUserIds.length > 0) {
        q = q.in("user_id", matchedUserIds);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LedgerRow[];
    },
  });

  // Récupérer les profils des user_ids présents pour affichage
  const userIdsInRows = useMemo(
    () => Array.from(new Set((rows || []).map((r) => r.user_id))),
    [rows],
  );
  const { data: profilesMap } = useQuery({
    queryKey: ["admin-rfq-ledger-profiles", userIdsInRows.join(",")],
    enabled: userIdsInRows.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, email")
        .in("id", userIdsInRows);
      const map = new Map<string, { name: string; email: string | null }>();
      (data || []).forEach((p: any) => {
        map.set(p.id, {
          name: p.company_name || p.full_name || "—",
          email: p.email ?? null,
        });
      });
      return map;
    },
  });

  const planLabel = (id: string | null) => {
    if (!id) return null;
    return plans?.find((p) => p.id === id)?.label ?? id.slice(0, 8);
  };

  const totals = useMemo(() => {
    const t = { count: 0, consume: 0, grantQuota: 0, grantPerm: 0 };
    (rows || []).forEach((r) => {
      t.count += 1;
      if (r.kind === "consume") t.consume += 1;
      if (r.delta_quota > 0) t.grantQuota += r.delta_quota;
      if (r.delta_permanent > 0) t.grantPerm += r.delta_permanent;
    });
    return t;
  }, [rows]);

  function resetFilters() {
    setBuyerSearch("");
    setPlanFilter("all");
    setKindFilter("all");
    setFrom(startOfMonthIso());
    setTo(todayIso());
    setPageSize(100);
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const header = [
      "created_at", "user_id", "buyer_name", "buyer_email",
      "kind", "delta_quota", "delta_permanent",
      "plan_id", "plan_label", "rfq_id", "performed_by_user_id", "reason",
    ];
    const lines = rows.map((r) => {
      const p = profilesMap?.get(r.user_id);
      return [
        r.created_at,
        r.user_id,
        (p?.name || "").replace(/"/g, '""'),
        p?.email ?? "",
        r.kind,
        r.delta_quota,
        r.delta_permanent,
        r.plan_id ?? "",
        (planLabel(r.plan_id) ?? "").replace(/"/g, '""'),
        r.rfq_id ?? "",
        r.performed_by_user_id ?? "",
        (r.reason ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " "),
      ].map((v) => `"${String(v)}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfq-credit-ledger-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Historique crédits RFQ</h1>
          <p className="text-sm text-muted-foreground">
            Attributions, consommations, achats et expirations de crédits — filtre par acheteur, plan et période.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild size="sm">
            <Link to="/admin/rfq-credits">← Soldes acheteurs</Link>
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link to="/admin/rfq-plans">Plans RFQ</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres</CardTitle>
          <CardDescription>Recherche par nom/société/email d'acheteur, type d'opération, plan associé et plage de dates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor="buyer">Acheteur</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="buyer"
                  className="pl-8"
                  placeholder="Nom, société ou email…"
                  value={buyerSearch}
                  onChange={(e) => setBuyerSearch(e.target.value)}
                />
              </div>
              {buyerSearchTrim.length >= 2 && matchedUserIds !== undefined && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {matchedUserIds.length} acheteur{matchedUserIds.length > 1 ? "s" : ""} correspondant{matchedUserIds.length > 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="kind">Type</Label>
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {(Object.keys(KIND_LABEL) as LedgerKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="plan">Plan</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger id="plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous plans</SelectItem>
                  {(plans || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="from">Du</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">Au</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-xs">Limite</Label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger id="pageSize" className="w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[50, 100, 250, 500, 1000].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Réinitialiser
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                Rafraîchir
              </Button>
              <Button size="sm" onClick={exportCsv} disabled={!rows || rows.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Lignes</div><div className="text-2xl font-bold">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Consos</div><div className="text-2xl font-bold">{totals.consume}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Quota attribué (Σ &gt;0)</div><div className="text-2xl font-bold">+{totals.grantQuota}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Crédits attribués (Σ &gt;0)</div><div className="text-2xl font-bold">+{totals.grantPerm}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Acheteur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Δ Quota</TableHead>
                  <TableHead className="text-right">Δ Crédits</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>RFQ</TableHead>
                  <TableHead>Raison</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /> Chargement…</TableCell></TableRow>
                ) : !rows || rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune écriture pour ces filtres.</TableCell></TableRow>
                ) : (
                  rows.map((r) => {
                    const p = profilesMap?.get(r.user_id);
                    const dq = r.delta_quota;
                    const dp = r.delta_permanent;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{p?.name ?? r.user_id.slice(0, 8)}</div>
                          {p?.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={KIND_BADGE_VARIANT[r.kind]}>{KIND_LABEL[r.kind]}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${dq > 0 ? "text-emerald-600" : dq < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {dq > 0 ? `+${dq}` : dq}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${dp > 0 ? "text-emerald-600" : dp < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {dp > 0 ? `+${dp}` : dp}
                        </TableCell>
                        <TableCell className="text-xs">{planLabel(r.plan_id) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">
                          {r.rfq_id ? (
                            <code className="text-[10px]">{r.rfq_id.slice(0, 8)}</code>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={r.reason ?? ""}>
                          {r.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {rows && rows.length === pageSize && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              Limite atteinte ({pageSize} lignes). Affinez les filtres ou augmentez la limite.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
