/**
 * /admin/categories/non-mappees
 *
 * Vue admin des libellés de catégorie source qui ne correspondent à aucune
 * catégorie canonique (`products.primary_category_id IS NULL`). Pour chaque
 * libellé brut on affiche : nb produits actifs, présence d'un alias dans
 * `category_source_aliases`, et la cible si l'alias existe (l'absence de
 * mapping malgré un alias signifie qu'il faut relancer
 * `apply_category_aliases`).
 *
 * Source : RPC `admin_unmapped_categories(_limit int)` (SECURITY DEFINER,
 * gated par is_admin).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle2, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const sb = supabase as any;

type Row = {
  raw_label: string;
  product_count: number;
  has_alias: boolean;
  mapped_to_slug: string | null;
  mapped_to_name: string | null;
};

const AdminUnmappedCategories = () => {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-unmapped-categories", limit],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await sb.rpc("admin_unmapped_categories", { _limit: limit });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.raw_label.toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    const totalLabels = rows.length;
    const totalProducts = rows.reduce((s, r) => s + Number(r.product_count || 0), 0);
    const aliased = rows.filter((r) => r.has_alias).length;
    return { totalLabels, totalProducts, aliased };
  }, [rows]);

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Catégories non mappées"
        subtitle="Libellés de catégorie source pour lesquels aucun produit n'a encore reçu de primary_category_id."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour admin
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Libellés distincts</div>
          <div className="text-2xl font-semibold">{totals.totalLabels.toLocaleString("fr-BE")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Produits actifs sans catégorie</div>
          <div className="text-2xl font-semibold">{totals.totalProducts.toLocaleString("fr-BE")}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Libellés avec alias existant</div>
          <div className="text-2xl font-semibold">
            {totals.aliased.toLocaleString("fr-BE")}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {totals.totalLabels.toLocaleString("fr-BE")}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer un libellé…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Top</span>
            {[100, 200, 500, 1000].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={limit === n ? "default" : "outline"}
                onClick={() => setLimit(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé source</TableHead>
                <TableHead className="w-32 text-right">Produits</TableHead>
                <TableHead className="w-32">Alias</TableHead>
                <TableHead>Mapping cible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-destructive py-8">
                    Erreur : {(error as any)?.message || "chargement impossible"}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Aucun libellé non mappé{search ? " correspondant au filtre" : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.raw_label}>
                    <TableCell className="font-medium">{r.raw_label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.product_count).toLocaleString("fr-BE")}
                    </TableCell>
                    <TableCell>
                      {r.has_alias ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> existant
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> manquant
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.mapped_to_slug ? (
                        <Link
                          to={`/categorie/${r.mapped_to_slug}`}
                          target="_blank"
                          className="text-primary hover:underline"
                        >
                          {r.mapped_to_name ?? r.mapped_to_slug}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Astuce : si un libellé apparaît avec un alias <em>existant</em> mais que les produits
          restent sans catégorie, relance la RPC <code>apply_category_aliases</code> depuis
          /admin/produits/mapping.
        </p>
      </div>
    </div>
  );
};

export default AdminUnmappedCategories;
