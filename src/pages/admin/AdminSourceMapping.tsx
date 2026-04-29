import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  History,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { formatUpdatedAt } from "@/lib/format-date";

type Overview = {
  source: string;
  total_products: number;
  without_brand: number;
  without_category: number;
  without_manufacturer: number;
  manually_validated: number;
  unresolved_brand_values: number;
  unresolved_category_values: number;
};

type ProductRow = {
  product_id: string;
  product_name: string;
  product_image: string | null;
  source: string;
  brand_id: string | null;
  brand_name_raw: string | null;
  brand_name_resolved: string | null;
  category_id: string | null;
  category_name_raw: string | null;
  category_name_resolved: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  manual_mapping_validated: boolean;
  manual_mapping_validated_at: string | null;
  total_count: number;
};

type IssueRow = {
  raw_value: string;
  product_count: number;
  example_product_id: string;
  example_product_name: string;
};

type ImportRun = {
  source: string;
  run_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  rows_processed: number | null;
  rows_created: number | null;
  rows_updated: number | null;
  rows_failed: number | null;
  message: string | null;
};

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "no_brand", label: "Sans marque" },
  { value: "no_category", label: "Sans catégorie" },
  { value: "no_manufacturer", label: "Sans fabricant" },
  { value: "unvalidated", label: "Non validés" },
  { value: "validated", label: "Validés" },
];

const PAGE_SIZE = 50;

