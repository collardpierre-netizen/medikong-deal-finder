import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Info, ShieldCheck, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

const CRITERIA = [
  { key: "rating_quality", label: "Qualité produit", help: "Conformité, packaging, fraîcheur, conformité des lots." },
  { key: "rating_delivery", label: "Livraison", help: "Respect des délais annoncés, état du colis à réception." },
  { key: "rating_support", label: "Support", help: "Réactivité commerciale, gestion des litiges et SAV." },
  { key: "rating_documentation", label: "Documentation", help: "Notices, fiches techniques, supports marketing fournis." },
  { key: "rating_margin", label: "Marge", help: "Cohérence du prix d'achat avec la marge officinale attendue." },
] as const;

type CriterionKey = typeof CRITERIA[number]["key"];

const ReviewSchema = z.object({
  rating_quality: z.number().int().min(1).max(5),
  rating_delivery: z.number().int().min(1).max(5),
  rating_support: z.number().int().min(1).max(5),
  rating_documentation: z.number().int().min(1).max(5),
  rating_margin: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

interface Props {
  brandId: string;
  brandName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandReviewModal({ brandId, brandName, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [ratings, setRatings] = useState<Record<CriterionKey, number>>({
    rating_quality: 0,
    rating_delivery: 0,
    rating_support: 0,
    rating_documentation: 0,
    rating_margin: 0,
  });
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const reset = () => {
    setRatings({ rating_quality: 0, rating_delivery: 0, rating_support: 0, rating_documentation: 0, rating_margin: 0 });
    setComment("");
    setErrors([]);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = ReviewSchema.safeParse({ ...ratings, comment: comment || undefined });
      if (!parsed.success) {
        throw new Error("Merci de noter chaque critère de 1 à 5 étoiles.");
      }
      const { data, error } = await supabase.rpc("submit_brand_review" as any, {
        _brand_id: brandId,
        _rating_quality: parsed.data.rating_quality,
        _rating_delivery: parsed.data.rating_delivery,
        _rating_support: parsed.data.rating_support,
        _rating_documentation: parsed.data.rating_documentation,
        _rating_margin: parsed.data.rating_margin,
        _comment: parsed.data.comment ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Merci, votre avis a bien été enregistré.");
      qc.invalidateQueries({ queryKey: ["brand-reviews", brandId] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Impossible d'enregistrer votre avis.";
      setErrors([msg]);
      toast.error(msg);
    },
  });

  const allRated = CRITERIA.every(c => ratings[c.key] >= 1);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Donnez votre avis sur {brandName}</DialogTitle>
          <DialogDescription className="text-xs">
            Réservé aux acheteurs ayant déjà commandé cette marque sur MediKong. Notez chaque critère séparément — aucune note globale n'est calculée.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider delayDuration={150}>
          <div className="space-y-3 py-2">
            {CRITERIA.map(({ key, label, help }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="text-sm text-mk-navy inline-flex items-center gap-1.5">
                  {label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-mk-ter hover:text-mk-blue" aria-label={`Aide ${label}`}>
                        <Info size={12} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatings(r => ({ ...r, [key]: n }))}
                      className="p-0.5 rounded hover:scale-110 transition-transform"
                      aria-label={`${label} : ${n} étoile${n > 1 ? "s" : ""}`}
                    >
                      <Star
                        size={20}
                        className={n <= ratings[key] ? "text-amber-500" : "text-mk-line"}
                        fill={n <= ratings[key] ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-1">
              <label className="text-xs text-mk-sec block mb-1">Commentaire (optionnel — 1000 caractères max)</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                placeholder="Partagez votre expérience concrète : qualité des lots, gestion des litiges, etc."
                maxLength={1000}
                rows={4}
              />
              <div className="text-[11px] text-mk-ter text-right mt-1">{comment.length}/1000</div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-mk-alt rounded-md text-[11px] text-mk-sec">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Pour la transparence : votre avis est attribué à vos initiales et à votre ville.
                Le nombre de commandes passées sur cette marque est calculé automatiquement et affiché publiquement.
                MediKong ne calcule aucune note globale.
              </span>
            </div>

            {errors.length > 0 && (
              <ul className="text-xs text-rose-600 list-disc pl-4">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        </TooltipProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Annuler
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!allRated || submit.isPending}>
            {submit.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
            Publier mon avis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
