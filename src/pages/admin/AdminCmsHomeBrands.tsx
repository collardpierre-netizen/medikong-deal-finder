/**
 * /admin/cms/home/marques
 *
 * Curation des marques mises en avant sur la home (table
 * `home_featured_brands`). Drag-and-drop pour l'ordre, sélecteur de locale,
 * picker de marque pour l'ajout. Position persistée via le RPC
 * `admin_reorder_home_featured('brands', _ids)`.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { HomeFeaturedSortableTable } from "@/components/admin/cms/HomeFeaturedSortableTable";
import {
  HOME_FEATURED_LOCALES,
  type HomeFeaturedLocale,
} from "@/components/admin/cms/homeFeaturedConstants";

type Row = {
  id: string;
  brand_id: string;
  position: number;
  locale: HomeFeaturedLocale;
  valid_from: string;
  valid_to: string | null;
  brand: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    is_active: boolean;
  } | null;
};

const sb = supabase as any;

const AdminCmsHomeBrands = () => {
  const qc = useQueryClient();
  const [locale, setLocale] = useState<HomeFeaturedLocale>("all");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-home-featured-brands", locale],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await sb
        .from("home_featured_brands")
        .select(
          "id, brand_id, position, locale, valid_from, valid_to, brand:brands(id, name, slug, logo_url, is_active)",
        )
        .eq("locale", locale)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-home-brand-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`;
      const { data, error } = await sb
        .from("brands")
        .select("id, name, slug, logo_url, is_active")
        .ilike("name", term)
        .eq("is_active", true)
        .order("name")
        .limit(20);
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        is_active: boolean;
      }>;
    },
  });

  const existingBrandIds = useMemo(
    () => new Set(rows.map((r) => r.brand_id)),
    [rows],
  );

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await sb.rpc("admin_reorder_home_featured", {
        _kind: "brands",
        _ids: orderedIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured-brands"] });
      qc.invalidateQueries({ queryKey: ["home-featured-brands-curated"] });
    },
    onError: (err: any) => toast.error("Réordonnancement impossible : " + (err?.message || "")),
  });

  const addBrand = useMutation({
    mutationFn: async (brandId: string) => {
      const nextPosition = (rows.at(-1)?.position ?? 0) + 1;
      const { error } = await sb.from("home_featured_brands").insert({
        brand_id: brandId,
        locale,
        position: nextPosition,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marque ajoutée");
      setSearch("");
      qc.invalidateQueries({ queryKey: ["admin-home-featured-brands"] });
      qc.invalidateQueries({ queryKey: ["home-featured-brands-curated"] });
    },
    onError: (err: any) => toast.error("Ajout impossible : " + (err?.message || "")),
  });

  const updateRow = useMutation({
    mutationFn: async (patch: Partial<Row> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await sb.from("home_featured_brands").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured-brands"] });
      qc.invalidateQueries({ queryKey: ["home-featured-brands-curated"] });
    },
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("home_featured_brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marque retirée");
      qc.invalidateQueries({ queryKey: ["admin-home-featured-brands"] });
      qc.invalidateQueries({ queryKey: ["home-featured-brands-curated"] });
    },
  });

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Marques en vedette — Home"
        subtitle="Sélection éditoriale affichée dans le bloc « Marques premium & tendances »."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/cms">
              <ArrowLeft className="mr-2 h-4 w-4" /> Retour CMS
            </Link>
          </Button>
        }
      />

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={locale} onValueChange={(v) => setLocale(v as HomeFeaturedLocale)}>
            <TabsList>
              {HOME_FEATURED_LOCALES.map((l) => (
                <TabsTrigger key={l.value} value={l.value}>
                  {l.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="text-xs text-muted-foreground">
            La home affiche les entrées de la locale courante <strong>+</strong> celles marquées « Toutes ».
          </div>
        </div>

        {/* Add brand */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Ajouter une marque (locale : {HOME_FEATURED_LOCALES.find((l) => l.value === locale)?.label})
          </div>
          <Input
            placeholder="Rechercher une marque par nom (min 2 caractères)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim().length >= 2 && (
            <div className="max-h-64 overflow-y-auto rounded border bg-background">
              {searchResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Aucun résultat.</div>
              ) : (
                searchResults.map((b) => {
                  const already = existingBrandIds.has(b.id);
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {b.logo_url ? (
                          <img
                            src={b.logo_url}
                            alt=""
                            className="h-6 w-6 rounded object-contain bg-white"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded bg-muted" />
                        )}
                        <span className="truncate text-sm">{b.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={already ? "outline" : "default"}
                        disabled={already || addBrand.isPending}
                        onClick={() => addBrand.mutate(b.id)}
                      >
                        {already ? "Déjà ajoutée" : "Ajouter"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-12">#</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead className="w-32">Locale</TableHead>
                <TableHead className="w-44">Visibilité</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Aucune marque pour cette locale. Utilisez le champ de recherche ci-dessus pour ajouter une sélection.
                  </TableCell>
                </TableRow>
              ) : (
                <HomeFeaturedSortableTable
                  items={rows}
                  onReorder={(ids) => reorder.mutate(ids)}
                  renderCells={(row, index) => (
                    <>
                      <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.brand?.logo_url ? (
                            <img
                              src={row.brand.logo_url}
                              alt=""
                              className="h-7 w-7 rounded object-contain bg-white border"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded bg-muted border" />
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {row.brand?.name ?? "Marque introuvable"}
                            </div>
                            {row.brand && (
                              <Link
                                to={`/marques/${row.brand.slug}`}
                                target="_blank"
                                className="text-[11px] text-muted-foreground hover:underline inline-flex items-center gap-1"
                              >
                                /marques/{row.brand.slug}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.locale}
                          onValueChange={(v) =>
                            updateRow.mutate({ id: row.id, locale: v as HomeFeaturedLocale })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HOME_FEATURED_LOCALES.map((l) => (
                              <SelectItem key={l.value} value={l.value}>
                                {l.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {row.brand?.is_active === false ? (
                          <Badge variant="destructive">Marque inactive</Badge>
                        ) : row.valid_to && new Date(row.valid_to) < new Date() ? (
                          <Badge variant="outline">Expirée</Badge>
                        ) : (
                          <Badge variant="secondary">Visible</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow.mutate(row.id)}
                          aria-label="Retirer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AdminCmsHomeBrands;
