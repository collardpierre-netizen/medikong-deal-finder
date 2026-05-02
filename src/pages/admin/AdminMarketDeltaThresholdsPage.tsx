import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Sliders, Plus, Trash2, Globe, FolderTree, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";

type Scope = "global" | "category" | "product";

interface ThresholdRow {
  id: string;
  scope: Scope;
  category_id: string | null;
  product_id: string | null;
  threshold_pct: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  categories?: { id: string; name: string } | null;
  products?: { id: string; name: string; slug: string | null } | null;
}

const SCOPE_LABEL: Record<Scope, string> = {
  global: "Global",
  category: "Catégorie",
  product: "Produit",
};

const SCOPE_ICON: Record<Scope, typeof Globe> = {
  global: Globe,
  category: FolderTree,
  product: PackageIcon,
};

const fmtPct = (v: number) => `±${(v * 100).toFixed(1).replace(/\.0$/, "")} %`;

export default function AdminMarketDeltaThresholdsPage() {
  const qc = useQueryClient();
  const [scopeFilter, setScopeFilter] = useState<Scope | "all">("all");

  // Form state
  const [newScope, setNewScope] = useState<Scope>("category");
  const [newPct, setNewPct] = useState<string>("15");
  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newProductSearch, setNewProductSearch] = useState<string>("");
  const [newProductId, setNewProductId] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["market-delta-thresholds", scopeFilter],
    queryFn: async () => {
      let q = supabase
        .from("market_delta_thresholds" as never)
        .select("*, categories:category_id(id,name), products:product_id(id,name,slug)")
        .order("scope")
        .order("updated_at", { ascending: false });
      if (scopeFilter !== "all") q = q.eq("scope", scopeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ThresholdRow[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-light"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,parent_id")
        .order("name")
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: productSearch } = useQuery({
    queryKey: ["product-search-thr", newProductSearch],
    enabled: newScope === "product" && newProductSearch.trim().length >= 2,
    queryFn: async () => {
      const s = newProductSearch.trim();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,slug,cnk_code")
        .or(`name.ilike.%${s}%,cnk_code.ilike.%${s}%`)
        .eq("is_active", true)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const pct = Number(newPct.replace(",", ".")) / 100;
      if (!Number.isFinite(pct) || pct <= 0 || pct > 5) {
        throw new Error("Le seuil doit être entre 0 et 500 %");
      }
      const payload: any = {
        scope: newScope,
        threshold_pct: pct,
        notes: newNotes.trim() || null,
        is_active: true,
        category_id: null,
        product_id: null,
      };
      if (newScope === "category") {
        if (!newCategoryId) throw new Error("Sélectionnez une catégorie");
        payload.category_id = newCategoryId;
      } else if (newScope === "product") {
        if (!newProductId) throw new Error("Sélectionnez un produit");
        payload.product_id = newProductId;
      }
      // upsert manuel : si une règle active existe déjà pour la cible, on la désactive d'abord
      let target = (supabase.from("market_delta_thresholds" as never) as any).update({ is_active: false }).eq("scope", newScope).eq("is_active", true);
      if (newScope === "category") target = target.eq("category_id", newCategoryId);
      else if (newScope === "product") target = target.eq("product_id", newProductId);
      // global → on désactive l'ancien global
      const { error: e1 } = await target;
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("market_delta_thresholds" as never).insert(payload);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Seuil enregistré");
      qc.invalidateQueries({ queryKey: ["market-delta-thresholds"] });
      setNewPct("15");
      setNewCategoryId("");
      setNewProductId("");
      setNewProductSearch("");
      setNewNotes("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await (supabase
        .from("market_delta_thresholds" as never) as any)
        .update({ is_active: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market-delta-thresholds"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("market_delta_thresholds" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Règle supprimée");
      qc.invalidateQueries({ queryKey: ["market-delta-thresholds"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const stats = useMemo(() => {
    const list = rows ?? [];
    return {
      total: list.length,
      global: list.filter((r) => r.scope === "global" && r.is_active).length,
      category: list.filter((r) => r.scope === "category" && r.is_active).length,
      product: list.filter((r) => r.scope === "product" && r.is_active).length,
    };
  }, [rows]);

  const globalActive = (rows ?? []).find((r) => r.scope === "global" && r.is_active);

  return (
    <div className="space-y-6 p-6">
      <Helmet>
        <title>Seuils écarts prix · Admin · MediKong</title>
      </Helmet>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sliders className="h-6 w-6 text-primary" />
          Seuils d'écarts prix marché
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez le seuil d'alerte (±%) appliqué par la détection d'anomalies.
          Cascade : <strong>produit</strong> &gt; <strong>catégorie</strong> &gt; <strong>global</strong> &gt; 15 % par défaut.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Seuil global actif</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalActive ? fmtPct(globalActive.threshold_pct) : "—"}</div>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Règles globales</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.global}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Règles catégories</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.category}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Règles produits</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.product}</div></CardContent></Card>
      </div>

      {/* Formulaire création */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Ajouter / remplacer une règle</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Portée</Label>
            <Select value={newScope} onValueChange={(v) => setNewScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="category">Catégorie</SelectItem>
                <SelectItem value="product">Produit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Seuil (%)</Label>
            <Input
              type="number"
              step="0.1"
              min={0.1}
              max={500}
              value={newPct}
              onChange={(e) => setNewPct(e.target.value)}
              placeholder="15"
            />
          </div>
          {newScope === "category" && (
            <div className="md:col-span-2">
              <Label>Catégorie</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(categories ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {newScope === "product" && (
            <div className="md:col-span-2">
              <Label>Produit (recherche par nom / CNK)</Label>
              <Input
                value={newProductSearch}
                onChange={(e) => { setNewProductSearch(e.target.value); setNewProductId(""); }}
                placeholder="ex : fresubin, 0123456"
              />
              {productSearch && productSearch.length > 0 && (
                <div className="border border-border rounded-md mt-1 max-h-44 overflow-y-auto bg-background">
                  {productSearch.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted ${newProductId === p.id ? "bg-primary/10" : ""}`}
                      onClick={() => { setNewProductId(p.id); setNewProductSearch(p.name); }}
                    >
                      {p.name} {p.cnk_code && <span className="text-muted-foreground">· CNK {p.cnk_code}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="md:col-span-3">
            <Label>Note (optionnelle)</Label>
            <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="ex : nutrition médicale, marges plus serrées" />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
          <p className="md:col-span-4 text-[11px] text-muted-foreground">
            Une règle active déjà existante pour la même cible sera automatiquement désactivée et remplacée.
          </p>
        </CardContent>
      </Card>

      {/* Filtre + tableau */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Règles configurées</CardTitle>
          <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as typeof scopeFilter)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les portées</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="category">Catégorie</SelectItem>
              <SelectItem value="product">Produit</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !rows?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Aucune règle pour ce filtre.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Portée</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead className="text-right">Seuil</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-center">Actif</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const Icon = SCOPE_ICON[r.scope];
                  const target =
                    r.scope === "global" ? "—" :
                    r.scope === "category" ? r.categories?.name ?? "(catégorie supprimée)" :
                    r.products?.name ?? "(produit supprimé)";
                  return (
                    <TableRow key={r.id} className={r.is_active ? "" : "opacity-50"}>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {SCOPE_LABEL[r.scope]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{target}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{fmtPct(r.threshold_pct)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={r.notes ?? ""}>{r.notes ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={r.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: r.id, value: v })} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm("Supprimer cette règle ?")) remove.mutate(r.id);
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
