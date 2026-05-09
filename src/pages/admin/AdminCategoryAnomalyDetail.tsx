import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ExternalLink, CheckCircle2, XCircle, Pencil, Loader2,
  History, Sparkles, Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReassignCategoryDialog } from "@/components/admin/ReassignCategoryDialog";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const REASON_LABEL: Record<string, string> = {
  keyword_mismatch: "Mot-clés incohérents",
  brand_outlier: "Hors-norme marque",
  missing_category: "Catégorie manquante",
};

const ACTION_LABEL: Record<string, string> = {
  detected: "Détectée",
  apply_suggestion: "Suggestion appliquée",
  reassign: "Catégorie réassignée",
  dismiss: "Ignorée",
  reopen: "Rouverte",
  note: "Note ajoutée",
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  apply_suggestion: "default",
  reassign: "default",
  dismiss: "outline",
  reopen: "secondary",
  detected: "secondary",
  note: "outline",
};

export default function AdminCategoryAnomalyDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: anomaly, isLoading } = useQuery({
    queryKey: ["admin-category-anomaly-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_category_anomalies")
        .select(
          `id, product_id, current_category_id, suggested_category_id, reason, severity, score, status,
           details, detected_at, resolved_at, dismissed_by, dismiss_note,
           product:products!product_category_anomalies_product_id_fkey(id, name, slug, brand_id),
           current_cat:categories!product_category_anomalies_current_category_id_fkey(id, name, name_fr, slug),
           suggested_cat:categories!product_category_anomalies_suggested_category_id_fkey(id, name, name_fr, slug)`
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["admin-category-anomaly-history", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_category_anomaly_actions")
        .select(
          `id, action, note, performed_at, performed_by,
           from_cat:categories!product_category_anomaly_actions_from_category_id_fkey(id, name, name_fr),
           to_cat:categories!product_category_anomaly_actions_to_category_id_fkey(id, name, name_fr)`
        )
        .eq("anomaly_id", id)
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("apply_product_category_anomaly_suggestion", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Catégorie corrigée" });
      qc.invalidateQueries({ queryKey: ["admin-category-anomaly-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-category-anomaly-history", id] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("dismiss_product_category_anomaly", { _id: id, _note: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Anomalie ignorée" });
      qc.invalidateQueries({ queryKey: ["admin-category-anomaly-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-category-anomaly-history", id] });
    },
  });

  const details = (anomaly?.details ?? {}) as Record<string, any>;
  const productTokens: string[] = useMemo(
    () => Array.isArray(details.product_tokens) ? details.product_tokens : [],
    [details.product_tokens]
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 mx-auto animate-spin" />
      </div>
    );
  }

  if (!anomaly) {
    return (
      <div className="container mx-auto py-12 space-y-4 text-center">
        <p className="text-muted-foreground">Anomalie introuvable.</p>
        <Button asChild variant="outline">
          <Link to="/admin/categories/anomalies"><ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste</Link>
        </Button>
      </div>
    );
  }

  const scorePct = Math.round(Number(anomaly.score ?? 0) * 100);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/admin/categories/anomalies"><ArrowLeft className="w-4 h-4 mr-1" /> Toutes les anomalies</Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {anomaly.product?.name ?? anomaly.product_id}
            {anomaly.product?.slug && (
              <Link to={`/produit/${anomaly.product.slug}`} target="_blank" className="text-primary">
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline">{REASON_LABEL[anomaly.reason] ?? anomaly.reason}</Badge>
            <Badge variant="secondary">Sévérité : {anomaly.severity}</Badge>
            <Badge>Statut : {anomaly.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {anomaly.suggested_category_id && anomaly.status === "open" && (
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Appliquer la suggestion
            </Button>
          )}
          <ReassignCategoryDialog
            anomaly={anomaly as any}
            trigger={<Button variant="secondary"><Pencil className="w-4 h-4 mr-1" /> Réassigner…</Button>}
          />
          {anomaly.status === "open" && (
            <Button variant="outline" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
              <XCircle className="w-4 h-4 mr-1" /> Ignorer
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Score de confiance</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{scorePct}%</div>
            <div className="h-2 mt-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, scorePct))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Plus le score est élevé, plus l'anomalie est probable.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Catégorie actuelle</CardTitle></CardHeader>
          <CardContent>
            <div className="font-medium">{anomaly.current_cat?.name_fr ?? anomaly.current_cat?.name ?? "—"}</div>
            {anomaly.current_cat?.slug && (
              <div className="text-xs text-muted-foreground mt-1">{anomaly.current_cat.slug}</div>
            )}
            {typeof details.current_overlap === "number" && (
              <div className="text-xs text-muted-foreground mt-2">
                Mots-clés en commun : <span className="font-medium text-foreground">{details.current_overlap}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Catégorie proposée
          </CardTitle></CardHeader>
          <CardContent>
            <div className="font-medium">{anomaly.suggested_cat?.name_fr ?? anomaly.suggested_cat?.name ?? "—"}</div>
            {anomaly.suggested_cat?.slug && (
              <div className="text-xs text-muted-foreground mt-1">{anomaly.suggested_cat.slug}</div>
            )}
            {typeof details.suggested_overlap === "number" && (
              <div className="text-xs text-muted-foreground mt-2">
                Mots-clés en commun : <span className="font-medium text-foreground">{details.suggested_overlap}</span>
              </div>
            )}
            {typeof details.dominant_ratio === "number" && (
              <div className="text-xs text-muted-foreground mt-2">
                Marque concentrée à <span className="font-medium text-foreground">{Math.round(details.dominant_ratio * 100)}%</span> sur cette catégorie ({details.dominant_total} produits)
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {productTokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" /> Mots-clés détectés sur le nom produit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {productTokens.map((t) => (
                <Badge key={t} variant="outline" className="font-mono text-[11px]">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> Historique des actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Aucune action enregistrée pour cette anomalie.
              <br />
              Détectée {formatDistanceToNow(new Date(anomaly.detected_at), { addSuffix: true, locale: fr })}.
            </p>
          ) : (
            <ol className="relative border-l pl-4 space-y-4">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={ACTION_VARIANT[h.action] ?? "outline"}>
                      {ACTION_LABEL[h.action] ?? h.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(h.performed_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  {(h.from_cat || h.to_cat) && (
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">{h.from_cat?.name_fr ?? h.from_cat?.name ?? "—"}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-medium">{h.to_cat?.name_fr ?? h.to_cat?.name ?? "—"}</span>
                    </div>
                  )}
                  {h.note && <div className="text-xs text-muted-foreground mt-1 italic">« {h.note} »</div>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
