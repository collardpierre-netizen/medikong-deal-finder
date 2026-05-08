/**
 * Bouton « Seed initial recommandé » pour la curation Home.
 *
 * - kind = 'brands'  : propose une liste cible de marques pharma/parapharma
 *   bien connues (recherche par nom ILIKE), insère celles trouvées et non
 *   encore curées.
 * - kind = 'products': propose le top N produits actifs par `popularity`
 *   (puis offer_count en tie-break) qui ne sont pas déjà curés.
 *
 * Le bouton ouvre un dialog de prévisualisation (trouvés / déjà curés /
 * introuvables) avant l'insertion en bulk.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HomeFeaturedLocale } from "./homeFeaturedConstants";

const sb = supabase as any;

// Liste cible — top marques pharma/parapharma BE/FR (visage + dermo + bébé +
// premiers soins). Adaptable plus tard via CMS.
const RECOMMENDED_BRAND_NAMES = [
  "La Roche-Posay",
  "Avène",
  "Vichy",
  "Bioderma",
  "Eucerin",
  "Uriage",
  "Nuxe",
  "Mustela",
  "Bepanthen",
  "Compeed",
  "Voltaren",
  "Daktarin",
  "Tena",
  "Mepilex",
  "Ducray",
  "Klorane",
  "ISDIN",
  "Caudalie",
  "Weleda",
  "A-Derma",
];

const PRODUCTS_TARGET_TOP_N = 10;

type Kind = "brands" | "products";

type BrandHit = { id: string; name: string; slug: string };
type ProductHit = { id: string; name: string; slug: string; brand_name: string | null };

export function HomeSeedRecommendedButton({
  kind,
  locale,
  existingIds,
}: {
  kind: Kind;
  locale: HomeFeaturedLocale;
  existingIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const preview = useQuery({
    queryKey: ["admin-home-seed-preview", kind, locale, [...existingIds].sort().join(",")],
    enabled: open,
    queryFn: async () => {
      if (kind === "brands") {
        // Recherche en parallèle marque par marque (ILIKE), on garde le premier match actif.
        const results = await Promise.all(
          RECOMMENDED_BRAND_NAMES.map(async (name) => {
            const { data } = await sb
              .from("brands")
              .select("id, name, slug, is_active")
              .ilike("name", name)
              .eq("is_active", true)
              .limit(1);
            return { target: name, hit: (data?.[0] as BrandHit | undefined) ?? null };
          }),
        );
        const found: BrandHit[] = [];
        const already: BrandHit[] = [];
        const missing: string[] = [];
        for (const r of results) {
          if (!r.hit) missing.push(r.target);
          else if (existingIds.has(r.hit.id)) already.push(r.hit);
          else found.push(r.hit);
        }
        return { found, already, missing };
      }
      // products
      const { data, error } = await sb
        .from("products")
        .select("id, name, slug, brand_name, is_active, popularity, offer_count")
        .eq("is_active", true)
        .order("popularity", { ascending: false, nullsFirst: false })
        .order("offer_count", { ascending: false, nullsFirst: false })
        .limit(PRODUCTS_TARGET_TOP_N * 2);
      if (error) throw error;
      const all = (data || []) as Array<ProductHit & { popularity: number | null }>;
      const found: ProductHit[] = [];
      const already: ProductHit[] = [];
      for (const p of all) {
        if (existingIds.has(p.id)) already.push(p);
        else if (found.length < PRODUCTS_TARGET_TOP_N) found.push(p);
      }
      return { found, already, missing: [] as string[] };
    },
  });

  const insertBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const table = kind === "brands" ? "home_featured_brands" : "home_featured_products";
      const idCol = kind === "brands" ? "brand_id" : "product_id";
      // Position de départ après les éléments existants.
      const startPos = existingIds.size + 1;
      const rows = ids.map((id, i) => ({
        [idCol]: id,
        locale,
        position: startPos + i,
      }));
      const { error } = await sb.from(table).insert(rows);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} ${kind === "brands" ? "marque(s)" : "produit(s)"} ajouté(s)`);
      setOpen(false);
      if (kind === "brands") {
        qc.invalidateQueries({ queryKey: ["admin-home-featured-brands"] });
        qc.invalidateQueries({ queryKey: ["home-featured-brands-curated"] });
      } else {
        qc.invalidateQueries({ queryKey: ["admin-home-featured-products"] });
        qc.invalidateQueries({ queryKey: ["home-featured-products-curated"] });
      }
    },
    onError: (err: any) => toast.error("Insertion impossible : " + (err?.message || "")),
  });

  const foundIds = useMemo(
    () => (preview.data?.found ?? []).map((x: any) => x.id),
    [preview.data],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Seed initial recommandé
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Seed initial — {kind === "brands" ? "Marques" : "Produits"} recommandés
          </DialogTitle>
          <DialogDescription>
            {kind === "brands"
              ? `Liste cible de ${RECOMMENDED_BRAND_NAMES.length} marques. Seules celles trouvées en base et non encore curées seront insérées (locale : ${locale}).`
              : `Top ${PRODUCTS_TARGET_TOP_N} produits actifs par popularité, hors produits déjà curés (locale : ${locale}).`}
          </DialogDescription>
        </DialogHeader>

        {preview.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Analyse en cours…</div>
        ) : preview.data ? (
          <ScrollArea className="max-h-[420px] pr-3">
            <div className="space-y-4">
              <SectionList
                title={`À insérer (${preview.data.found.length})`}
                tone="success"
                items={preview.data.found.map((x: any) => x.name + (x.brand_name ? ` — ${x.brand_name}` : ""))}
                emptyLabel="Rien à ajouter."
              />
              <SectionList
                title={`Déjà curées (${preview.data.already.length})`}
                tone="muted"
                items={preview.data.already.map((x: any) => x.name)}
                emptyLabel="—"
              />
              {kind === "brands" && (
                <SectionList
                  title={`Introuvables en base (${preview.data.missing.length})`}
                  tone="warning"
                  items={preview.data.missing}
                  emptyLabel="—"
                />
              )}
            </div>
          </ScrollArea>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            disabled={foundIds.length === 0 || insertBulk.isPending}
            onClick={() => insertBulk.mutate(foundIds)}
          >
            Insérer {foundIds.length} élément{foundIds.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionList({
  title,
  tone,
  items,
  emptyLabel,
}: {
  title: string;
  tone: "success" | "muted" | "warning";
  items: string[];
  emptyLabel: string;
}) {
  const Icon = tone === "success" ? Check : tone === "warning" ? AlertTriangle : X;
  const variant = tone === "success" ? "default" : tone === "warning" ? "destructive" : "secondary";
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Badge variant={variant as any} className="gap-1">
          <Icon className="h-3 w-3" />
          {title}
        </Badge>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground pl-1">{emptyLabel}</div>
      ) : (
        <ul className="text-sm space-y-0.5 pl-1">
          {items.map((it) => (
            <li key={it} className="truncate">• {it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
