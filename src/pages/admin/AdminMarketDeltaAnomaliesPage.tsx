import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";

type AnomalyStatus = "open" | "reviewed" | "ignored" | "fixed";
type Direction = "mk_higher" | "mk_lower";

interface AnomalyRow {
  id: string;
  run_id: string;
  detected_at: string;
  offer_id: string;
  product_id: string;
  vendor_id: string | null;
  mk_pack_size: number;
  mk_unit_price: number;
  market_unit_price_median: number;
  market_sample_size: number;
  delta_abs: number;
  delta_pct: number;
  direction: Direction;
  threshold_pct: number;
  status: AnomalyStatus;
  notes: string | null;
}

interface RunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  threshold_pct: number;
  offers_scanned: number;
  offers_with_market: number;
  anomalies_found: number;
  triggered_by: string;
}

const STATUS_LABEL: Record<AnomalyStatus, string> = {
  open: "À traiter",
  reviewed: "Revue",
  ignored: "Ignoré",
  fixed: "Corrigé",
};

const STATUS_VARIANT: Record<AnomalyStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "destructive",
  reviewed: "secondary",
  ignored: "outline",
  fixed: "default",
};

function fmtPct(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Number(v).toFixed(4)} €`;
}

export default function AdminMarketDeltaAnomaliesPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const runFilter = searchParams.get("run") ?? "all";
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | "all">("open");
  const [directionFilter, setDirectionFilter] = useState<Direction | "all">("all");
  const [minPct, setMinPct] = useState<number>(15);
  const [threshold, setThreshold] = useState<number>(15);

  const { data: runs } = useQuery({
    queryKey: ["market-delta-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_delta_runs" as never)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as RunRow[];
    },
  });

  const { data: anomalies, isLoading } = useQuery({
    queryKey: ["market-delta-anomalies", runFilter, statusFilter, directionFilter, minPct],
    queryFn: async () => {
      let q = supabase.from("market_delta_anomalies" as never).select("*");
      if (runFilter !== "all") q = q.eq("run_id", runFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (directionFilter !== "all") q = q.eq("direction", directionFilter);
      const { data, error } = await q
        .gte("delta_pct", -1)
        .order("delta_pct", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? []) as unknown as AnomalyRow[];
      const min = minPct / 100;
      return rows.filter((r) => Math.abs(Number(r.delta_pct)) >= min);
    },
  });

  const { data: products } = useQuery({
    queryKey: ["market-delta-products", anomalies?.map((a) => a.product_id).join(",")],
    enabled: !!anomalies && anomalies.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((anomalies ?? []).map((a) => a.product_id)));
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, cnk_code")
        .in("id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((p: any) => [p.id as string, p]));
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ["market-delta-vendors", anomalies?.map((a) => a.vendor_id).filter(Boolean).join(",")],
    enabled: !!anomalies && anomalies.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((anomalies ?? []).map((a) => a.vendor_id).filter(Boolean) as string[]));
      if (ids.length === 0) return new Map<string, any>();
      const { data, error } = await supabase
        .from("vendors_public" as never)
        .select("id, company_name, name")
        .in("id", ids);
      if (error) throw error;
      return new Map((data ?? []).map((v: any) => [v.id as string, v]));
    },
  });

  const runJob = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "run_market_delta_anomaly_job" as never,
        { _threshold_pct: threshold / 100, _triggered_by: "manual_admin" } as never
      );
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      const found = res?.anomalies_found ?? 0;
      toast.success(`Job exécuté — ${found} anomalie(s) détectée(s)`);
      qc.invalidateQueries({ queryKey: ["market-delta-runs"] });
      qc.invalidateQueries({ queryKey: ["market-delta-anomalies"] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e?.message ?? "inconnue"}`),
  });

  const updateStatus = useMutation({
    mutationFn: async (args: { id: string; status: AnomalyStatus }) => {
      const { error } = await supabase
        .from("market_delta_anomalies" as never)
        .update({
          status: args.status,
          resolved_at: args.status === "open" ? null : new Date().toISOString(),
        } as never)
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["market-delta-anomalies"] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e?.message ?? "inconnue"}`),
  });

  const lastRun = runs?.[0];

  const exportCsv = () => {
    if (!anomalies?.length) return;
    const header = [
      "produit", "cnk", "vendeur", "pack_mk", "prix_unitaire_mk",
      "mediane_marche", "echantillon", "delta_abs", "delta_pct",
      "direction", "statut", "detecte_le",
    ];
    const lines = anomalies.map((a) => {
      const p = products?.get(a.product_id);
      const v = a.vendor_id ? vendors?.get(a.vendor_id) : null;
      return [
        p?.name ?? a.product_id,
        p?.cnk_code ?? "",
        v?.company_name ?? v?.name ?? "",
        a.mk_pack_size,
        Number(a.mk_unit_price).toFixed(4),
        Number(a.market_unit_price_median).toFixed(4),
        a.market_sample_size,
        Number(a.delta_abs).toFixed(4),
        (Number(a.delta_pct) * 100).toFixed(2),
        a.direction,
        a.status,
        a.detected_at,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `market-delta-anomalies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const list = anomalies ?? [];
    const higher = list.filter((a) => a.direction === "mk_higher").length;
    const lower = list.length - higher;
    const max = list.reduce((acc, a) => Math.max(acc, Math.abs(Number(a.delta_pct))), 0);
    return { total: list.length, higher, lower, max };
  }, [anomalies]);

  return (
    <div className="space-y-6 p-6">
      <Helmet>
        <title>Écarts prix anormaux · Admin · MediKong</title>
      </Helmet>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Écarts prix anormaux
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Détection quotidienne des offres MediKong dont le prix unitaire (HTVA) s'écarte
            de la médiane des offres externes au-delà du seuil défini.
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" disabled={!anomalies?.length}>
          <Download className="h-4 w-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Anomalies (filtre)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">MK plus cher</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.higher}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">MK moins cher</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{stats.lower}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Écart max</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{(stats.max * 100).toFixed(1)}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lancer une détection</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3 flex-wrap">
          <div>
            <Label htmlFor="threshold">Seuil (%)</Label>
            <Input
              id="threshold"
              type="number"
              min={1}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <Button onClick={() => runJob.mutate()} disabled={runJob.isPending}>
            {runJob.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Lancer maintenant
          </Button>
          {lastRun && (
            <div className="text-sm text-muted-foreground ml-2">
              Dernière exécution : {new Date(lastRun.started_at).toLocaleString("fr-FR")} —
              {" "}{lastRun.anomalies_found} anomalies sur {lastRun.offers_scanned} offres scannées
              {" "}({lastRun.triggered_by})
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Run</Label>
            <Select value={runFilter} onValueChange={(v) => setSearchParams(v === "all" ? {} : { run: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les runs</SelectItem>
                {runs?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {new Date(r.started_at).toLocaleString("fr-FR")} ({r.anomalies_found})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AnomalyStatus | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="open">À traiter</SelectItem>
                <SelectItem value="reviewed">Revue</SelectItem>
                <SelectItem value="ignored">Ignoré</SelectItem>
                <SelectItem value="fixed">Corrigé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direction</Label>
            <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as Direction | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="mk_higher">MK plus cher</SelectItem>
                <SelectItem value="mk_lower">MK moins cher</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Écart min (%)</Label>
            <Input type="number" min={0} step={1} value={minPct} onChange={(e) => setMinPct(Number(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !anomalies?.length ? (
            <div className="text-center py-12 text-muted-foreground">Aucune anomalie pour ces filtres.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Vendeur</TableHead>
                  <TableHead className="text-right">Pack MK</TableHead>
                  <TableHead className="text-right">€/u. MK</TableHead>
                  <TableHead className="text-right">Médiane marché</TableHead>
                  <TableHead className="text-right">Échantillon</TableHead>
                  <TableHead className="text-right">Écart</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((a) => {
                  const p = products?.get(a.product_id);
                  const v = a.vendor_id ? vendors?.get(a.vendor_id) : null;
                  const pct = Number(a.delta_pct);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[300px]">
                        <div className="font-medium truncate">{p?.name ?? a.product_id}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {p?.cnk_code && <span>CNK {p.cnk_code}</span>}
                          {p?.slug && (
                            <Link to={`/produit/${p.slug}`} target="_blank" className="inline-flex items-center hover:underline">
                              Voir <ExternalLink className="h-3 w-3 ml-0.5" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{v?.company_name ?? v?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">{a.mk_pack_size}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtMoney(a.mk_unit_price)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmtMoney(a.market_unit_price_median)}</TableCell>
                      <TableCell className="text-right text-sm">{a.market_sample_size}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={a.direction === "mk_higher" ? "destructive" : "default"}>
                          {fmtPct(pct)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={a.status}
                          onValueChange={(s) => updateStatus.mutate({ id: a.id, status: s as AnomalyStatus })}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">À traiter</SelectItem>
                            <SelectItem value="reviewed">Revue</SelectItem>
                            <SelectItem value="ignored">Ignoré</SelectItem>
                            <SelectItem value="fixed">Corrigé</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
