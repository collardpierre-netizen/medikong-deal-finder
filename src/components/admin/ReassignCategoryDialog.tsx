import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

type AnomalyRowMin = {
  id: string;
  product_id: string;
  current_category_id: string | null;
  suggested_category_id: string | null;
  current_cat?: { id: string; name: string } | null;
  suggested_cat?: { id: string; name: string } | null;
  product?: { id: string; name: string; slug: string | null };
};

type CategoryOption = {
  id: string;
  name: string;
  name_fr: string | null;
  slug: string | null;
  parent_path: string | null;
};

export function ReassignCategoryDialog({
  anomaly,
  trigger,
}: {
  anomaly: AnomalyRowMin;
  trigger: React.ReactNode;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(anomaly.suggested_category_id ?? null);
  const [markValidated, setMarkValidated] = useState(true);

  useEffect(() => {
    if (open) setSelected(anomaly.suggested_category_id ?? null);
  }, [open, anomaly.suggested_category_id]);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, slug, parent_id")
        .eq("is_active", true)
        .order("name_fr", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; name_fr: string | null; slug: string | null; parent_id: string | null }>;
    },
  });

  const options = useMemo<CategoryOption[]>(() => {
    if (!categories) return [];
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories.map((c) => {
      const parent = c.parent_id ? byId.get(c.parent_id) : null;
      return {
        id: c.id,
        name: c.name_fr || c.name,
        name_fr: c.name_fr,
        slug: c.slug,
        parent_path: parent ? (parent.name_fr || parent.name) : null,
      };
    });
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options.slice(0, 200);
    return options
      .filter((o) =>
        o.name.toLowerCase().includes(q) ||
        (o.parent_path ?? "").toLowerCase().includes(q) ||
        (o.slug ?? "").toLowerCase().includes(q)
      )
      .slice(0, 200);
  }, [options, search]);

  const selectedOption = options.find((o) => o.id === selected) ?? null;
  const currentName = anomaly.current_cat?.name ?? "—";
  const suggestedName = anomaly.suggested_cat?.name ?? null;
  const isUnchanged = selected === anomaly.current_category_id;

  const reassign = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Sélectionne une catégorie cible");
      const { error } = await supabase.rpc("admin_apply_product_mapping", {
        _product_ids: [anomaly.product_id],
        _brand_id: null as any,
        _category_id: selected,
        _manufacturer_id: null as any,
        _mark_validated: markValidated,
      });
      if (error) throw error;
      // Re-run anomaly detection on this product to close the open ones
      await supabase.rpc("detect_product_category_anomalies", { _product_id: anomaly.product_id, _limit: null });
    },
    onSuccess: () => {
      toast({ title: "Catégorie réassignée", description: "Le produit a été mis à jour et les anomalies revérifiées." });
      qc.invalidateQueries({ queryKey: ["admin-category-anomalies"] });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Réassigner la catégorie</DialogTitle>
          <DialogDescription>
            Choisis la catégorie cible. Un aperçu avant/après s'affiche en bas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Produit</div>
            <div className="font-medium flex items-center gap-2">
              {anomaly.product?.name ?? anomaly.product_id}
              {anomaly.product?.slug && (
                <Link to={`/produit/${anomaly.product.slug}`} target="_blank" className="text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          <Input
            placeholder="Rechercher une catégorie (nom, parent, slug)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <div className="border rounded-lg max-h-64 overflow-auto divide-y">
            {isLoading && (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Aucune catégorie</div>
            )}
            {filtered.map((o) => {
              const isSel = o.id === selected;
              const isSuggested = o.id === anomaly.suggested_category_id;
              const isCurrent = o.id === anomaly.current_category_id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelected(o.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2 ${
                    isSel ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      {o.parent_path && <span className="text-muted-foreground">{o.parent_path} › </span>}
                      <span className="font-medium">{o.name}</span>
                    </div>
                    {o.slug && <div className="text-[11px] text-muted-foreground truncate">{o.slug}</div>}
                  </div>
                  {isSuggested && <Badge variant="secondary" className="gap-1"><Sparkles className="w-3 h-3" />suggérée</Badge>}
                  {isCurrent && <Badge variant="outline">actuelle</Badge>}
                  {isSel && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border rounded-lg p-3 bg-background">
            <div className="text-xs text-muted-foreground mb-2">Aperçu</div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <div className="text-[11px] text-muted-foreground">Avant</div>
                <div className="font-medium text-sm">{currentName}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-[140px]">
                <div className="text-[11px] text-muted-foreground">Après</div>
                <div className={`font-medium text-sm ${isUnchanged ? "text-muted-foreground" : "text-primary"}`}>
                  {selectedOption
                    ? `${selectedOption.parent_path ? selectedOption.parent_path + " › " : ""}${selectedOption.name}`
                    : "—"}
                </div>
                {suggestedName && selectedOption?.id === anomaly.suggested_category_id && (
                  <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    <Sparkles className="w-3 h-3" /> correspond à la suggestion
                  </div>
                )}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={markValidated}
              onChange={(e) => setMarkValidated(e.target.checked)}
            />
            Marquer comme validé manuellement (les jobs de re-mapping automatique ignoreront ce produit)
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => reassign.mutate()} disabled={reassign.isPending || !selected || isUnchanged}>
            {reassign.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirmer la réassignation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
