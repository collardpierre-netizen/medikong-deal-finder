/**
 * /admin/sourcing/pipeline
 *
 * Pipeline de sourcing alimenté par le comparateur acheteur (XLSX import).
 * Onglets : Produits à sourcer / Marques à sourcer.
 *
 * Tri par défaut : import_count × total_quantity DESC (signal demande × volume).
 *
 * Source : table `buyer_comparator_sourcing_items` + vue
 * `admin_sourcing_items_by_brand_v` (admin only).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Package, Tag, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const sb = supabase as any;

type StatusFilter = "all" | "unmatched" | "inactive_product" | "no_active_offer";
type AdminStatus = "todo" | "sourcing" | "refused" | "resolved";
type BrandScope = "all" | "absent" | "thin";

type Item = {
  id: string;
  product_id: string | null;
  brand_id: string | null;
  gtin: string | null;
  cnk: string | null;
  raw_name: string | null;
  raw_brand: string | null;
  status: "unmatched" | "inactive_product" | "no_active_offer";
  admin_status: AdminStatus;
  admin_notes: string | null;
  import_count: number;
  user_count: number;
  total_quantity: number;
  buyer_price_min_cents: number | null;
  buyer_price_avg_cents: number | null;
  buyer_price_max_cents: number | null;
  first_seen_at: string;
  last_seen_at: string;
};

type BrandRow = {
  brand_key: string;
  brand_id: string | null;
  brand_label: string;
  items_count: number;
  total_imports: number;
  total_users: number;
  total_quantity: number;
  last_seen_at: string;
  unmatched_count: number;
  inactive_count: number;
  no_offer_count: number;
  medikong_active_products_count: number;
};

const STATUS_LABEL: Record<Item["status"], string> = {
  unmatched: "Inconnu",
  inactive_product: "Désactivé",
  no_active_offer: "Sans offre",
};

const STATUS_BADGE: Record<Item["status"], string> = {
  unmatched: "bg-orange-100 text-orange-800 border-orange-200",
  inactive_product: "bg-yellow-100 text-yellow-800 border-yellow-200",
  no_active_offer: "bg-blue-100 text-blue-800 border-blue-200",
};

const ADMIN_STATUS_LABEL: Record<AdminStatus, string> = {
  todo: "À traiter",
  sourcing: "En sourcing",
  refused: "Refusé",
  resolved: "Résolu",
};

const formatCents = (c: number | null) =>
  c == null ? "—" : `${(c / 100).toFixed(2)} €`;

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });

// Score demande × qty (signal de priorité sourcing)
const demandScore = (it: { import_count: number; total_quantity: number }) =>
  (it.import_count || 0) * Number(it.total_quantity || 0);

const brandDemandScore = (b: BrandRow) =>
  (b.total_imports || 0) * Number(b.total_quantity || 0);

const AdminSourcingPipeline = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState<AdminStatus | "all">("todo");
  const [brandScope, setBrandScope] = useState<BrandScope>("all");
  const [thinThreshold, setThinThreshold] = useState<number>(5);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-sourcing-items", statusFilter, adminStatusFilter],
    queryFn: async (): Promise<Item[]> => {
      let q = sb
        .from("buyer_comparator_sourcing_items")
        .select("*")
        .limit(2000);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (adminStatusFilter !== "all") q = q.eq("admin_status", adminStatusFilter);
      const { data, error } = await q;
      if (error) throw error;
      // Tri client : import_count × total_quantity DESC
      return ((data || []) as Item[]).sort((a, b) => demandScore(b) - demandScore(a));
    },
  });

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["admin-sourcing-brands"],
    queryFn: async (): Promise<BrandRow[]> => {
      const { data, error } = await sb
        .from("admin_sourcing_items_by_brand_v")
        .select("*")
        .limit(500);
      if (error) throw error;
      return ((data || []) as BrandRow[]).sort((a, b) => brandDemandScore(b) - brandDemandScore(a));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.raw_name, it.raw_brand, it.gtin, it.cnk]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [items, search]);

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = brands;
    if (brandScope === "absent") {
      rows = rows.filter((b) => b.medikong_active_products_count === 0);
    } else if (brandScope === "thin") {
      rows = rows.filter(
        (b) => b.medikong_active_products_count > 0 && b.medikong_active_products_count < thinThreshold
      );
    }
    if (q) rows = rows.filter((b) => b.brand_label.toLowerCase().includes(q));
    return rows;
  }, [brands, search, brandScope, thinThreshold]);

  const setAdminStatus = useMutation({
    mutationFn: async ({ id, admin_status }: { id: string; admin_status: AdminStatus }) => {
      const { error } = await sb
        .from("buyer_comparator_sourcing_items")
        .update({ admin_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-sourcing-items"] });
      qc.invalidateQueries({ queryKey: ["admin-sourcing-brands"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const exportProductsXlsx = () => {
    const rows = filtered.map((it) => ({
      Produit: it.raw_name ?? "",
      Marque: it.raw_brand ?? "",
      GTIN: it.gtin ?? "",
      CNK: it.cnk ?? "",
      Statut: STATUS_LABEL[it.status],
      Traitement: ADMIN_STATUS_LABEL[it.admin_status],
      "Score demande": demandScore(it),
      Imports: it.import_count,
      Acheteurs: it.user_count,
      "Σ Quantité": Number(it.total_quantity),
      "Prix achat min (€)": it.buyer_price_min_cents != null ? it.buyer_price_min_cents / 100 : "",
      "Prix achat moy (€)": it.buyer_price_avg_cents != null ? it.buyer_price_avg_cents / 100 : "",
      "Prix achat max (€)": it.buyer_price_max_cents != null ? it.buyer_price_max_cents / 100 : "",
      "Première vue": it.first_seen_at,
      "Dernière vue": it.last_seen_at,
      "Product ID MK": it.product_id ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produits à sourcer");
    XLSX.writeFile(wb, `sourcing-produits-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportBrandsXlsx = () => {
    const rows = filteredBrands.map((b) => ({
      Marque: b.brand_label,
      "Présence MK": b.medikong_active_products_count === 0 ? "Absente" : "Présente",
      "Produits actifs MK": b.medikong_active_products_count,
      "Score demande": brandDemandScore(b),
      "Réf. demandées": b.items_count,
      Imports: b.total_imports,
      Acheteurs: b.total_users,
      "Σ Quantité": Number(b.total_quantity),
      Inconnu: b.unmatched_count,
      Désactivé: b.inactive_count,
      "Sans offre": b.no_offer_count,
      "Dernière vue": b.last_seen_at,
      "Brand ID MK": b.brand_id ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marques à sourcer");
    XLSX.writeFile(wb, `sourcing-marques-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <AdminTopBar title="Pipeline sourcing" />

      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour admin
          </Link>
          <h1 className="text-2xl font-bold mt-2">Pipeline sourcing — Comparateur acheteur</h1>
          <p className="text-sm text-muted-foreground">
            Références demandées par les acheteurs et indisponibles sur MediKong (non matchées, désactivées ou sans offre).
            Tri par <strong>score demande</strong> = nb imports × Σ quantité.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Recherche : nom, marque, GTIN, CNK…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="unmatched">Inconnu (à créer)</SelectItem>
            <SelectItem value="inactive_product">Produit désactivé</SelectItem>
            <SelectItem value="no_active_offer">Actif sans offre</SelectItem>
          </SelectContent>
        </Select>
        <Select value={adminStatusFilter} onValueChange={(v) => setAdminStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Traitement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous traitements</SelectItem>
            <SelectItem value="todo">À traiter</SelectItem>
            <SelectItem value="sourcing">En sourcing</SelectItem>
            <SelectItem value="refused">Refusé</SelectItem>
            <SelectItem value="resolved">Résolu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products"><Package className="w-4 h-4 mr-1" /> Produits à sourcer ({filtered.length})</TabsTrigger>
          <TabsTrigger value="brands"><Tag className="w-4 h-4 mr-1" /> Marques à sourcer ({filteredBrands.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportProductsXlsx} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Export XLSX ({filtered.length})
            </Button>
          </div>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit / Référence</TableHead>
                  <TableHead>Marque</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Imports</TableHead>
                  <TableHead className="text-right">Acheteurs</TableHead>
                  <TableHead className="text-right">Σ Qté</TableHead>
                  <TableHead className="text-right">Prix achat min/moy/max</TableHead>
                  <TableHead>Vu le</TableHead>
                  <TableHead>Traitement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Aucun item.</TableCell></TableRow>
                )}
                {filtered.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium truncate">{it.raw_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.gtin && <span>GTIN {it.gtin}</span>}
                        {it.gtin && it.cnk && " · "}
                        {it.cnk && <span>CNK {it.cnk}</span>}
                      </div>
                      {it.product_id && (
                        <Link to={`/admin/produits/${it.product_id}`} className="text-xs text-primary hover:underline">
                          Voir produit →
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{it.raw_brand ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[it.status]}>
                        {STATUS_LABEL[it.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{demandScore(it).toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.import_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{it.user_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(it.total_quantity).toLocaleString("fr-BE")}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatCents(it.buyer_price_min_cents)} / {formatCents(it.buyer_price_avg_cents)} / {formatCents(it.buyer_price_max_cents)}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(it.last_seen_at)}</TableCell>
                    <TableCell>
                      <Select
                        value={it.admin_status}
                        onValueChange={(v) => setAdminStatus.mutate({ id: it.id, admin_status: v as AdminStatus })}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ADMIN_STATUS_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={brandScope} onValueChange={(v) => setBrandScope(v as BrandScope)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes (absentes + faibles)</SelectItem>
                  <SelectItem value="absent">Absentes de MediKong</SelectItem>
                  <SelectItem value="thin">Présentes mais faibles (&lt; N produits actifs)</SelectItem>
                </SelectContent>
              </Select>
              {brandScope === "thin" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Seuil N :</span>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={thinThreshold}
                    onChange={(e) => setThinThreshold(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20"
                  />
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={exportBrandsXlsx} disabled={filteredBrands.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Export XLSX ({filteredBrands.length})
            </Button>
          </div>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marque</TableHead>
                  <TableHead>Présence MK</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Réf.</TableHead>
                  <TableHead className="text-right">Imports</TableHead>
                  <TableHead className="text-right">Acheteurs</TableHead>
                  <TableHead className="text-right">Σ Qté</TableHead>
                  <TableHead className="text-right">Inconnu</TableHead>
                  <TableHead className="text-right">Désact.</TableHead>
                  <TableHead className="text-right">Sans offre</TableHead>
                  <TableHead>Vu le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandsLoading && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
                )}
                {!brandsLoading && filteredBrands.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Aucune marque.</TableCell></TableRow>
                )}
                {filteredBrands.map((b) => {
                  const presenceLabel = b.medikong_active_products_count === 0
                    ? "Absente"
                    : `${b.medikong_active_products_count} actif(s)`;
                  const presenceClass = b.medikong_active_products_count === 0
                    ? "bg-orange-100 text-orange-800 border-orange-200"
                    : b.medikong_active_products_count < thinThreshold
                      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                      : "bg-green-100 text-green-800 border-green-200";
                  return (
                    <TableRow key={b.brand_key}>
                      <TableCell className="font-medium">
                        {b.brand_id ? (
                          <Link to={`/marques`} className="hover:underline">{b.brand_label}</Link>
                        ) : (
                          <span className="text-muted-foreground italic">{b.brand_label}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={presenceClass}>{presenceLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{brandDemandScore(b).toLocaleString("fr-BE")}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.items_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total_imports}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.total_users}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(b.total_quantity).toLocaleString("fr-BE")}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.unmatched_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.inactive_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.no_offer_count}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(b.last_seen_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSourcingPipeline;
