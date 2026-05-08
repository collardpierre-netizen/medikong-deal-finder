/**
 * /admin/cms/home/produits
 *
 * Curation des produits mis en avant sur la home (table
 * `home_featured_products`). Drag-and-drop pour l'ordre, sélecteur de locale,
 * gestion des badges (bestseller / top_vente / nouveau / promo). Position
 * persistée via le RPC `admin_reorder_home_featured('products', _ids)`.
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { HomeSeedRecommendedButton } from "@/components/admin/cms/HomeSeedRecommendedButton";
import {
  HOME_FEATURED_BADGES,
  HOME_FEATURED_LOCALES,
  type HomeFeaturedBadgeValue,
  type HomeFeaturedLocale,
} from "@/components/admin/cms/homeFeaturedConstants";

type Row = {
  id: string;
  product_id: string;
  position: number;
  locale: HomeFeaturedLocale;
  badge: HomeFeaturedBadgeValue | null;
  valid_from: string;
  valid_to: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    is_active: boolean;
    brand_name: string | null;
  } | null;
};

const sb = supabase as any;
const NO_BADGE = "__none__";

const AdminCmsHomeProducts = () => {
  const qc = useQueryClient();
  const [locale, setLocale] = useState<HomeFeaturedLocale>("all");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-home-featured-products", locale],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await sb
        .from("home_featured_products")
        .select(
          "id, product_id, position, locale, badge, valid_from, valid_to, product:products(id, name, slug, image_url, is_active, brand_name)",
        )
        .eq("locale", locale)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["admin-home-product-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`;
      const { data, error } = await sb
        .from("products")
        .select("id, name, slug, image_url, is_active, brand_name")
        .ilike("name", term)
        .eq("is_active", true)
        .order("name")
        .limit(20);
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        slug: string;
        image_url: string | null;
        is_active: boolean;
        brand_name: string | null;
      }>;
    },
  });

  const existingProductIds = useMemo(
    () => new Set(rows.map((r) => r.product_id)),
    [rows],
  );

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await sb.rpc("admin_reorder_home_featured", {
        _kind: "products",
        _ids: orderedIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured-products"] });
      qc.invalidateQueries({ queryKey: ["home-featured-products-curated"] });
    },
    onError: (err: any) => toast.error("Réordonnancement impossible : " + (err?.message || "")),
  });

  const addProduct = useMutation({
    mutationFn: async (productId: string) => {
      const nextPosition = (rows.at(-1)?.position ?? 0) + 1;
      const { error } = await sb.from("home_featured_products").insert({
        product_id: productId,
        locale,
        position: nextPosition,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit ajouté");
      setSearch("");
      qc.invalidateQueries({ queryKey: ["admin-home-featured-products"] });
      qc.invalidateQueries({ queryKey: ["home-featured-products-curated"] });
    },
    onError: (err: any) => toast.error("Ajout impossible : " + (err?.message || "")),
  });

  const updateRow = useMutation({
    mutationFn: async (patch: Partial<Row> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await sb.from("home_featured_products").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-featured-products"] });
      qc.invalidateQueries({ queryKey: ["home-featured-products-curated"] });
    },
  });

  const removeRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("home_featured_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit retiré");
      qc.invalidateQueries({ queryKey: ["admin-home-featured-products"] });
      qc.invalidateQueries({ queryKey: ["home-featured-products-curated"] });
    },
  });

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Produits en vedette — Home"
        subtitle="Sélection éditoriale affichée dans le bloc « Tendances » sous le hero."
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

        {/* Add product */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" /> Ajouter un produit (locale : {HOME_FEATURED_LOCALES.find((l) => l.value === locale)?.label})
          </div>
          <Input
            placeholder="Rechercher un produit par nom (min 2 caractères)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim().length >= 2 && (
            <div className="max-h-72 overflow-y-auto rounded border bg-background">
              {searchResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Aucun résultat.</div>
              ) : (
                searchResults.map((p) => {
                  const already = existingProductIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="h-8 w-8 rounded object-contain bg-white border"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted border" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm truncate">{p.name}</div>
                          {p.brand_name && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {p.brand_name}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={already ? "outline" : "default"}
                        disabled={already || addProduct.isPending}
                        onClick={() => addProduct.mutate(p.id)}
                      >
                        {already ? "Déjà ajouté" : "Ajouter"}
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
                <TableHead>Produit</TableHead>
                <TableHead className="w-32">Locale</TableHead>
                <TableHead className="w-40">Badge</TableHead>
                <TableHead className="w-40">Visibilité</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Aucun produit pour cette locale. Utilisez le champ de recherche ci-dessus pour ajouter une sélection.
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
                          {row.product?.image_url ? (
                            <img
                              src={row.product.image_url}
                              alt=""
                              className="h-9 w-9 rounded object-contain bg-white border"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded bg-muted border" />
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {row.product?.name ?? "Produit introuvable"}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              {row.product?.brand_name ?? "—"}
                              {row.product && (
                                <Link
                                  to={`/produit/${row.product.slug}`}
                                  target="_blank"
                                  className="hover:underline inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
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
                        <Select
                          value={row.badge ?? NO_BADGE}
                          onValueChange={(v) =>
                            updateRow.mutate({
                              id: row.id,
                              badge: (v === NO_BADGE ? null : (v as HomeFeaturedBadgeValue)),
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_BADGE}>Aucun</SelectItem>
                            {HOME_FEATURED_BADGES.map((b) => (
                              <SelectItem key={b.value} value={b.value}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {row.product?.is_active === false ? (
                          <Badge variant="destructive">Produit inactif</Badge>
                        ) : row.valid_to && new Date(row.valid_to) < new Date() ? (
                          <Badge variant="outline">Expiré</Badge>
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

export default AdminCmsHomeProducts;
