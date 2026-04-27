import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, AlertTriangle, X, ShieldOff, ShieldCheck, Calculator, Package, Tag } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Action = "disable" | "enable";

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  /** Default keywords (e.g. parfums) */
  defaultKeywords?: string[];
}

export default function CategoryKeywordDisableDialog({
  open,
  onOpenChange,
  categories,
  defaultKeywords = ["parfum", "fragrance", "perfume", "cologne", "eau de toilette", "eau de parfum"],
}: Props) {
  const qc = useQueryClient();
  const [action, setAction] = useState<Action>("disable");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(defaultKeywords);

  const byId = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, string[]>();
    categories.forEach((c) => {
      if (c.parent_id) {
        const arr = m.get(c.parent_id) ?? [];
        arr.push(c.id);
        m.set(c.parent_id, arr);
      }
    });
    return m;
  }, [categories]);

  // 1) Find every category whose name matches any keyword
  const directMatches = useMemo(() => {
    if (keywords.length === 0) return [] as Category[];
    const lowerKw = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
    return categories.filter((c) => {
      const n = c.name.toLowerCase();
      return lowerKw.some((k) => n.includes(k));
    });
  }, [categories, keywords]);

  // 2) Climb up to root for each match
  const rootsToDisable = useMemo(() => {
    const roots = new Set<string>();
    for (const cat of directMatches) {
      let cur: Category | undefined = cat;
      const seen = new Set<string>();
      while (cur && cur.parent_id && !seen.has(cur.id)) {
        seen.add(cur.id);
        const parent = byId.get(cur.parent_id);
        if (!parent) break;
        cur = parent;
      }
      if (cur) roots.add(cur.id);
    }
    return Array.from(roots).map((id) => byId.get(id)!).filter(Boolean);
  }, [directMatches, byId]);

  // 3) Compute every descendant of those roots (BFS)
  const allCategoryIdsToDisable = useMemo(() => {
    const out = new Set<string>();
    const queue = rootsToDisable.map((r) => r.id);
    while (queue.length) {
      const id = queue.shift()!;
      if (out.has(id)) continue;
      out.add(id);
      const kids = childrenByParent.get(id);
      if (kids) queue.push(...kids);
    }
    return Array.from(out);
  }, [rootsToDisable, childrenByParent]);

  const addKeyword = () => {
    const v = keywordInput.trim().toLowerCase();
    if (!v) return;
    if (!keywords.includes(v)) setKeywords([...keywords, v]);
    setKeywordInput("");
  };

  const newActive = action === "enable";

  // ---- SIMULATION (impact réel en base) ------------------------------------
  type SimResult = {
    categoriesActiveTotal: number;
    categoriesInactiveTotal: number;
    productsToFlip: number;
    productsAlreadyInState: number;
    activeOffersImpacted: number;
    sampleCategoryNames: string[];
    computedAt: string;
    keywordsHash: string;
  };
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const keywordsHash = useMemo(
    () => `${action}|${keywords.slice().sort().join("§")}|${allCategoryIdsToDisable.length}`,
    [action, keywords, allCategoryIdsToDisable],
  );
  const simStale = !sim || sim.keywordsHash !== keywordsHash;

  // Reset on dialog open / scope change
  useEffect(() => {
    setSim(null);
    setSimError(null);
  }, [open, action]);
  useEffect(() => {
    if (sim && sim.keywordsHash !== keywordsHash) setSim(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordsHash]);

  const runSimulation = async () => {
    setSimError(null);
    if (allCategoryIdsToDisable.length === 0) {
      setSim({
        categoriesActiveTotal: 0, categoriesInactiveTotal: 0,
        productsToFlip: 0, productsAlreadyInState: 0, activeOffersImpacted: 0,
        sampleCategoryNames: [], computedAt: new Date().toISOString(), keywordsHash,
      });
      return;
    }
    setSimLoading(true);
    try {
      const targetState = newActive;
      const catsActive = allCategoryIdsToDisable
        .map((id) => byId.get(id))
        .filter((c): c is Category => !!c && c.is_active).length;
      const catsInactive = allCategoryIdsToDisable.length - catsActive;

      const CHUNK = 200;
      let productsToFlip = 0;
      let productsAlreadyInState = 0;
      let activeOffersImpacted = 0;

      for (let i = 0; i < allCategoryIdsToDisable.length; i += CHUNK) {
        const slice = allCategoryIdsToDisable.slice(i, i + CHUNK);

        const flipPromise = supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .in("category_id", slice)
          .eq("is_active", !targetState);

        const samePromise = supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .in("category_id", slice)
          .eq("is_active", targetState);

        // Active offers attached to products that will flip state
        const offersPromise = supabase
          .from("offers")
          .select("id, products!inner(category_id, is_active)", { count: "exact", head: true })
          .eq("is_active", true)
          .in("products.category_id", slice)
          .eq("products.is_active", !targetState);

        const [flipRes, sameRes, offersRes] = await Promise.all([flipPromise, samePromise, offersPromise]);
        if (flipRes.error) throw flipRes.error;
        if (sameRes.error) throw sameRes.error;
        if (offersRes.error) throw offersRes.error;
        productsToFlip += flipRes.count ?? 0;
        productsAlreadyInState += sameRes.count ?? 0;
        activeOffersImpacted += offersRes.count ?? 0;
      }

      setSim({
        categoriesActiveTotal: catsActive,
        categoriesInactiveTotal: catsInactive,
        productsToFlip,
        productsAlreadyInState,
        activeOffersImpacted,
        sampleCategoryNames: rootsToDisable.slice(0, 6).map((r) => r.name),
        computedAt: new Date().toISOString(),
        keywordsHash,
      });
    } catch (e: any) {
      setSimError(e?.message ?? "Erreur de simulation");
    } finally {
      setSimLoading(false);
    }
  };

  const runMutation = useMutation({
    mutationFn: async () => {
      if (allCategoryIdsToDisable.length === 0) {
        throw new Error(`Aucune catégorie à ${newActive ? "réactiver" : "désactiver"}`);
      }

      // Update categories in chunks (avoid URL length limits)
      const chunk = 500;
      let catCount = 0;
      for (let i = 0; i < allCategoryIdsToDisable.length; i += chunk) {
        const slice = allCategoryIdsToDisable.slice(i, i + chunk);
        const { error } = await supabase.from("categories").update({ is_active: newActive }).in("id", slice);
        if (error) throw error;
        catCount += slice.length;
      }

      // Cascade to associated products
      let prodCount = 0;
      for (let i = 0; i < allCategoryIdsToDisable.length; i += chunk) {
        const slice = allCategoryIdsToDisable.slice(i, i + chunk);
        const { error, count } = await supabase
          .from("products")
          .update({ is_active: newActive }, { count: "exact" })
          .in("category_id", slice);
        if (error) throw error;
        prodCount += count ?? 0;
      }

      return { catCount, prodCount, rootCount: rootsToDisable.length, newActive };
    },
    onSuccess: (r) => {
      const verb = r.newActive ? "réactivée(s)" : "désactivée(s)";
      const verbProd = r.newActive ? "réactivé(s)" : "désactivé(s)";
      toast.success(
        `${r.rootCount} racine(s) ciblée(s) — ${r.catCount} catégorie(s) ${verb} et ${r.prodCount} produit(s) ${verbProd}`,
      );
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["homepage-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur lors de l'opération"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {newActive ? (
              <ShieldCheck size={18} className="text-emerald-600" />
            ) : (
              <ShieldOff size={18} className="text-destructive" />
            )}
            {newActive ? "Réactivation" : "Désactivation"} par mots-clés
          </DialogTitle>
          <DialogDescription>
            Saisissez des mots-clés (ex. <em>parfum</em>, <em>fragrance</em>). Toutes les catégories qui les contiennent
            seront identifiées, puis leurs <strong>racines</strong> et tous les <strong>descendants</strong> seront{" "}
            {newActive ? "réactivés" : "désactivés"}. Les produits associés seront également{" "}
            {newActive ? "rendus visibles" : "masqués"} du catalogue.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={action} onValueChange={(v) => setAction(v as Action)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="disable" className="gap-1.5">
              <ShieldOff size={14} /> Désactiver
            </TabsTrigger>
            <TabsTrigger value="enable" className="gap-1.5">
              <ShieldCheck size={14} /> Réactiver
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          {/* Keyword input */}
          <div className="space-y-2">
            <Label className="text-xs">Mots-clés</Label>
            <div className="flex gap-2">
              <Input
                placeholder="ex. parfum"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
              />
              <Button variant="outline" size="sm" onClick={addKeyword}>
                Ajouter
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <Badge key={k} variant="secondary" className="gap-1">
                  {k}
                  <button
                    onClick={() => setKeywords(keywords.filter((x) => x !== k))}
                    className="hover:text-destructive"
                    aria-label={`Retirer ${k}`}
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
              {keywords.length === 0 && (
                <span className="text-xs text-muted-foreground">Aucun mot-clé</span>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1">
                <Search size={12} /> Aperçu
              </span>
              <span className="text-muted-foreground">
                {directMatches.length} match(es) • {rootsToDisable.length} racine(s) • {allCategoryIdsToDisable.length} catégorie(s) au total
              </span>
            </div>

            {rootsToDisable.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Racines qui seront {newActive ? "réactivées" : "désactivées"}
                </div>
                <ScrollArea className="h-24 rounded border bg-background p-2">
                  <ul className="text-xs space-y-1">
                    {rootsToDisable.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.name}</span>
                        {!r.is_active && (
                          <Badge variant="outline" className="text-[10px]">déjà inactive</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {!newActive && rootsToDisable.some((r) => !r.is_active) && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                <AlertTriangle size={14} /> Certaines racines sont déjà inactives — l'opération les laissera inchangées.
              </div>
            )}
            {newActive && rootsToDisable.some((r) => r.is_active) && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                <ShieldCheck size={14} /> Certaines racines sont déjà actives — l'opération les laissera inchangées.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={runMutation.isPending}>
            Annuler
          </Button>
          <Button
            variant={newActive ? "default" : "destructive"}
            disabled={allCategoryIdsToDisable.length === 0 || runMutation.isPending}
            onClick={() => {
              const verb = newActive ? "réactivation" : "désactivation";
              if (
                confirm(
                  `Confirmer la ${verb} de ${rootsToDisable.length} racine(s) et ${allCategoryIdsToDisable.length} catégorie(s) au total ? Les produits associés seront également ${newActive ? "rendus visibles" : "masqués"}.`,
                )
              ) {
                runMutation.mutate();
              }
            }}
          >
            {runMutation.isPending ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                {newActive ? "Réactivation…" : "Désactivation…"}
              </>
            ) : (
              <>
                {newActive ? <ShieldCheck size={14} className="mr-1" /> : <ShieldOff size={14} className="mr-1" />}
                {newActive ? "Réactiver maintenant" : "Désactiver maintenant"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
