/**
 * /admin/categories/dashboard
 *
 * Tableau de bord de la progression du mapping catégories MediKong (mk-*).
 *
 * Source unique : RPC `admin_category_mapping_dashboard()` (admin only,
 * SECURITY DEFINER) qui retourne en un seul aller-retour :
 *  - Compteurs globaux (mappés / total / %).
 *  - Une ligne par catégorie maîtresse MK avec ses libellés FR + NL et le
 *    nombre de produits mappés.
 *  - Top 20 catégories Qogita encore non mappées.
 *  - État des propositions LLM (pending / applied / rejected).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Languages,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const sb = supabase as any;

type Dashboard = {
  total_products: number;
  mapped_products: number;
  unmapped_products: number;
  percent_mapped: number;
  per_mk_category: Array<{
    id: string;
    slug: string;
    name_fr: string;
    name_nl: string;
    display_order: number;
    products_mapped: number;
  }>;
  top_unmapped_qogita: Array<{
    qogita_category_id: string;
    qogita_name: string;
    products_count: number;
  }>;
  llm_proposals: {
    pending: number;
    applied: number;
    rejected: number;
    pending_products: number;
    applied_products: number;
    high_confidence_pending: number;
    high_confidence_pending_products: number;
  };
};

const fmt = (n: number) => Number(n || 0).toLocaleString("fr-BE");

const AdminCategoryMappingDashboard = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-category-mapping-dashboard"],
    queryFn: async (): Promise<Dashboard> => {
      const { data, error } = await sb.rpc("admin_category_mapping_dashboard");
      if (error) throw error;
      return data as Dashboard;
    },
  });

  const sortedMk = useMemo(() => {
    if (!data?.per_mk_category) return [];
    return [...data.per_mk_category].sort((a, b) => b.products_mapped - a.products_mapped);
  }, [data]);

  const maxMapped = sortedMk[0]?.products_mapped ?? 1;

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Progression du mapping catégories"
        subtitle="Vue consolidée mappés / total + gap restant et libellés FR / NL des catégories MediKong."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="default" size="sm">
              <Link to="/admin/categories/qogita-mapping-llm">
                <Sparkles className="mr-2 h-4 w-4" /> Mapping LLM
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" /> Retour admin
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-destructive">
          Erreur : {(error as any)?.message}
        </div>
      ) : !data ? null : (
        <>
          {/* Progression globale */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Produits actifs mappés vers la taxonomie MediKong
                </div>
                <div className="mt-1 text-3xl font-semibold">
                  {fmt(data.mapped_products)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {fmt(data.total_products)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">
                  {data.percent_mapped.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">de couverture</div>
              </div>
            </div>
            <Progress value={Number(data.percent_mapped)} className="h-3" />
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-3 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {fmt(data.mapped_products)} mappés
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {fmt(data.unmapped_products)} restants
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                Cible : 90%
              </span>
            </div>
          </div>

          {/* Propositions LLM */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Propositions pending
              </div>
              <div className="text-2xl font-semibold">{fmt(data.llm_proposals.pending)}</div>
              <div className="text-xs text-muted-foreground">
                {fmt(data.llm_proposals.pending_products)} produits potentiels
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">Pending ≥ 85%</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {fmt(data.llm_proposals.high_confidence_pending)}
              </div>
              <div className="text-xs text-muted-foreground">
                {fmt(data.llm_proposals.high_confidence_pending_products)} produits prêts à appliquer
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">Appliquées</div>
              <div className="text-2xl font-semibold">{fmt(data.llm_proposals.applied)}</div>
              <div className="text-xs text-muted-foreground">
                {fmt(data.llm_proposals.applied_products)} produits couverts
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">Rejetées</div>
              <div className="text-2xl font-semibold">{fmt(data.llm_proposals.rejected)}</div>
            </div>
          </div>

          {/* Tableau bilingue par catégorie MK */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Couverture par catégorie maîtresse · libellés FR / NL</h3>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slug</TableHead>
                    <TableHead>Libellé FR</TableHead>
                    <TableHead>Libellé NL</TableHead>
                    <TableHead className="w-32 text-right">Produits mappés</TableHead>
                    <TableHead className="w-64">Volume relatif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMk.map((c) => {
                    const ratio = maxMapped ? (c.products_mapped / maxMapped) * 100 : 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.slug}</code>
                        </TableCell>
                        <TableCell className="font-medium">{c.name_fr}</TableCell>
                        <TableCell className="text-muted-foreground">{c.name_nl}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {fmt(c.products_mapped)}
                        </TableCell>
                        <TableCell>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Top 20 cats Qogita non mappées (le gap restant) */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="font-semibold">
                  Top 20 du gap restant — catégories Qogita non mappées
                </h3>
              </div>
              <Badge variant="outline">
                {fmt(data.unmapped_products)} produits sans primary_category_id
              </Badge>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé Qogita (EN)</TableHead>
                    <TableHead className="w-32 text-right">Produits</TableHead>
                    <TableHead className="w-32">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_unmapped_qogita.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 inline mr-1 text-emerald-600" />
                        Aucune catégorie Qogita restante non mappée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.top_unmapped_qogita.map((c) => (
                      <TableRow key={c.qogita_category_id}>
                        <TableCell className="font-medium">{c.qogita_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(c.products_count)}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> Non mappée
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Lance la passe LLM depuis{" "}
              <Link to="/admin/categories/qogita-mapping-llm" className="text-primary hover:underline">
                /admin/categories/qogita-mapping-llm
              </Link>{" "}
              pour proposer un mapping pour ces libellés.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminCategoryMappingDashboard;
