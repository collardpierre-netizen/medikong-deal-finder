import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, XCircle, ExternalLink, RefreshCw, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { ReassignCategoryDialog } from "@/components/admin/ReassignCategoryDialog";

type AnomalyRow = {
  id: string;
  product_id: string;
  current_category_id: string | null;
  suggested_category_id: string | null;
  reason: "keyword_mismatch" | "brand_outlier" | "missing_category";
  severity: string;
  score: number;
  status: string;
  details: Record<string, any>;
  detected_at: string;
  product?: { id: string; name: string; slug: string | null };
  current_cat?: { id: string; name: string } | null;
  suggested_cat?: { id: string; name: string } | null;
};

const REASON_LABEL: Record<string, string> = {
  keyword_mismatch: "Mot-clés incohérents",
  brand_outlier: "Hors-norme marque",
  missing_category: "Catégorie manquante",
};

export default function AdminCategoryAnomalies() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-category-anomalies", reasonFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("product_category_anomalies")
        .select(
          `id, product_id, current_category_id, suggested_category_id, reason, severity, score, status, details, detected_at,
           product:products!product_category_anomalies_product_id_fkey(id, name, slug),
           current_cat:categories!product_category_anomalies_current_category_id_fkey(id, name),
           suggested_cat:categories!product_category_anomalies_suggested_category_id_fkey(id, name)`
        )
        .order("detected_at", { ascending: false })
        .limit(500);
      if (reasonFilter !== "all") q = q.eq("reason", reasonFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AnomalyRow[];
    },
  });

  const detect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("detect_product_category_anomalies", {
        _product_id: null,
        _limit: null,
      });
      if (error) throw error;
      return data?.[0] as { scanned: number; flagged: number; closed: number };
    },
    onSuccess: (r) => {
      toast({
        title: "Détection terminée",
        description: `${r?.scanned ?? 0} produits scannés · ${r?.flagged ?? 0} flaggés · ${r?.closed ?? 0} clôturés`,
      });
      qc.invalidateQueries({ queryKey: ["admin-category-anomalies"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("dismiss_product_category_anomaly", { _id: id, _note: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Anomalie ignorée" });
      qc.invalidateQueries({ queryKey: ["admin-category-anomalies"] });
    },
  });

  const apply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("apply_product_category_anomaly_suggestion", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Catégorie corrigée" });
      qc.invalidateQueries({ queryKey: ["admin-category-anomalies"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const counts = useMemo(() => {
    const r = { keyword_mismatch: 0, brand_outlier: 0, missing_category: 0, total: 0 };
    (data ?? []).forEach((a) => {
      r.total++;
      r[a.reason] = (r[a.reason] ?? 0) + 1;
    });
    return r;
  }, [data]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Anomalies de catégorie</h1>
          <p className="text-sm text-muted-foreground">
            Validation automatique du mapping catégorie pour repérer les produits mal classés.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
          </Button>
          <Button onClick={() => detect.mutate()} disabled={detect.isPending}>
            {detect.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Lancer la détection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total filtré" value={counts.total} />
        <KpiCard label="Mots-clés incohérents" value={counts.keyword_mismatch} />
        <KpiCard label="Hors-norme marque" value={counts.brand_outlier} />
        <KpiCard label="Catégorie manquante" value={counts.missing_category} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les raisons</SelectItem>
            <SelectItem value="keyword_mismatch">Mot-clés incohérents</SelectItem>
            <SelectItem value="brand_outlier">Hors-norme marque</SelectItem>
            <SelectItem value="missing_category">Catégorie manquante</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Ouvertes</SelectItem>
            <SelectItem value="dismissed">Ignorées</SelectItem>
            <SelectItem value="resolved">Résolues</SelectItem>
            <SelectItem value="all">Tous statuts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{(data ?? []).length} anomalie(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucune anomalie pour ces filtres.</p>
          ) : (
            <div className="space-y-2">
              {(data ?? []).map((a) => (
                <div key={a.id} className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{REASON_LABEL[a.reason]}</Badge>
                      <Badge variant="secondary">score {Number(a.score).toFixed(2)}</Badge>
                      {a.product?.slug && (
                        <Link
                          to={`/produit/${a.product.slug}`}
                          target="_blank"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {a.product?.name ?? a.product_id} <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      {!a.product?.slug && <span className="text-sm">{a.product?.name ?? a.product_id}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Actuelle : <span className="font-medium">{a.current_cat?.name ?? "—"}</span>
                      {a.suggested_cat?.name && (
                        <> &nbsp;→&nbsp; suggérée : <span className="font-medium text-foreground">{a.suggested_cat.name}</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {a.suggested_category_id && a.status === "open" && (
                      <Button size="sm" onClick={() => apply.mutate(a.id)} disabled={apply.isPending}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Appliquer
                      </Button>
                    )}
                    {a.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => dismiss.mutate(a.id)} disabled={dismiss.isPending}>
                        <XCircle className="w-4 h-4 mr-1" /> Ignorer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
