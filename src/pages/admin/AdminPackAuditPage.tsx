import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Download, ExternalLink, Check, X, Bell } from "lucide-react";
import { toast } from "sonner";

type PackStatus =
  | "ok"
  | "external_conflict"
  | "external_vs_product_mismatch"
  | "product_vs_heuristic_mismatch"
  | "missing_product_pack_size";

interface AuditRow {
  product_id: string;
  product_name: string;
  product_slug: string | null;
  cnk_code: string | null;
  product_pack_size: number | null;
  heuristic_pack_size: number | null;
  external_pack_overrides: number[];
  effective_pack_size: number;
  effective_source: "product_pack_size" | "name_heuristic" | "fallback";
  external_offers_count: number;
  external_with_override_count: number;
  mk_offers_count: number;
  pack_resolution_status: PackStatus;
}

const STATUS_LABEL: Record<PackStatus, string> = {
  ok: "OK",
  external_conflict: "Conflit externe",
  external_vs_product_mismatch: "Externe ≠ produit",
  product_vs_heuristic_mismatch: "Produit ≠ nom",
  missing_product_pack_size: "Pack produit manquant",
};

const STATUS_VARIANT: Record<PackStatus, "default" | "secondary" | "outline" | "destructive"> = {
  ok: "outline",
  external_conflict: "destructive",
  external_vs_product_mismatch: "destructive",
  product_vs_heuristic_mismatch: "secondary",
  missing_product_pack_size: "secondary",
};

const SOURCE_LABEL: Record<AuditRow["effective_source"], string> = {
  product_pack_size: "Pack produit (admin)",
  name_heuristic: "Heuristique nom",
  fallback: "Aucun (1)",
};

