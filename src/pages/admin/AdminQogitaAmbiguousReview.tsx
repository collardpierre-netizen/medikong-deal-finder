/**
 * /admin/categories/qogita-mapping-review
 *
 * Revue ciblée des propositions LLM "ambiguës" (confiance medium par défaut
 * 0.5-0.85) avec possibilité de **corriger la cible MK** avant d'appliquer.
 *
 * Workflow :
 *  1. Filtre confiance min/max + status pending
 *  2. Pour chaque ligne : Select mk-* (pré-rempli avec la suggestion LLM)
 *  3. Bouton Valider → UPDATE suggested_mk_slug/_id puis RPC apply_qogita_llm_mapping
 *  4. Bouton Rejeter → status=rejected
 *
 * Aucune action de masse ici : revue à l'unité, par construction.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
};

type MkCat = { id: string; slug: string; name_fr: string | null };

const NULL_TARGET = "__none__";

const AdminQogitaAmbiguousReview = () => {
  const qc = useQueryClient();
  const [minConf, setMinConf] = useState(0.5);
  const [maxConf, setMaxConf] = useState(0.85);
  const [search, setSearch] = useState("");
  // override local par proposition : id -> mk_slug | null
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});

  const { data: mkCats = [] } = useQuery({
    queryKey: ["mk-categories-mini"],
    queryFn: async (): Promise<MkCat[]> => {
      const { data, error } = await sb
        .from("categories")
        .select("id, slug, name_fr")
        .like("slug", "mk-%")
        .order("display_order");
      if (error) throw error;
      return (data || []) as MkCat[];
    },
  });

  const slugToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of mkCats) m.set(c.slug, c.id);
    return m;
  }, [mkCats]);

  const { data: proposals = [], isLoading, refetch } = useQuery({
    queryKey: ["qogita-llm-ambiguous", minConf, maxConf],
    queryFn: async (): Promise<Proposal[]> => {
      const { data, error } = await sb
        .from("category_llm_mapping_proposals")
        .select(
          "id, qogita_category_id, qogita_name, products_count, suggested_mk_slug, suggested_mk_category_id, confidence, reason, status",
        )
        .eq("status", "pending")
        .gte("confidence", minConf)
        .lt("confidence", maxConf)
        .order("products_count", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Proposal[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return proposals;
    return proposals.filter((p) => p.qogita_name.toLowerCase().includes(term));
  }, [proposals, search]);

  const totals = useMemo(() => {
    const products = filtered.reduce((s, p) => s + (p.products_count || 0), 0);
    return { count: filtered.length, products };
  }, [filtered]);

  const validateOne = useMutation({
    mutationFn: async (p: Proposal) => {
      const overrideSlug = overrides[p.id] ?? p.suggested_mk_slug;
      if (!overrideSlug) throw new Error("Aucune catégorie MK sélectionnée");
      const overrideId = slugToId.get(overrideSlug);
      if (!overrideId) throw new Error(`Slug inconnu: ${overrideSlug}`);

      // 1. Si l'admin a corrigé, on patche la proposition d'abord
      if (overrideSlug !== p.suggested_mk_slug) {
        const { error: upErr } = await sb
          .from("category_llm_mapping_proposals")
          .update({
            suggested_mk_slug: overrideSlug,
            suggested_mk_category_id: overrideId,
            // marque la correction admin pour audit
            reason: `[admin override] ${p.reason ?? ""}`.slice(0, 500),
          })
          .eq("id", p.id);
        if (upErr) throw upErr;
      }
      // 2. Apply (crée alias + UPDATE products.primary_category_id)
      const { data, error } = await sb.rpc("apply_qogita_llm_mapping", {
        _proposal_id: p.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Validée et appliquée",
        description: `${data?.products_updated ?? 0} produits mis à jour.`,
      });
      qc.invalidateQueries({ queryKey: ["qogita-llm-ambiguous"] });
      qc.invalidateQueries({ queryKey: ["qogita-llm-proposals"] });
    },
    onError: (e: any) => {
      toast({ title: "Erreur validation", description: e.message, variant: "destructive" });
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
    onSuccess: () => {
      toast({ title: "Rejetée" });
      qc.invalidateQueries({ queryKey: ["qogita-llm-ambiguous"] });
    },
  });

  const confidenceBadge = (c: number | null) => {
    const v = c ?? 0;
    if (v >= 0.85) return <Badge className="bg-emerald-600">{(v * 100).toFixed(0)}%</Badge>;
    if (v >= 0.6) return <Badge variant="secondary">{(v * 100).toFixed(0)}%</Badge>;
    return <Badge variant="destructive">{(v * 100).toFixed(0)}%</Badge>;
  };

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Revue des catégories Qogita ambiguës"
        subtitle="Corrige la cible MK puis valide à l'unité. Les propositions très confiantes (≥0.85) passent par le bulk apply, les très faibles (<0.5) sont à rejeter."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/categories/qogita-mapping-llm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour mapping LLM
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/categories/dashboard">
                <Sparkles className="mr-2 h-4 w-4" /> Dashboard
              </Link>
            </Button>
          </div>
        }
      />

      {/* Filtres */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Confiance min</label>
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={minConf}
              onChange={(e) => setMinConf(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Confiance max (exclu)</label>
            <Input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={maxConf}
              onChange={(e) => setMaxConf(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Rechercher un libellé</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ex: vitamins"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Rafraîchir
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            <strong className="text-foreground">{totals.count}</strong> propositions ·{" "}
            <strong className="text-foreground">{totals.products.toLocaleString("fr-BE")}</strong>{" "}
            produits couverts
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé Qogita</TableHead>
              <TableHead className="w-24 text-right">Produits</TableHead>
              <TableHead className="w-20">Conf.</TableHead>
              <TableHead className="w-72">Cible MK (modifiable)</TableHead>
              <TableHead>Justification LLM</TableHead>
              <TableHead className="w-44">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                  Aucune proposition ambiguë dans cette plage.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const currentSlug =
                  overrides[p.id] !== undefined ? overrides[p.id] : p.suggested_mk_slug;
                const corrected =
                  overrides[p.id] !== undefined && overrides[p.id] !== p.suggested_mk_slug;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium align-top">{p.qogita_name}</TableCell>
                    <TableCell className="text-right tabular-nums align-top">
                      {p.products_count.toLocaleString("fr-BE")}
                    </TableCell>
                    <TableCell className="align-top">{confidenceBadge(p.confidence)}</TableCell>
                    <TableCell className="align-top">
                      <Select
                        value={currentSlug ?? NULL_TARGET}
                        onValueChange={(v) =>
                          setOverrides((o) => ({
                            ...o,
                            [p.id]: v === NULL_TARGET ? null : v,
                          }))
                        }
                      >
                        <SelectTrigger className={corrected ? "border-primary" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NULL_TARGET}>— (aucune)</SelectItem>
                          {mkCats.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              <span className="font-mono text-xs mr-2">{c.slug}</span>
                              {c.name_fr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {corrected && (
                        <p className="text-[11px] text-primary mt-1">
                          ↳ corrigé (LLM proposait{" "}
                          <code>{p.suggested_mk_slug ?? "null"}</code>)
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md align-top">
                      {p.reason}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={!currentSlug || validateOne.isPending}
                          onClick={() => validateOne.mutate(p)}
                        >
                          {validateOne.isPending && validateOne.variables?.id === p.id ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-3 w-3" />
                          )}
                          Valider
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => reject.mutate(p.id)}
                          disabled={reject.isPending}
                        >
                          <XCircle className="mr-2 h-3 w-3" />
                          Rejeter
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminQogitaAmbiguousReview;
