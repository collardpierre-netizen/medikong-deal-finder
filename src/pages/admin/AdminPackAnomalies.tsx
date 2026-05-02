import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type AnomalyStatus = "open" | "acknowledged" | "false_positive" | "resolved";

interface Anomaly {
  id: string;
  source_id: string;
  product_id: string | null;
  ean: string | null;
  cnk: string | null;
  previous_pack_size: number | null;
  current_pack_size: number | null;
  pack_ratio: number | null;
  previous_raw_title: string | null;
  current_raw_title: string | null;
  detected_at: string;
  status: AnomalyStatus;
  reviewed_at: string | null;
  admin_note: string | null;
  market_price_sources?: { name: string } | null;
  products?: { name: string; slug: string } | null;
}

const STATUS_LABELS: Record<AnomalyStatus, { label: string; tone: string }> = {
  open: { label: "À traiter", tone: "bg-amber-100 text-amber-800 border-amber-300" },
  acknowledged: { label: "Vu", tone: "bg-sky-100 text-sky-800 border-sky-300" },
  false_positive: { label: "Faux positif", tone: "bg-muted text-muted-foreground border-border" },
  resolved: { label: "Résolu", tone: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

export default function AdminPackAnomalies() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | "all">("open");
  const [reviewing, setReviewing] = useState<Anomaly | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<AnomalyStatus>("acknowledged");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pack-anomalies", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("market_price_pack_anomalies" as any)
        .select(
          "id, source_id, product_id, ean, cnk, previous_pack_size, current_pack_size, pack_ratio, previous_raw_title, current_raw_title, detected_at, status, reviewed_at, admin_note, market_price_sources(name), products(name, slug)"
        )
        .order("detected_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Anomaly[];
    },
  });

  const detectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("detect_market_price_pack_anomalies" as any, {
        _source_id_filter: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const created = data?.[0]?.anomalies_created ?? 0;
      const updated = data?.[0]?.history_rows_updated ?? 0;
      toast.success(`Détection terminée — ${created} anomalie(s), ${updated} ligne(s) d'historique mise(s) à jour.`);
      qc.invalidateQueries({ queryKey: ["pack-anomalies"] });
    },
    onError: (e: any) => toast.error(`Échec : ${e.message}`),
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: { id: string; status: AnomalyStatus; note: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("market_price_pack_anomalies" as any)
        .update({
          status: vars.status,
          admin_note: vars.note || null,
          reviewed_by: u.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anomalie mise à jour.");
      setReviewing(null);
      setReviewNote("");
      qc.invalidateQueries({ queryKey: ["pack-anomalies"] });
    },
    onError: (e: any) => toast.error(`Échec : ${e.message}`),
  });

  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <Helmet><title>Anomalies de pack CERP — Admin MediKong</title></Helmet>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={22} />
            Anomalies de conditionnement
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Détection automatique des changements de pack vendeur (CERP, Febelco…) entre deux refreshs. Cf.{" "}
            <code className="text-xs">extract_pack_size_from_name_sql</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">À traiter ({openCount})</SelectItem>
              <SelectItem value="acknowledged">Vu</SelectItem>
              <SelectItem value="false_positive">Faux positifs</SelectItem>
              <SelectItem value="resolved">Résolus</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending} size="sm">
            {detectMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <RefreshCw size={14} className="mr-1.5" />}
            Lancer la détection maintenant
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={16} />Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={28} />
            Aucune anomalie {statusFilter !== "all" ? `(${STATUS_LABELS[statusFilter as AnomalyStatus]?.label.toLowerCase() ?? statusFilter})` : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Produit / EAN</th>
                  <th className="px-3 py-2 text-center">Pack avant → après</th>
                  <th className="px-3 py-2 text-center">Ratio</th>
                  <th className="px-3 py-2 text-left">Libellé actuel</th>
                  <th className="px-3 py-2 text-center">Détectée</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((a) => {
                  const st = STATUS_LABELS[a.status];
                  const productLabel = a.products?.name ?? (a.product_id ? "(produit lié)" : "(non rattaché)");
                  return (
                    <tr key={a.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{a.market_price_sources?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{productLabel}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.ean ?? a.cnk ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono tabular-nums">
                        <span className="text-muted-foreground">×{a.previous_pack_size ?? "?"}</span>
                        <span className="mx-1.5 text-muted-foreground">→</span>
                        <span className={`font-bold ${a.current_pack_size === null ? "text-destructive" : "text-foreground"}`}>
                          {a.current_pack_size === null ? "non détecté" : `×${a.current_pack_size}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {a.pack_ratio ? (
                          <Badge variant={a.pack_ratio >= 2 ? "destructive" : "secondary"}>
                            {a.pack_ratio.toFixed(2)}×
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono max-w-[280px] truncate" title={a.current_raw_title ?? ""}>
                        {a.current_raw_title ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.detected_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.tone}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewing(a);
                            setReviewNote(a.admin_note ?? "");
                            setReviewStatus(a.status === "open" ? "acknowledged" : a.status);
                          }}
                        >
                          Réviser
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Réviser l'anomalie de pack</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-border bg-muted/30 p-2">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Avant</div>
                  <div className="font-mono text-xs break-words">{reviewing.previous_raw_title ?? "—"}</div>
                  <div className="mt-1 font-bold">Pack ×{reviewing.previous_pack_size ?? "?"}</div>
                </div>
                <div className="rounded border border-amber-300 bg-amber-50 p-2">
                  <div className="text-xs uppercase text-amber-800 mb-1">Après</div>
                  <div className="font-mono text-xs break-words">{reviewing.current_raw_title ?? "—"}</div>
                  <div className="mt-1 font-bold">
                    {reviewing.current_pack_size === null ? "Pack non détecté" : `Pack ×${reviewing.current_pack_size}`}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Statut</label>
                <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as AnomalyStatus)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acknowledged">Vu (en cours d'investigation)</SelectItem>
                    <SelectItem value="false_positive">Faux positif (libellé modifié, mais même produit)</SelectItem>
                    <SelectItem value="resolved">Résolu (règle adaptée ou pack corrigé)</SelectItem>
                    <SelectItem value="open">Ré-ouvrir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Note interne</label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  placeholder="Ex: nouvelle convention CERP « 4PCS » — règle 0 ter à ajouter dans pack-size.ts"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReviewing(null)}>
                  <X size={14} className="mr-1" />Annuler
                </Button>
                <Button
                  onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, status: reviewStatus, note: reviewNote })}
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
