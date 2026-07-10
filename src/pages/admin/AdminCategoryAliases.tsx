/**
 * /admin/categories/aliases
 *
 * CRUD des `category_source_aliases` (Qogita / imports → catégorie canonique)
 * + validation dry-run avant `apply_category_aliases`.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Search,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

type AliasRow = {
  id: string;
  source_path: string;
  source_locale: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_is_active: boolean | null;
  notes: string | null;
  created_at: string;
  pending_products: number;
  total_products: number;
};

type Cat = { id: string; slug: string; name: string; is_active: boolean };

type EditState = {
  id: string | null;
  source_path: string;
  source_locale: string;
  category_id: string;
  notes: string;
};

const EMPTY: EditState = { id: null, source_path: "", source_locale: "", category_id: "", notes: "" };

export default function AdminCategoryAliases() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [locale, setLocale] = useState<string>("all");
  const [onlyPending, setOnlyPending] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AliasRow | null>(null);
  const [catSearch, setCatSearch] = useState("");

  const listQuery = useQuery({
    queryKey: ["admin-category-aliases", search, locale, onlyPending],
    queryFn: async (): Promise<AliasRow[]> => {
      const { data, error } = await sb.rpc("admin_category_source_aliases_list", {
        _search: search || null,
        _locale: locale === "all" ? null : locale,
        _only_unmapped_products: onlyPending,
        _limit: 1000,
      });
      if (error) throw error;
      return (data || []) as AliasRow[];
    },
  });

  const previewQuery = useQuery({
    queryKey: ["admin-category-aliases-preview"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("admin_preview_apply_category_aliases");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row || {}) as {
        total_pending_products: number;
        matching_aliases: number;
        would_update_products: number;
      };
    },
    staleTime: 30_000,
  });

  const catsQuery = useQuery({
    queryKey: ["admin-active-categories-picker"],
    queryFn: async (): Promise<Cat[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Cat[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!edit,
  });

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    const base = catsQuery.data ?? [];
    if (!q) return base.slice(0, 300);
    return base.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)).slice(0, 300);
  }, [catsQuery.data, catSearch]);

  const upsert = useMutation({
    mutationFn: async (payload: EditState) => {
      const { data, error } = await sb.rpc("admin_upsert_category_source_alias", {
        _id: payload.id,
        _source_path: payload.source_path,
        _source_locale: payload.source_locale || null,
        _category_id: payload.category_id,
        _notes: payload.notes || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({ title: "Alias enregistré", description: "Rattachement automatique des produits en cours…" });
      setEdit(null);
      setCatSearch("");
      qc.invalidateQueries({ queryKey: ["admin-category-aliases"] });
      qc.invalidateQueries({ queryKey: ["admin-category-aliases-preview"] });
      runApply.mutate();
    },
    onError: (e: any) => {
      toast({ title: "Échec de l'enregistrement", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("admin_delete_category_source_alias", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Alias supprimé", description: "Rattachement automatique des produits en cours…" });
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-category-aliases"] });
      qc.invalidateQueries({ queryKey: ["admin-category-aliases-preview"] });
      runApply.mutate();
    },
    onError: (e: any) => {
      toast({ title: "Suppression impossible", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const runApply = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("admin_run_apply_category_aliases");
      if (error) throw error;
      return data as { updated_count: number | null; duration_ms: number | null };
    },
    onSuccess: (log) => {
      toast({
        title: "apply_category_aliases exécuté",
        description: `${(log?.updated_count ?? 0).toLocaleString("fr-BE")} produit(s) rattaché(s) en ${log?.duration_ms ?? 0} ms.`,
      });
      qc.invalidateQueries({ queryKey: ["admin-category-aliases"] });
      qc.invalidateQueries({ queryKey: ["admin-category-aliases-preview"] });
    },
    onError: (e: any) => {
      toast({ title: "Échec apply_category_aliases", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const rows = listQuery.data ?? [];
  const totals = useMemo(() => {
    const totalAliases = rows.length;
    const orphanTargets = rows.filter((r) => !r.category_id || r.category_is_active === false).length;
    const pending = rows.reduce((s, r) => s + Number(r.pending_products || 0), 0);
    return { totalAliases, orphanTargets, pending };
  }, [rows]);

  const preview = previewQuery.data;

  return (
    <div className="space-y-4">
      <AdminTopBar
        title="Alias catégories source"
        subtitle="Cartographie « libellé importé (Qogita, Febelco…) → catégorie canonique MediKong ». Valide le mapping avant chaque import."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setEdit({ ...EMPTY })}>
              <Plus className="mr-2 h-4 w-4" /> Nouvel alias
            </Button>
            <Button size="sm" variant="secondary" onClick={() => runApply.mutate()} disabled={runApply.isPending}>
              {runApply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Valider &amp; rattacher (apply)
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/categories/non-mappees">
                <ExternalLink className="mr-2 h-4 w-4" /> Libellés non mappés
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Alias enregistrés" value={totals.totalAliases} />
        <KpiCard
          label="Cibles orphelines / inactives"
          value={totals.orphanTargets}
          tone={totals.orphanTargets > 0 ? "danger" : "default"}
        />
        <KpiCard label="Produits en attente (dans la liste)" value={totals.pending} />
        <KpiCard
          label="Dry-run : produits rattachés à l'apply"
          value={preview?.would_update_products ?? 0}
          tone="info"
          hint={
            preview
              ? `${preview.matching_aliases} alias actifs sur ${preview.total_pending_products.toLocaleString("fr-BE")} produits actifs sans catégorie.`
              : "Chargement…"
          }
        />
      </div>

      {/* Filtres */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un libellé source, un nom ou un slug de catégorie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Langue</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="fr">fr</SelectItem>
              <SelectItem value="nl">nl</SelectItem>
              <SelectItem value="en">en</SelectItem>
              <SelectItem value="de">de</SelectItem>
              <SelectItem value="">— sans locale —</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={onlyPending} onCheckedChange={(v) => setOnlyPending(!!v)} />
          Uniquement les alias qui rattacheraient des produits
        </label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["admin-category-aliases"] });
            qc.invalidateQueries({ queryKey: ["admin-category-aliases-preview"] });
          }}
          disabled={listQuery.isFetching}
        >
          {listQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Rafraîchir
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {listQuery.isLoading ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Aucun alias ne correspond à ces filtres.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé source</TableHead>
                <TableHead>Langue</TableHead>
                <TableHead>Catégorie cible</TableHead>
                <TableHead className="text-right">Produits en attente</TableHead>
                <TableHead className="text-right">Total produits</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const targetKo = !r.category_id || r.category_is_active === false;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs max-w-[320px] truncate" title={r.source_path}>
                      {r.source_path}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.source_locale ? <Badge variant="outline">{r.source_locale}</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.category_id ? (
                        <div className="flex items-center gap-2">
                          {r.category_is_active === false ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> Inactive
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </Badge>
                          )}
                          <div>
                            <div className="font-medium">{r.category_name ?? "—"}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{r.category_slug ?? r.category_id}</div>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="destructive">Aucune cible</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.pending_products > 0 ? (
                        <span className="font-semibold text-amber-700">{r.pending_products.toLocaleString("fr-BE")}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.total_products.toLocaleString("fr-BE")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.notes ?? undefined}>
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant={targetKo ? "default" : "outline"}
                          onClick={() =>
                            setEdit({
                              id: r.id,
                              source_path: r.source_path,
                              source_locale: r.source_locale ?? "",
                              category_id: r.category_id ?? "",
                              notes: r.notes ?? "",
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(r)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) { setEdit(null); setCatSearch(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifier l'alias" : "Nouvel alias"}</DialogTitle>
            <DialogDescription>
              Le libellé source doit correspondre exactement à <span className="font-mono">products.category_name</span> tel qu'il arrive de la source (Qogita, Febelco…).
              La combinaison (libellé + langue) est unique.
            </DialogDescription>
          </DialogHeader>

          {edit && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Libellé source *</Label>
                <Input
                  value={edit.source_path}
                  onChange={(e) => setEdit({ ...edit, source_path: e.target.value })}
                  placeholder="ex. Baby Care > Infant Formula"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Langue source</Label>
                <Select value={edit.source_locale || "__none"} onValueChange={(v) => setEdit({ ...edit, source_locale: v === "__none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— sans locale —</SelectItem>
                    <SelectItem value="fr">fr</SelectItem>
                    <SelectItem value="nl">nl</SelectItem>
                    <SelectItem value="en">en</SelectItem>
                    <SelectItem value="de">de</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Catégorie cible *</Label>
                <Input
                  placeholder="Rechercher une catégorie active…"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-64 overflow-auto rounded border">
                  {catsQuery.isLoading ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Chargement…
                    </div>
                  ) : (
                    filteredCats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setEdit({ ...edit, category_id: c.id })}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between ${
                          edit.category_id === c.id ? "bg-primary/10" : ""
                        }`}
                      >
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{c.slug}</div>
                        </div>
                        {edit.category_id === c.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes (optionnel)</Label>
                <Textarea
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  placeholder="Contexte / source de la décision…"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEdit(null); setCatSearch(""); }}>Annuler</Button>
            <Button
              onClick={() => edit && upsert.mutate(edit)}
              disabled={!edit?.source_path || !edit?.category_id || upsert.isPending}
            >
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet alias ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'alias <span className="font-mono">{confirmDelete?.source_path}</span> sera supprimé. Les produits déjà rattachés conservent leur catégorie ; les futurs imports avec ce libellé ne seront plus rattachés automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
              disabled={remove.isPending}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "danger" | "info";
}) {
  const color =
    tone === "danger" ? "text-destructive" : tone === "info" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value.toLocaleString("fr-BE")}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
