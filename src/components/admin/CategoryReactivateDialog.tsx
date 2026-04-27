import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, History, Undo2, Clock, Filter, AlertTriangle,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
};

type Scope = "last_batch" | "all_inactive" | "manual_filter";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
}

const fmt = (n: number) => n.toLocaleString("fr-FR");

export default function CategoryReactivateDialog({ open, onOpenChange, categories }: Props) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<Scope>("last_batch");
  const [hours, setHours] = useState<number>(24);
  const [keyword, setKeyword] = useState<string>("");
  const [parentId, setParentId] = useState<string>("");
  const [cascadeProducts, setCascadeProducts] = useState<boolean>(true);
  const [confirming, setConfirming] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setScope("last_batch");
      setHours(24);
      setKeyword("");
      setParentId("");
      setCascadeProducts(true);
      setConfirming(false);
    }
  }, [open]);

  const inactiveCategories = useMemo(
    () => categories.filter((c) => !c.is_active),
    [categories],
  );

  // ---- Recent deactivation history (for "last_batch") --------------------
  const { data: recentDeactivations = [] } = useQuery({
    queryKey: ["category-bulk-actions", "recent-deactivations"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_bulk_actions")
        .select("id, action, created_at, category_count, product_count, scope, scope_params, performed_by_email, undone_at")
        .eq("action", "deactivate")
        .is("undone_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Compute target ids ------------------------------------------------
  const target = useMemo(() => {
    if (scope === "all_inactive") {
      const ids = inactiveCategories.map((c) => c.id);
      return { categoryIds: ids, scopeParams: {}, sample: inactiveCategories.slice(0, 8) };
    }
    if (scope === "manual_filter") {
      const kw = keyword.trim().toLowerCase();
      const filtered = inactiveCategories.filter((c) => {
        if (kw && !c.name.toLowerCase().includes(kw)) return false;
        if (parentId) {
          // include cat if it IS the parent or has parentId chain matching
          const isUnder = (id: string | null): boolean => {
            if (!id) return false;
            if (id === parentId) return true;
            const p = categories.find((x) => x.id === id);
            return isUnder(p?.parent_id ?? null);
          };
          if (!(c.id === parentId || isUnder(c.parent_id))) return false;
        }
        return true;
      });
      return {
        categoryIds: filtered.map((c) => c.id),
        scopeParams: { keyword: kw || null, parent_id: parentId || null },
        sample: filtered.slice(0, 8),
      };
    }
    // last_batch — use the most recent deactivation that still has IDs
    const last = (recentDeactivations as any[]).find(
      (r) => Array.isArray(r.scope_params?.affected_ids) || (r.category_count ?? 0) > 0,
    );
    if (!last) return { categoryIds: [] as string[], scopeParams: { hours }, sample: [] as Category[] };
    // We didn't store affected_ids in scope_params — fetch from row's id
    return {
      categoryIds: [],
      scopeParams: { hours, source_action_id: last.id },
      lastAction: last,
      sample: [] as Category[],
    } as any;
  }, [scope, inactiveCategories, keyword, parentId, categories, recentDeactivations, hours]);

  // For "last_batch" we need to fetch actual category_ids from the source action
  const { data: lastBatchIds = [] } = useQuery({
    queryKey: ["category-bulk-actions", "last-batch-ids", (target as any)?.scopeParams?.source_action_id, hours],
    enabled: open && scope === "last_batch" && !!(target as any)?.scopeParams?.source_action_id,
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("category_bulk_actions")
        .select("category_ids, product_ids, created_at")
        .eq("action", "deactivate")
        .is("undone_at", null)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const cats = new Set<string>();
      const prods = new Set<string>();
      for (const row of data ?? []) {
        for (const id of row.category_ids ?? []) cats.add(id);
        for (const id of row.product_ids ?? []) prods.add(id);
      }
      return { catIds: Array.from(cats), productIds: Array.from(prods) };
    },
  });

  const effective = useMemo(() => {
    if (scope === "last_batch") {
      const lb = lastBatchIds as any;
      const ids: string[] = lb?.catIds ?? [];
      const sample = ids
        .map((id) => categories.find((c) => c.id === id))
        .filter(Boolean)
        .slice(0, 8) as Category[];
      return {
        categoryIds: ids,
        previousProductIds: (lb?.productIds ?? []) as string[],
        sample,
      };
    }
    return {
      categoryIds: (target as any).categoryIds as string[],
      previousProductIds: [] as string[],
      sample: (target as any).sample as Category[],
    };
  }, [scope, target, lastBatchIds, categories]);

  // ---- Mutation ---------------------------------------------------------
  const reactivate = useMutation({
    mutationFn: async () => {
      const ids = effective.categoryIds;
      if (ids.length === 0) throw new Error("Aucune catégorie à réactiver pour ce périmètre.");

      // 1) Reactivate categories
      const { error: catErr } = await supabase
        .from("categories")
        .update({ is_active: true })
        .in("id", ids);
      if (catErr) throw catErr;

      // 2) Cascade products (limited to those previously deactivated when known)
      let touchedProductIds: string[] = [];
      if (cascadeProducts) {
        if (scope === "last_batch" && effective.previousProductIds.length > 0) {
          // Restore exactly the products that were deactivated in the captured batch
          const chunk = 500;
          for (let i = 0; i < effective.previousProductIds.length; i += chunk) {
            const slice = effective.previousProductIds.slice(i, i + chunk);
            const { error } = await supabase
              .from("products")
              .update({ is_active: true })
              .in("id", slice);
            if (error) throw error;
          }
          touchedProductIds = effective.previousProductIds;
        } else {
          // Reactivate every inactive product whose category is in scope
          // Fetch the IDs first to be able to log them.
          const { data: prods, error: pErr } = await supabase
            .from("products")
            .select("id")
            .in("category_id", ids)
            .eq("is_active", false);
          if (pErr) throw pErr;
          touchedProductIds = (prods ?? []).map((p: any) => p.id);
          if (touchedProductIds.length > 0) {
            const chunk = 500;
            for (let i = 0; i < touchedProductIds.length; i += chunk) {
              const slice = touchedProductIds.slice(i, i + chunk);
              const { error } = await supabase
                .from("products")
                .update({ is_active: true })
                .in("id", slice);
              if (error) throw error;
            }
          }
        }
      }

      // 3) Audit log
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      const email = userRes?.user?.email ?? null;
      if (!uid) throw new Error("Session admin introuvable.");

      const { data: actionRow, error: logErr } = await supabase
        .from("category_bulk_actions")
        .insert({
          action: "reactivate",
          scope,
          scope_params: (target as any).scopeParams ?? {},
          category_ids: ids,
          product_ids: touchedProductIds,
          category_count: ids.length,
          product_count: touchedProductIds.length,
          cascade_products: cascadeProducts,
          performed_by: uid,
          performed_by_email: email,
        })
        .select("id")
        .single();
      if (logErr) throw logErr;

      return {
        actionId: actionRow!.id,
        categoryIds: ids,
        productIds: touchedProductIds,
      };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["category-bulk-actions"] });

      // Persistent toast w/ Undo (30s)
      toast.success(
        `${fmt(res.categoryIds.length)} catégorie(s) réactivée(s)` +
          (res.productIds.length > 0 ? ` + ${fmt(res.productIds.length)} produit(s)` : ""),
        {
          duration: 30_000,
          action: {
            label: "Annuler",
            onClick: () => undo.mutate({ sourceActionId: res.actionId, categoryIds: res.categoryIds, productIds: res.productIds }),
          },
        },
      );
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur réactivation"),
  });

  // ---- Undo mutation -----------------------------------------------------
  const undo = useMutation({
    mutationFn: async (vars: { sourceActionId: string; categoryIds: string[]; productIds: string[] }) => {
      const { categoryIds, productIds, sourceActionId } = vars;

      // Re-disable categories
      if (categoryIds.length > 0) {
        const { error } = await supabase
          .from("categories")
          .update({ is_active: false })
          .in("id", categoryIds);
        if (error) throw error;
      }
      // Re-disable products
      if (productIds.length > 0) {
        const chunk = 500;
        for (let i = 0; i < productIds.length; i += chunk) {
          const slice = productIds.slice(i, i + chunk);
          const { error } = await supabase
            .from("products")
            .update({ is_active: false })
            .in("id", slice);
          if (error) throw error;
        }
      }

      // Log undo action and chain to source
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      const email = userRes?.user?.email ?? null;
      const { data: undoRow, error: logErr } = await supabase
        .from("category_bulk_actions")
        .insert({
          action: "deactivate",
          scope: "manual_filter",
          scope_params: { undo_of: sourceActionId },
          category_ids: categoryIds,
          product_ids: productIds,
          category_count: categoryIds.length,
          product_count: productIds.length,
          cascade_products: productIds.length > 0,
          performed_by: uid,
          performed_by_email: email,
          notes: `Undo de ${sourceActionId}`,
        })
        .select("id")
        .single();
      if (logErr) throw logErr;

      // Mark source as undone
      const { error: upErr } = await supabase
        .from("category_bulk_actions")
        .update({ undone_at: new Date().toISOString(), undone_by: uid, undo_action_id: undoRow!.id })
        .eq("id", sourceActionId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["category-bulk-actions"] });
      toast.info("Réactivation annulée — retour à l'état précédent.");
    },
    onError: (e: any) => toast.error(`Annulation échouée : ${e.message}`),
  });

  const targetCount = effective.categoryIds.length;
  const canSubmit = targetCount > 0 && !reactivate.isPending;

  // ---- Render ------------------------------------------------------------
  const parents = categories.filter((c) => !c.parent_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            Réactiver les catégories
          </DialogTitle>
          <DialogDescription>
            Choisis le périmètre, prévisualise l'impact, puis confirme. Un bouton
            « Annuler » sera disponible 30 secondes après l'exécution, et l'action est
            tracée dans l'historique pour une annulation différée.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="last_batch" className="gap-1">
              <Clock size={14} /> Dernier batch
            </TabsTrigger>
            <TabsTrigger value="all_inactive" className="gap-1">
              <History size={14} /> Toutes inactives
            </TabsTrigger>
            <TabsTrigger value="manual_filter" className="gap-1">
              <Filter size={14} /> Filtres
            </TabsTrigger>
          </TabsList>

          {/* --- Tab: last_batch --- */}
          <TabsContent value="last_batch" className="space-y-3 mt-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="hours" className="text-sm whitespace-nowrap">
                Fenêtre de temps
              </Label>
              <Input
                id="hours"
                type="number"
                min={1}
                max={720}
                value={hours}
                onChange={(e) => setHours(Math.max(1, parseInt(e.target.value || "1")))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">heures (max 30 jours)</span>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              {recentDeactivations.length === 0 ? (
                <div className="text-muted-foreground">
                  Aucune désactivation tracée. Cette option ne couvre que les batches
                  effectués via les outils admin instrumentés.
                </div>
              ) : (
                <div>
                  <div className="font-medium mb-1">
                    Batches non annulés détectés ({recentDeactivations.length}) :
                  </div>
                  <ScrollArea className="max-h-32">
                    <ul className="space-y-1">
                      {(recentDeactivations as any[]).slice(0, 10).map((r) => (
                        <li key={r.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {new Date(r.created_at).toLocaleString("fr-FR")} —{" "}
                            <span className="text-foreground">{r.performed_by_email ?? "?"}</span>
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {fmt(r.category_count)} cat. / {fmt(r.product_count)} prod.
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          </TabsContent>

          {/* --- Tab: all_inactive --- */}
          <TabsContent value="all_inactive" className="space-y-3 mt-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              <AlertTriangle size={14} className="inline mr-1 text-amber-600" />
              Réactive <strong>toutes</strong> les catégories actuellement désactivées
              ({fmt(inactiveCategories.length)}), peu importe quand elles l'ont été.
            </div>
          </TabsContent>

          {/* --- Tab: manual_filter --- */}
          <TabsContent value="manual_filter" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kw" className="text-sm">Mot-clé dans le nom</Label>
                <Input
                  id="kw"
                  placeholder="ex: parfum"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="parent" className="text-sm">Parent racine</Label>
                <select
                  id="parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Tout —</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Filtre appliqué uniquement aux catégories actuellement <em>désactivées</em>.
            </p>
          </TabsContent>
        </Tabs>

        {/* --- Cascade option --- */}
        <div className="mt-4 flex items-start gap-2 rounded-md border p-3 bg-muted/20">
          <Checkbox
            id="cascade"
            checked={cascadeProducts}
            onCheckedChange={(v) => setCascadeProducts(!!v)}
            className="mt-0.5"
          />
          <Label htmlFor="cascade" className="text-sm cursor-pointer leading-snug">
            <span className="font-medium">Réactiver aussi les produits liés</span>
            <div className="text-xs text-muted-foreground mt-0.5">
              {scope === "last_batch"
                ? "Restaure exactement les produits qui avaient été désactivés dans le batch ciblé."
                : "Réactive tous les produits inactifs rattachés aux catégories ciblées."}
            </div>
          </Label>
        </div>

        {/* --- Preview --- */}
        <div className="mt-4 rounded-md border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Aperçu</span>
            <Badge variant={targetCount > 0 ? "default" : "secondary"}>
              {fmt(targetCount)} catégorie(s) ciblée(s)
            </Badge>
          </div>
          {effective.sample.length > 0 ? (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {effective.sample.map((c) => (
                <li key={c.id}>• {c.name}</li>
              ))}
              {targetCount > effective.sample.length && (
                <li className="italic">… et {fmt(targetCount - effective.sample.length)} autre(s)</li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {scope === "last_batch" && recentDeactivations.length === 0
                ? "Aucun batch traçable sur la fenêtre choisie."
                : "Aucune catégorie ne correspond au périmètre."}
            </p>
          )}
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={reactivate.isPending}>
            Annuler
          </Button>
          {!confirming ? (
            <Button
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ShieldCheck size={14} className="mr-1" />
              Continuer
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confirmer ?</span>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={reactivate.isPending}>
                Retour
              </Button>
              <Button
                size="sm"
                onClick={() => reactivate.mutate()}
                disabled={!canSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {reactivate.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Undo2 size={14} className="mr-1" />}
                Confirmer la réactivation
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