const AdminSourceMapping = () => {
  const qc = useQueryClient();
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [filter, setFilter] = useState<string>("no_brand");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const { data: overview = [], isLoading: loadingOverview } = useQuery({
    queryKey: ["source-mapping-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_source_mapping_overview");
      if (error) throw error;
      return (data as Overview[]) || [];
    },
  });

  const sources = useMemo(() => overview.map((o) => o.source), [overview]);

  const effectiveSource = selectedSource || sources[0] || "";

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["source-mapping-products", effectiveSource, filter, search, page],
    enabled: !!effectiveSource,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_source_mapping_products", {
        _source: effectiveSource,
        _filter: filter,
        _search: search || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data as ProductRow[]) || [];
    },
  });

  const totalCount = products[0]?.total_count ?? 0;

  const { data: brandIssues = [] } = useQuery({
    queryKey: ["source-mapping-issues", "brand", effectiveSource],
    enabled: !!effectiveSource,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_source_mapping_issues", {
        _source: effectiveSource,
        _kind: "brand",
        _limit: 50,
      });
      if (error) throw error;
      return (data as IssueRow[]) || [];
    },
  });

  const { data: categoryIssues = [] } = useQuery({
    queryKey: ["source-mapping-issues", "category", effectiveSource],
    enabled: !!effectiveSource,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_source_mapping_issues", {
        _source: effectiveSource,
        _kind: "category",
        _limit: 50,
      });
      if (error) throw error;
      return (data as IssueRow[]) || [];
    },
  });

  const { data: importRuns = [] } = useQuery({
    queryKey: ["source-mapping-import-runs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_import_runs", {
        _limit: 80,
      });
      if (error) throw error;
      return (data as ImportRun[]) || [];
    },
  });

  const applyMapping = useMutation({
    mutationFn: async (payload: {
      product_ids: string[];
      brand_id?: string | null;
      category_id?: string | null;
      manufacturer_id?: string | null;
      mark_validated: boolean;
    }) => {
      const { data, error } = await supabase.rpc("admin_apply_product_mapping", {
        _product_ids: payload.product_ids,
        _brand_id: payload.brand_id ?? null,
        _category_id: payload.category_id ?? null,
        _manufacturer_id: payload.manufacturer_id ?? null,
        _mark_validated: payload.mark_validated,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast.success(`${data?.updated ?? 0} produit(s) mis à jour`);
      qc.invalidateQueries({ queryKey: ["source-mapping-products"] });
      qc.invalidateQueries({ queryKey: ["source-mapping-overview"] });
      qc.invalidateQueries({ queryKey: ["source-mapping-issues"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  return (
    <div className="min-h-screen bg-mk-cream">
      <AdminTopBar title="Mapping source → catalogue" />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/produits">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-mk-navy">
            Mapping source → marque / fabricant / catégorie
          </h1>
        </div>

        {/* KPIs par source */}
        <Card className="p-4 mb-6">
          <h2 className="text-sm font-semibold text-mk-navy mb-3">
            Vue d'ensemble par source
          </h2>
          {loadingOverview ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Produits</TableHead>
                    <TableHead className="text-right">Sans marque</TableHead>
                    <TableHead className="text-right">Sans catégorie</TableHead>
                    <TableHead className="text-right">Sans fabricant</TableHead>
                    <TableHead className="text-right">Validés</TableHead>
                    <TableHead className="text-right">Brands à mapper</TableHead>
                    <TableHead className="text-right">Cats à mapper</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.map((o) => (
                    <TableRow
                      key={o.source}
                      className={
                        effectiveSource === o.source ? "bg-mk-blue/5" : ""
                      }
                    >
                      <TableCell className="font-medium">{o.source}</TableCell>
                      <TableCell className="text-right">
                        {o.total_products.toLocaleString("fr-BE")}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.without_brand > 0 ? (
                          <Badge variant="destructive">{o.without_brand}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.without_category > 0 ? (
                          <Badge variant="destructive">
                            {o.without_category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.without_manufacturer > 0 ? (
                          <Badge variant="secondary">
                            {o.without_manufacturer}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-green-500 text-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {o.manually_validated}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {o.unresolved_brand_values}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.unresolved_category_values}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSource(o.source);
                            setPage(0);
                          }}
                        >
                          Drill-down
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">
              Produits {effectiveSource && `· ${effectiveSource}`}
            </TabsTrigger>
            <TabsTrigger value="issues">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Valeurs non résolues
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-1" />
              Historique imports
            </TabsTrigger>
          </TabsList>

          {/* === PRODUITS === */}
          <TabsContent value="products">
            <Card className="p-4">
              <div className="flex flex-wrap gap-3 mb-4 items-end">
                <div>
                  <Label className="text-xs">Source</Label>
                  <Select
                    value={effectiveSource}
                    onValueChange={(v) => {
                      setSelectedSource(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Filtre</Label>
                  <Select
                    value={filter}
                    onValueChange={(v) => {
                      setFilter(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTERS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Recherche (nom, GTIN, CNK)</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {totalCount.toLocaleString("fr-BE")} produit(s)
                </div>
              </div>

              {loadingProducts ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Marque (brut → résolu)</TableHead>
                        <TableHead>Catégorie (brut → résolu)</TableHead>
                        <TableHead>Fabricant</TableHead>
                        <TableHead>Validation</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="max-w-[280px]">
                            <Link
                              to={`/admin/produits/${p.product_id}`}
                              className="text-mk-blue hover:underline text-sm font-medium line-clamp-2"
                            >
                              {p.product_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="text-muted-foreground">
                              {p.brand_name_raw || "—"}
                            </div>
                            <div className={p.brand_id ? "" : "text-destructive"}>
                              → {p.brand_name_resolved || "non mappée"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="text-muted-foreground">
                              {p.category_name_raw || "—"}
                            </div>
                            <div
                              className={p.category_id ? "" : "text-destructive"}
                            >
                              → {p.category_name_resolved || "non mappée"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {p.manufacturer_name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.manual_mapping_validated ? (
                              <Badge
                                variant="outline"
                                className="border-green-500 text-green-700"
                              >
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                {p.manual_mapping_validated_at
                                  ? formatUpdatedAt(
                                      p.manual_mapping_validated_at
                                    )
                                  : "Validé"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Non validé</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(p)}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Corriger
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {products.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            Aucun produit pour ce filtre.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination simple */}
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Précédent
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} / {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * PAGE_SIZE >= totalCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* === ISSUES === */}
          <TabsContent value="issues">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm">
                  Valeurs `brand_name` sans correspondance
                </h3>
                <div className="overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Valeur brute</TableHead>
                        <TableHead className="text-right">Produits</TableHead>
                        <TableHead>Exemple</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brandIssues.map((i) => (
                        <TableRow key={i.raw_value}>
                          <TableCell className="font-mono text-xs">
                            {i.raw_value}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">
                              {i.product_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Link
                              to={`/admin/produits/${i.example_product_id}`}
                              className="text-mk-blue hover:underline line-clamp-1"
                            >
                              {i.example_product_name}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {brandIssues.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground py-6"
                          >
                            Aucune valeur non résolue 🎉
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm">
                  Valeurs `category_name` sans correspondance
                </h3>
                <div className="overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Valeur brute</TableHead>
                        <TableHead className="text-right">Produits</TableHead>
                        <TableHead>Exemple</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryIssues.map((i) => (
                        <TableRow key={i.raw_value}>
                          <TableCell className="font-mono text-xs">
                            {i.raw_value}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">
                              {i.product_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Link
                              to={`/admin/produits/${i.example_product_id}`}
                              className="text-mk-blue hover:underline line-clamp-1"
                            >
                              {i.example_product_name}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {categoryIssues.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground py-6"
                          >
                            Aucune valeur non résolue 🎉
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* === HISTORIQUE === */}
          <TabsContent value="history">
            <Card className="p-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Traités</TableHead>
                      <TableHead className="text-right">Créés</TableHead>
                      <TableHead className="text-right">MAJ</TableHead>
                      <TableHead className="text-right">Erreurs</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRuns.map((r, idx) => (
                      <TableRow key={`${r.started_at}-${idx}`}>
                        <TableCell className="text-xs">
                          {formatUpdatedAt(r.started_at)}
                        </TableCell>
                        <TableCell className="text-xs">{r.source}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {r.run_type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "completed" || r.status === "success"
                                ? "default"
                                : r.status === "error" || r.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {r.rows_processed ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {r.rows_created ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {r.rows_updated ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {r.rows_failed && r.rows_failed > 0 ? (
                            <Badge variant="destructive">{r.rows_failed}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[260px] truncate"
                          title={r.message ?? ""}
                        >
                          {r.message ?? ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog correction */}
      {editing && (
        <EditMappingDialog
          product={editing}
          onClose={() => setEditing(null)}
          onApply={(payload) =>
            applyMapping.mutate({
              product_ids: [editing.product_id],
              ...payload,
            })
          }
          isPending={applyMapping.isPending}
        />
      )}
    </div>
  );
};

/* ============== Edit dialog ============== */

type BrandOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };
type ManufacturerOption = { id: string; name: string };

const EditMappingDialog = ({
  product,
  onClose,
  onApply,
  isPending,
}: {
  product: ProductRow;
  onClose: () => void;
  onApply: (payload: {
    brand_id?: string | null;
    category_id?: string | null;
    manufacturer_id?: string | null;
    mark_validated: boolean;
  }) => void;
  isPending: boolean;
}) => {
  const [brandQuery, setBrandQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [manufacturerQuery, setManufacturerQuery] = useState("");
  const [brandId, setBrandId] = useState<string | null>(product.brand_id);
  const [categoryId, setCategoryId] = useState<string | null>(product.category_id);
  const [manufacturerId, setManufacturerId] = useState<string | null>(
    product.manufacturer_id
  );
  const [markValidated, setMarkValidated] = useState(true);

  const { data: brands = [] } = useQuery({
    queryKey: ["map-brands-search", brandQuery],
    queryFn: async () => {
      const q = supabase.from("brands").select("id, name").order("name").limit(20);
      const { data, error } = brandQuery
        ? await q.ilike("name", `%${brandQuery}%`)
        : await q;
      if (error) throw error;
      return (data as BrandOption[]) || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["map-categories-search", categoryQuery],
    queryFn: async () => {
      const q = supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .limit(20);
      const { data, error } = categoryQuery
        ? await q.ilike("name", `%${categoryQuery}%`)
        : await q;
      if (error) throw error;
      return (data as CategoryOption[]) || [];
    },
  });

  const { data: manufacturers = [] } = useQuery({
    queryKey: ["map-manufacturers-search", manufacturerQuery],
    queryFn: async () => {
      const q = supabase
        .from("manufacturers")
        .select("id, name")
        .order("name")
        .limit(20);
      const { data, error } = manufacturerQuery
        ? await q.ilike("name", `%${manufacturerQuery}%`)
        : await q;
      if (error) throw error;
      return (data as ManufacturerOption[]) || [];
    },
  });

  const dirtyBrand = brandId !== product.brand_id;
  const dirtyCategory = categoryId !== product.category_id;
  const dirtyManufacturer = manufacturerId !== product.manufacturer_id;
  const hasChanges = dirtyBrand || dirtyCategory || dirtyManufacturer;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Corriger le mapping du produit</DialogTitle>
          <DialogDescription className="text-xs line-clamp-2">
            {product.product_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Brand */}
          <div>
            <Label className="text-xs">
              Marque · brut: <code className="text-xs">{product.brand_name_raw || "—"}</code>
            </Label>
            <Input
              placeholder="Rechercher une marque…"
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded max-h-40 overflow-y-auto">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBrandId(b.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${
                    brandId === b.id ? "bg-mk-blue/10 font-medium" : ""
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
            {brandId && (
              <button
                type="button"
                className="text-xs text-muted-foreground mt-1 underline"
                onClick={() => setBrandId(null)}
              >
                Effacer la sélection
              </button>
            )}
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs">
              Catégorie · brut:{" "}
              <code className="text-xs">{product.category_name_raw || "—"}</code>
            </Label>
            <Input
              placeholder="Rechercher une catégorie…"
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded max-h-40 overflow-y-auto">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${
                    categoryId === c.id ? "bg-mk-blue/10 font-medium" : ""
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Manufacturer */}
          <div>
            <Label className="text-xs">Fabricant</Label>
            <Input
              placeholder="Rechercher un fabricant…"
              value={manufacturerQuery}
              onChange={(e) => setManufacturerQuery(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded max-h-32 overflow-y-auto">
              {manufacturers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setManufacturerId(m.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${
                    manufacturerId === m.id ? "bg-mk-blue/10 font-medium" : ""
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={markValidated}
              onChange={(e) => setMarkValidated(e.target.checked)}
            />
            Marquer ce mapping comme validé manuellement (les imports automatiques
            ne le toucheront plus)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!hasChanges || isPending}
            onClick={() =>
              onApply({
                brand_id: dirtyBrand ? brandId : undefined,
                category_id: dirtyCategory ? categoryId : undefined,
                manufacturer_id: dirtyManufacturer ? manufacturerId : undefined,
                mark_validated: markValidated,
              })
            }
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminSourceMapping;
