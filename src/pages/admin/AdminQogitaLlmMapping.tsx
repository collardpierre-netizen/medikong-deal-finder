/**
 * /admin/categories/qogita-mapping-llm
 *
 * Passe 2 du mapping catégories Qogita → MediKong.
 *
 * 1. Lance la classification LLM (edge function `classify-qogita-categories`)
 *    qui appelle Lovable AI Gateway (Gemini Flash Lite) par batches et écrit
 *    des propositions dans `category_llm_mapping_proposals` (status=pending).
 * 2. Permet de filtrer/trier par confiance et d'appliquer en lot via la RPC
 *    `apply_qogita_llm_mappings_bulk(min_confidence)` ou à l'unité via
 *    `apply_qogita_llm_mapping(proposal_id)`.
 *
 * Aucune action automatique : tout passe par un clic admin.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, XCircle, Loader2, Sparkles, Filter, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

type Proposal = {
  id: string;
  qogita_category_id: string;
  qogita_name: string;
  products_count: number;
  suggested_mk_slug: string | null;
  suggested_mk_category_id: string | null;
  confidence: number | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "applied";
  applied_at: string | null;
};

const AdminQogitaLlmMapping = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [bulkThreshold, setBulkThreshold] = useState<number>(0.85);
  const [batchSize, setBatchSize] = useState<number>(30);
  const [maxBatches, setMaxBatches] = useState<number>(10);
  const [forceResync, setForceResync] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [autoApplyThreshold, setAutoApplyThreshold] = useState<number>(0.9);

  const { data: proposals = [], isLoading, refetch } = useQuery({
    queryKey: ["qogita-llm-proposals", statusFilter],
    queryFn: async (): Promise<Proposal[]> => {
      let q = sb
        .from("category_llm_mapping_proposals")
        .select("id, qogita_category_id, qogita_name, products_count, suggested_mk_slug, suggested_mk_category_id, confidence, reason, status, applied_at")
        .order("products_count", { ascending: false })
        .limit(1000);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Proposal[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return proposals.filter((p) => {
      if (term && !p.qogita_name.toLowerCase().includes(term)) return false;
      if ((p.confidence ?? 0) < minConfidence) return false;
      return true;
    });
  }, [proposals, search, minConfidence]);

  const totals = useMemo(() => {
    const total = proposals.length;
    const products = proposals.reduce((s, p) => s + (p.products_count || 0), 0);
    const high = proposals.filter((p) => (p.confidence ?? 0) >= 0.85).length;
    const med = proposals.filter((p) => (p.confidence ?? 0) >= 0.6 && (p.confidence ?? 0) < 0.85).length;
    const low = proposals.filter((p) => (p.confidence ?? 0) < 0.6).length;
    return { total, products, high, med, low };
  }, [proposals]);

  const runClassify = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.functions.invoke("classify-qogita-categories", {
        body: {
          batch_size: batchSize,
          max_batches: maxBatches,
          force_resync: forceResync,
          auto_apply_threshold: autoApply ? autoApplyThreshold : null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const auto = data.auto_applied
        ? ` · auto-appliquées : ${data.auto_applied.proposals_applied} (${data.auto_applied.products_updated} produits)`
        : "";
      toast({
        title: "Classification terminée",
        description: `${data.processed} propositions générées en ${data.batches} batchs (${data.errors} erreurs)${auto}. Reste ~${data.remaining_after} cats.`,
      });
      qc.invalidateQueries({ queryKey: ["qogita-llm-proposals"] });
    },
    onError: (e: any) => {
      toast({ title: "Erreur classification", description: e.message, variant: "destructive" });
    },
  });

  const applyOne = useMutation({
    mutationFn: async (proposalId: string) => {
      const { data, error } = await sb.rpc("apply_qogita_llm_mapping", { _proposal_id: proposalId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Proposition appliquée",
        description: `${data.products_updated} produits mis à jour.`,
      });
      qc.invalidateQueries({ queryKey: ["qogita-llm-proposals"] });
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    },
  });

  const reject = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await sb
        .from("category_llm_mapping_proposals")
        .update({ status: "rejected" })
        .eq("id", proposalId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qogita-llm-proposals"] }),
  });

  const applyBulk = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("apply_qogita_llm_mappings_bulk", {
        _min_confidence: bulkThreshold,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Application en lot terminée",
        description: `${data.proposals_applied} propositions appliquées · ${data.products_updated} produits mis à jour.`,
      });
      qc.invalidateQueries({ queryKey: ["qogita-llm-proposals"] });
    },
    onError: (e: any) => {
      toast({ title: "Erreur bulk apply", description: e.message, variant: "destructive" });
    },
  });

  const confidenceBadge = (c: number | null) => {
    const v = c ?? 0;
    if (v >= 0.85) return <Badge className="bg-emerald-600">élevée · {(v * 100).toFixed(0)}%</Badge>;
    if (v >= 0.6) return <Badge variant="secondary">moyenne · {(v * 100).toFixed(0)}%</Badge>;
    return <Badge variant="destructive">faible · {(v * 100).toFixed(0)}%</Badge>;
  };

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Mapping LLM des catégories Qogita restantes"
        subtitle="Passe 2 — Gemini classifie chaque libellé Qogita non mappé vers une des 14 catégories MediKong (mk-*). Dry-run par défaut."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/categories/qogita-mapping-review">
                Revue ambiguës
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/categories/non-mappees">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour audit
              </Link>
            </Button>
          </div>
        }
      />

      {/* Bloc lancement classification */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Lancer la classification LLM</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Batch size (1-50)</label>
            <Input type="number" min={1} max={50} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Max batches / appel</label>
            <Input type="number" min={1} max={200} value={maxBatches} onChange={(e) => setMaxBatches(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={forceResync} onChange={(e) => setForceResync(e.target.checked)} />
            Re-classer celles déjà proposées
          </label>
          <Button onClick={() => runClassify.mutate()} disabled={runClassify.isPending}>
            {runClassify.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Classification…</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Lancer</>
            )}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 pt-2 border-t">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
            />
            Auto-appliquer les propositions ≥ seuil dans la foulée
          </label>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Seuil auto-apply</label>
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={autoApplyThreshold}
              onChange={(e) => setAutoApplyThreshold(Number(e.target.value))}
              disabled={!autoApply}
              className="w-32"
            />
          </div>
          {autoApply && (
            <Badge variant="secondary">
              Aliases + primary_category_id écrits direct ≥ {(autoApplyThreshold * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          ~{batchSize * maxBatches} catégories Qogita traitées par appel. Pour ~2450 cats, prévoir ~{Math.ceil(2450 / (batchSize * maxBatches))} appels.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Propositions</div>
          <div className="text-2xl font-semibold">{totals.total.toLocaleString("fr-BE")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Produits couverts</div>
          <div className="text-2xl font-semibold">{totals.products.toLocaleString("fr-BE")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Confiance ≥ 85%</div>
          <div className="text-2xl font-semibold text-emerald-600">{totals.high.toLocaleString("fr-BE")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">60-85%</div>
          <div className="text-2xl font-semibold">{totals.med.toLocaleString("fr-BE")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">&lt; 60%</div>
          <div className="text-2xl font-semibold text-destructive">{totals.low.toLocaleString("fr-BE")}</div>
        </div>
      </div>

      {/* Bulk apply */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Application en lot</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Seuil de confiance min</label>
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={bulkThreshold}
              onChange={(e) => setBulkThreshold(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Button onClick={() => applyBulk.mutate()} disabled={applyBulk.isPending} variant="default">
            {applyBulk.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Application…</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Appliquer pending ≥ {(bulkThreshold * 100).toFixed(0)}%</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Crée les aliases et reporte primary_category_id sur les produits concernés.
          </p>
        </div>
      </div>

      {/* Filtres + table */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Rechercher un libellé</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: vitamins" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Statut</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Confiance min</label>
            <Input type="number" step="0.05" min={0} max={1} value={minConfidence} onChange={(e) => setMinConfidence(Number(e.target.value))} className="w-28" />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Filter className="mr-2 h-4 w-4" /> Rafraîchir
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé Qogita</TableHead>
                <TableHead className="w-24 text-right">Produits</TableHead>
                <TableHead>Cible MK</TableHead>
                <TableHead className="w-40">Confiance</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead className="w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Aucune proposition.</TableCell></TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.qogita_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.products_count.toLocaleString("fr-BE")}</TableCell>
                    <TableCell>
                      {p.suggested_mk_slug ? (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.suggested_mk_slug}</code>
                      ) : (
                        <span className="text-muted-foreground text-xs">— (aucune)</span>
                      )}
                    </TableCell>
                    <TableCell>{confidenceBadge(p.confidence)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md">{p.reason}</TableCell>
                    <TableCell>
                      {p.status === "applied" ? (
                        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Appliquée</Badge>
                      ) : p.status === "rejected" ? (
                        <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Rejetée</Badge>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!p.suggested_mk_category_id || applyOne.isPending}
                            onClick={() => applyOne.mutate(p.id)}
                          >
                            Appliquer
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => reject.mutate(p.id)}>
                            Rejeter
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AdminQogitaLlmMapping;
