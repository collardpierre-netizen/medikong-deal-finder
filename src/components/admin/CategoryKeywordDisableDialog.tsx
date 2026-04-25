import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, AlertTriangle, X, ShieldOff, ShieldCheck } from "lucide-react";
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

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (allCategoryIdsToDisable.length === 0) throw new Error("Aucune catégorie à désactiver");

      // Update categories in chunks (avoid URL length limits)
      const chunk = 500;
      let catCount = 0;
      for (let i = 0; i < allCategoryIdsToDisable.length; i += chunk) {
        const slice = allCategoryIdsToDisable.slice(i, i + chunk);
        const { error } = await supabase.from("categories").update({ is_active: false }).in("id", slice);
        if (error) throw error;
        catCount += slice.length;
      }

      // Cascade: deactivate associated products
      let prodCount = 0;
      for (let i = 0; i < allCategoryIdsToDisable.length; i += chunk) {
        const slice = allCategoryIdsToDisable.slice(i, i + chunk);
        const { error, count } = await supabase
          .from("products")
          .update({ is_active: false }, { count: "exact" })
          .in("category_id", slice);
        if (error) throw error;
        prodCount += count ?? 0;
      }

      return { catCount, prodCount, rootCount: rootsToDisable.length };
    },
    onSuccess: (r) => {
      toast.success(
        `${r.rootCount} racine(s) ciblée(s) — ${r.catCount} catégorie(s) et ${r.prodCount} produit(s) désactivé(s)`,
      );
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["homepage-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur lors de la désactivation"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff size={18} className="text-destructive" />
            Désactivation par mots-clés
          </DialogTitle>
          <DialogDescription>
            Saisissez des mots-clés (ex. <em>parfum</em>, <em>fragrance</em>). Toutes les catégories qui les contiennent
            seront identifiées, puis leurs <strong>racines</strong> et tous les <strong>descendants</strong> seront
            désactivés. Les produits associés seront également masqués du catalogue.
          </DialogDescription>
        </DialogHeader>

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
                  Racines qui seront désactivées
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

            {keywords.length > 0 && rootsToDisable.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle size={14} /> Aucune catégorie ne correspond à ces mots-clés.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disableMutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={allCategoryIdsToDisable.length === 0 || disableMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  `Confirmer la désactivation de ${rootsToDisable.length} racine(s) et ${allCategoryIdsToDisable.length} catégorie(s) au total ? Les produits associés seront également masqués.`,
                )
              ) {
                disableMutation.mutate();
              }
            }}
          >
            {disableMutation.isPending ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" />
                Désactivation…
              </>
            ) : (
              <>
                <ShieldOff size={14} className="mr-1" />
                Désactiver maintenant
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
