/**
 * /admin/categories/non-mappees
 *
 * Vue admin des libellés de catégorie source qui ne correspondent à aucune
 * catégorie canonique (`products.primary_category_id IS NULL`).
 *
 * Sources :
 *  - RPC `admin_unmapped_categories(_limit int)` : libellés bruts orphelins.
 *  - RPC `admin_create_category_and_map(...)` : crée la catégorie MK manquante,
 *    pose l'alias et rattache tous les produits en une seule passe.
 *  - RPC `admin_bulk_create_categories_and_map(_payload jsonb)` : version lot.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Search,
  Sparkles,
  TrendingUp,
  Plus,
  Loader2,
  Wand2,
  Link2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

type Row = {
  raw_label: string;
  product_count: number;
  has_alias: boolean;
  mapped_to_slug: string | null;
  mapped_to_name: string | null;
};

type MkParent = { id: string; slug: string; name: string };

const AdminUnmappedCategories = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [singleDialog, setSingleDialog] = useState<Row | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkParent, setBulkParent] = useState<string>("");
  const [bulkMapOpen, setBulkMapOpen] = useState(false);
  const [bulkMapTarget, setBulkMapTarget] = useState<string>("");
  const [bulkMapSearch, setBulkMapSearch] = useState<string>("");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-unmapped-categories", limit],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await sb.rpc("admin_unmapped_categories", { _limit: limit });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { data: mkParents = [] } = useQuery({
    queryKey: ["mk-parent-categories"],
    queryFn: async (): Promise<MkParent[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name")
        .like("slug", "mk-%")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as MkParent[];
    },
    staleTime: 5 * 60 * 1000,
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

  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.raw_label)),
    [filtered, selected]
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((r) => r.raw_label)));
    else setSelected(new Set());
  };
  const toggleOne = (label: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(label);
      else next.delete(label);
      return next;
    });
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-unmapped-categories"] });
  };

  const createOne = useMutation({
    mutationFn: async (payload: {
      raw_label: string;
      parent_id: string;
      name_fr?: string | null;
      name_nl?: string | null;
      name_en?: string | null;
    }) => {
      const { data, error } = await sb.rpc("admin_create_category_and_map", {
        _raw_label: payload.raw_label,
        _parent_id: payload.parent_id,
        _name_fr: payload.name_fr ?? null,
        _name_nl: payload.name_nl ?? null,
        _name_en: payload.name_en ?? null,
      });
      if (error) throw error;
      return (data || [])[0];
    },
    onSuccess: (res: any, vars) => {
      toast({
        title: "Catégorie créée",
        description: `${vars.raw_label} → ${res?.slug ?? "?"} (${res?.products_updated ?? 0} produit(s) rattaché(s))`,
      });
      setSingleDialog(null);
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(vars.raw_label);
        return n;
      });
      refresh();
    },
    onError: (e: any) => {
      toast({ title: "Échec création", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const bulkCreate = useMutation({
    mutationFn: async () => {
      if (!bulkParent) throw new Error("Choisis un parent");
      if (selectedRows.length === 0) throw new Error("Aucun libellé sélectionné");
      const payload = selectedRows.map((r) => ({
        raw_label: r.raw_label,
        parent_id: bulkParent,
      }));
      const { data, error } = await sb.rpc("admin_bulk_create_categories_and_map", {
        _payload: payload,
      });
      if (error) throw error;
      return data as Array<{ raw_label: string; products_updated: number; error: string | null }>;
    },
    onSuccess: (data) => {
      const ok = data.filter((d) => !d.error);
      const ko = data.filter((d) => d.error);
      const totalProducts = ok.reduce((s, d) => s + Number(d.products_updated || 0), 0);
      toast({
        title: `Traitement terminé`,
        description: `${ok.length} catégorie(s) créée(s), ${totalProducts} produit(s) rattaché(s)${
          ko.length ? `, ${ko.length} erreur(s) — première: ${ko[0].error}` : ""
        }`,
        variant: ko.length ? "destructive" : "default",
      });
      setBulkOpen(false);
      setSelected(new Set());
      refresh();
    },
    onError: (e: any) => {
      toast({ title: "Échec du lot", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  // Catégories existantes (toutes actives) pour le mode "rattacher à une catégorie existante"
  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin-all-active-categories"],
    queryFn: async (): Promise<{ id: string; slug: string; name: string }[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 5 * 60 * 1000,
    enabled: bulkMapOpen,
  });

  const filteredCategories = useMemo(() => {
    const q = bulkMapSearch.trim().toLowerCase();
    const base = allCategories;
    if (!q) return base.slice(0, 200);
    return base.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)).slice(0, 200);
  }, [allCategories, bulkMapSearch]);

  const bulkMap = useMutation({
    mutationFn: async () => {
      if (!bulkMapTarget) throw new Error("Choisis une catégorie cible");
      if (selectedRows.length === 0) throw new Error("Aucun libellé sélectionné");
      const { data, error } = await sb.rpc("admin_bulk_map_labels_to_category", {
        _labels: selectedRows.map((r) => r.raw_label),
        _category_id: bulkMapTarget,
      });
      if (error) throw error;
      return data as Array<{ raw_label: string; products_updated: number; error: string | null }>;
    },
    onSuccess: (data) => {
      const ok = data.filter((d) => !d.error);
      const ko = data.filter((d) => d.error);
      const totalProducts = ok.reduce((s, d) => s + Number(d.products_updated || 0), 0);
      toast({
        title: "Mapping appliqué",
        description: `${ok.length} alias rattaché(s), ${totalProducts} produit(s) mis à jour${
          ko.length ? `, ${ko.length} erreur(s) — première: ${ko[0].error}` : ""
        }`,
        variant: ko.length ? "destructive" : "default",
      });
      setBulkMapOpen(false);
      setBulkMapTarget("");
      setBulkMapSearch("");
      setSelected(new Set());
      refresh();
    },
    onError: (e: any) => {
      toast({ title: "Échec du mapping", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.raw_label));
  const someChecked = filtered.some((r) => selected.has(r.raw_label)) && !allChecked;

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Catégories non mappées"
        subtitle="Libellés de catégorie source pour lesquels aucun produit n'a encore reçu de primary_category_id."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="secondary" size="sm">
              <Link to="/admin/categories/dashboard">
                <TrendingUp className="mr-2 h-4 w-4" /> Tableau de bord
              </Link>
            </Button>
            <Button asChild variant="default" size="sm">
              <Link to="/admin/categories/qogita-mapping-llm">
                <Sparkles className="mr-2 h-4 w-4" /> Mapping LLM (passe 2)
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
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => setBulkMapOpen(true)}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Rattacher à une catégorie existante ({selected.size})
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={selected.size === 0}
            onClick={() => setBulkOpen(true)}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Créer & mapper la sélection ({selected.size})
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead>Libellé source</TableHead>
                <TableHead className="w-32 text-right">Produits</TableHead>
                <TableHead className="w-32">Alias</TableHead>
                <TableHead>Mapping cible</TableHead>
                <TableHead className="w-40 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-destructive py-8">
                    Erreur : {(error as any)?.message || "chargement impossible"}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Aucun libellé non mappé{search ? " correspondant au filtre" : ""}.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.raw_label}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.raw_label)}
                        onCheckedChange={(v) => toggleOne(r.raw_label, !!v)}
                        aria-label={`Sélectionner ${r.raw_label}`}
                      />
                    </TableCell>
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSingleDialog(r)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Créer & mapper
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Astuce : « Créer & mapper » génère une nouvelle catégorie sous le parent MK choisi,
          pose l'alias et rattache automatiquement tous les produits portant ce libellé brut.
        </p>
      </div>

      <SingleCreateDialog
        row={singleDialog}
        parents={mkParents}
        onClose={() => setSingleDialog(null)}
        onSubmit={(p) => createOne.mutate(p)}
        loading={createOne.isPending}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer & mapper en lot</DialogTitle>
            <DialogDescription>
              {selectedRows.length} libellé(s) seront créés comme sous-catégories du parent choisi.
              Le nom de chaque catégorie est le libellé source tel quel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Parent MK</Label>
              <Select value={bulkParent} onValueChange={setBulkParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un parent MK…" />
                </SelectTrigger>
                <SelectContent>
                  {mkParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-56 overflow-y-auto rounded border p-2 text-xs space-y-0.5">
              {selectedRows.map((r) => (
                <div key={r.raw_label} className="flex justify-between gap-2">
                  <span className="truncate">{r.raw_label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {Number(r.product_count).toLocaleString("fr-BE")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkCreate.isPending}>
              Annuler
            </Button>
            <Button
              onClick={() => bulkCreate.mutate()}
              disabled={!bulkParent || bulkCreate.isPending || selectedRows.length === 0}
            >
              {bulkCreate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Lancer la création
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMapOpen} onOpenChange={setBulkMapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rattacher la sélection à une catégorie existante</DialogTitle>
            <DialogDescription>
              {selectedRows.length} libellé(s) seront rattachés (création/écrasement d'alias)
              à la catégorie choisie. Les produits actifs portant ces libellés bruts seront
              automatiquement mis à jour.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Catégorie cible</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou slug…"
                  value={bulkMapSearch}
                  onChange={(e) => setBulkMapSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded border divide-y">
                {filteredCategories.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">Aucune catégorie correspondante.</div>
                ) : (
                  filteredCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBulkMapTarget(c.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between ${
                        bulkMapTarget === c.id ? "bg-accent" : ""
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2 truncate">{c.slug}</span>
                    </button>
                  ))
                )}
              </div>
              {allCategories.length > filteredCategories.length && !bulkMapSearch && (
                <p className="text-[11px] text-muted-foreground">
                  Affichage des 200 premières — affine la recherche pour cibler une catégorie précise.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Libellés à rattacher</Label>
              <div className="mt-1 max-h-40 overflow-y-auto rounded border p-2 text-xs space-y-0.5">
                {selectedRows.map((r) => (
                  <div key={r.raw_label} className="flex justify-between gap-2">
                    <span className="truncate">{r.raw_label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {Number(r.product_count).toLocaleString("fr-BE")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMapOpen(false)} disabled={bulkMap.isPending}>
              Annuler
            </Button>
            <Button
              onClick={() => bulkMap.mutate()}
              disabled={!bulkMapTarget || bulkMap.isPending || selectedRows.length === 0}
            >
              {bulkMap.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Rattacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type SingleProps = {
  row: Row | null;
  parents: MkParent[];
  onClose: () => void;
  onSubmit: (p: {
    raw_label: string;
    parent_id: string;
    name_fr?: string | null;
    name_nl?: string | null;
    name_en?: string | null;
  }) => void;
  loading: boolean;
};

const SingleCreateDialog = ({ row, parents, onClose, onSubmit, loading }: SingleProps) => {
  const [parentId, setParentId] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameNl, setNameNl] = useState("");
  const [nameEn, setNameEn] = useState("");

  // Reset on open
  const open = !!row;
  useMemo(() => {
    if (row) {
      setParentId("");
      setNameFr(row.raw_label);
      setNameNl("");
      setNameEn("");
    }
  }, [row]);

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer la catégorie depuis le libellé</DialogTitle>
          <DialogDescription>
            Libellé source : <strong>{row.raw_label}</strong> · {row.product_count} produit(s) à rattacher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Parent MK *</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un parent MK…" />
              </SelectTrigger>
              <SelectContent>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nom FR *</Label>
              <Input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nom NL</Label>
              <Input value={nameNl} onChange={(e) => setNameNl(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nom EN</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                raw_label: row.raw_label,
                parent_id: parentId,
                name_fr: nameFr || null,
                name_nl: nameNl || null,
                name_en: nameEn || null,
              })
            }
            disabled={!parentId || !nameFr.trim() || loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Créer & mapper
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUnmappedCategories;