export default function AdminPackAuditPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PackStatus | "all" | "issues">("issues");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["pack-audit", statusFilter, search],
    queryFn: async () => {
      let q = supabase.from("product_pack_audit_v" as never).select("*").limit(2000);
      if (statusFilter === "issues") {
        q = q.neq("pack_resolution_status", "ok");
      } else if (statusFilter !== "all") {
        q = q.eq("pack_resolution_status", statusFilter);
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`product_name.ilike.${s},cnk_code.ilike.${s}`);
      }
      const { data, error } = await q.order("pack_resolution_status").order("product_name");
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  const updatePack = useMutation({
    mutationFn: async ({ productId, packSize }: { productId: string; packSize: number | null }) => {
      const { error } = await supabase
        .from("products")
        .update({ pack_size: packSize })
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack mis à jour");
      qc.invalidateQueries({ queryKey: ["pack-audit"] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e?.message ?? "inconnue"}`),
  });

  const runAlert = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_pack_mismatch_alert_job" as never);
      if (error) throw error;
      return data as { status: string; total_issues: number };
    },
    onSuccess: (res: any) => {
      if (res?.total_issues > 0) {
        toast.success(`Alerte envoyée : ${res.total_issues} produit(s) à corriger`);
      } else {
        toast.success("Aucune incohérence détectée — pas d'alerte envoyée");
      }
    },
    onError: (e: any) => toast.error(`Erreur : ${e?.message ?? "inconnue"}`),
  });

  const stats = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      issues: list.filter((r) => r.pack_resolution_status !== "ok").length,
      missing: list.filter((r) => r.pack_resolution_status === "missing_product_pack_size").length,
      conflict: list.filter((r) => r.pack_resolution_status === "external_conflict").length,
      mismatch: list.filter((r) => r.pack_resolution_status === "external_vs_product_mismatch").length,
    };
  }, [data]);

  const exportCsv = () => {
    if (!data?.length) return;
    const header = [
      "produit", "cnk", "pack_produit", "pack_heuristique",
      "overrides_externes", "pack_effectif", "source",
      "offres_mk", "offres_externes", "statut",
    ];
    const lines = data.map((r) =>
      [
        r.product_name, r.cnk_code ?? "",
        r.product_pack_size ?? "",
        r.heuristic_pack_size ?? "",
        (r.external_pack_overrides ?? []).join("|"),
        r.effective_pack_size, r.effective_source,
        r.mk_offers_count, r.external_offers_count,
        r.pack_resolution_status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pack-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applySuggestion = (row: AuditRow) => {
    // Pour external_vs_product_mismatch : applique l'override unanime
    let suggested: number | null = null;
    if (row.pack_resolution_status === "external_vs_product_mismatch" && row.external_pack_overrides.length === 1) {
      suggested = row.external_pack_overrides[0];
    } else if (row.pack_resolution_status === "missing_product_pack_size" && row.heuristic_pack_size) {
      suggested = row.heuristic_pack_size;
    } else if (row.pack_resolution_status === "product_vs_heuristic_mismatch" && row.heuristic_pack_size) {
      suggested = row.heuristic_pack_size;
    }
    if (suggested) updatePack.mutate({ productId: row.product_id, packSize: suggested });
  };

  return (
    <div className="space-y-6 p-6">
      <Helmet>
        <title>Audit conditionnements · Admin · MediKong</title>
      </Helmet>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Audit conditionnements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue consolidée par produit : pack saisi, pack détecté par heuristique sur le nom,
            packs vus chez les vendeurs externes, et statut de cohérence.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => runAlert.mutate()} variant="default" disabled={runAlert.isPending}>
            {runAlert.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
            Lancer l'alerte maintenant
          </Button>
          <Button onClick={exportCsv} variant="outline" disabled={!data?.length}>
            <Download className="h-4 w-4 mr-2" /> Exporter CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total filtré</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">À corriger</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.issues}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pack manquant</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.missing}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Externe ≠ produit</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.mismatch}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Conflits externes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.conflict}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtres</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Recherche (nom / CNK)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: fresubin, 0123456" />
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="issues">À corriger uniquement</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="missing_product_pack_size">Pack produit manquant</SelectItem>
                <SelectItem value="external_vs_product_mismatch">Externe ≠ produit</SelectItem>
                <SelectItem value="product_vs_heuristic_mismatch">Produit ≠ nom</SelectItem>
                <SelectItem value="external_conflict">Conflit entre externes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.length ? (
            <div className="text-center py-12 text-muted-foreground">Aucun produit pour ces filtres.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">Produit</TableHead>
                  <TableHead className="text-right">pack_size</TableHead>
                  <TableHead className="text-right">Heuristique nom</TableHead>
                  <TableHead className="text-right">Overrides externes</TableHead>
                  <TableHead className="text-right">Pack effectif</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">MK / Ext</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Édition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => {
                  const editVal = editing[r.product_id] ?? "";
                  return (
                    <TableRow key={r.product_id}>
                      <TableCell>
                        <div className="font-medium">{r.product_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {r.cnk_code && <span>CNK {r.cnk_code}</span>}
                          {r.product_slug && (
                            <Link to={`/produit/${r.product_slug}`} target="_blank" className="inline-flex items-center hover:underline">
                              Voir <ExternalLink className="h-3 w-3 ml-0.5" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.product_pack_size ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.heuristic_pack_size ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {r.external_pack_overrides.length === 0
                          ? "—"
                          : r.external_pack_overrides.join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">{r.effective_pack_size}</TableCell>
                      <TableCell className="text-xs">{SOURCE_LABEL[r.effective_source]}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.mk_offers_count} / {r.external_offers_count}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.pack_resolution_status]}>
                          {STATUS_LABEL[r.pack_resolution_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            placeholder={String(r.product_pack_size ?? "")}
                            value={editVal}
                            onChange={(e) =>
                              setEditing((s) => ({ ...s, [r.product_id]: e.target.value }))
                            }
                            className="w-16 h-8"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!editVal || updatePack.isPending}
                            onClick={() => {
                              const n = Number(editVal);
                              if (!Number.isFinite(n) || n < 1) return;
                              updatePack.mutate({ productId: r.product_id, packSize: n });
                              setEditing((s) => {
                                const c = { ...s };
                                delete c[r.product_id];
                                return c;
                              });
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          {r.pack_resolution_status !== "ok" &&
                            (r.external_pack_overrides.length === 1 || r.heuristic_pack_size) && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatePack.isPending}
                                onClick={() => applySuggestion(r)}
                                title="Appliquer la suggestion (override externe unanime ou heuristique)"
                              >
                                Auto
                              </Button>
                            )}
                        </div>
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
