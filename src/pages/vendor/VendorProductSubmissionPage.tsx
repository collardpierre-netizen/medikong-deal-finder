import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2, Info, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isValidGtin, isValidCnk, normalizeDigits } from "@/lib/product-codes";
import { useCategorySuggestion } from "@/hooks/useCategorySuggestion";

const submissionSchema = z.object({
  product_name: z.string().trim().min(2, "Nom requis (min 2 caractères)").max(200, "Max 200 caractères"),
  brand_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  manufacturer_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  gtin: z.string().trim().max(14, "GTIN max 14 chiffres").regex(/^\d*$/, "Chiffres uniquement").optional().or(z.literal("")),
  cnk_code: z.string().trim().max(10, "CNK max 10 caractères").optional().or(z.literal("")),
  category_hint: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Max 1000 caractères").optional().or(z.literal("")),
});

type FormState = z.infer<typeof submissionSchema>;

const EMPTY: FormState = {
  product_name: "", brand_name: "", manufacturer_name: "",
  gtin: "", cnk_code: "", category_hint: "", notes: "",
};

export default function VendorProductSubmissionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: vendor } = useCurrentVendor();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: catSuggestion } = useCategorySuggestion(form.product_name, form.category_hint);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => { const { [key]: _, ...rest } = e; return rest; });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!vendor?.id) throw new Error("Vendeur introuvable");
      const parsed = submissionSchema.safeParse(form);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
        setErrors(errs);
        throw new Error("invalid");
      }
      // Validations métier complémentaires
      const errs: Record<string, string> = {};
      const gtin = parsed.data.gtin ? normalizeDigits(parsed.data.gtin) : "";
      const cnk = parsed.data.cnk_code ? normalizeDigits(parsed.data.cnk_code) : "";
      if (gtin && !isValidGtin(gtin)) errs.gtin = "Clé de contrôle GTIN invalide";
      if (cnk && !isValidCnk(cnk)) errs.cnk_code = "CNK invalide (7 chiffres attendus)";
      if (Object.keys(errs).length) { setErrors(errs); throw new Error("invalid"); }

      const payload = Object.fromEntries(
        Object.entries({ ...parsed.data, gtin, cnk_code: cnk }).filter(([, v]) => v && String(v).trim() !== "")
      );
      const { data, error } = await supabase
        .from("product_submissions")
        .insert({
          vendor_id: vendor.id,
          proposed_payload: payload as any,
          status: "submitted",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (id) => {
      toast({ title: "Proposition envoyée", description: "Notre équipe catalogue va l'examiner." });
      setForm(EMPTY);
      navigate(`/vendor/catalog?submission=${id}#mes-propositions`);
    },
    onError: (err: any) => {
      if (err?.message === "invalid") return;
      toast({ title: "Erreur", description: err?.message ?? "Envoi impossible", variant: "destructive" });
    },
  });

  const isPending = mutation.isPending;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/vendor/catalog"><ArrowLeft className="h-4 w-4 mr-1" /> Retour au catalogue</Link>
        </Button>
        <h1 className="text-xl font-bold text-[#1D2530]">Proposer un produit au catalogue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Soumettez une fiche produit qui n'existe pas encore sur MediKong. Notre équipe la valide
          (en général sous 48h) avant publication. Vous serez notifié dès la décision.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Plus la fiche est précise (GTIN/EAN, CNK, marque, fabricant), plus la validation est rapide.
          Pour soumettre plusieurs produits d'un coup, utilisez l'import CSV/XLSX disponible depuis le catalogue.
        </AlertDescription>
      </Alert>

      <Card className="p-4 md:p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="product_name">
            Nom du produit <span className="text-destructive">*</span>
          </Label>
          <Input
            id="product_name"
            value={form.product_name}
            onChange={(e) => update("product_name", e.target.value)}
            placeholder="Ex : Doliprane 1000mg comprimés boîte de 8"
            maxLength={200}
            aria-invalid={!!errors.product_name}
          />
          {errors.product_name && <p className="text-xs text-destructive">{errors.product_name}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand_name">Marque</Label>
            <Input
              id="brand_name"
              value={form.brand_name}
              onChange={(e) => update("brand_name", e.target.value)}
              placeholder="Ex : Doliprane"
              maxLength={120}
            />
            {errors.brand_name && <p className="text-xs text-destructive">{errors.brand_name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manufacturer_name">Fabricant</Label>
            <Input
              id="manufacturer_name"
              value={form.manufacturer_name}
              onChange={(e) => update("manufacturer_name", e.target.value)}
              placeholder="Ex : Sanofi"
              maxLength={120}
            />
            {errors.manufacturer_name && <p className="text-xs text-destructive">{errors.manufacturer_name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="gtin">GTIN / EAN-13</Label>
            <Input
              id="gtin"
              value={form.gtin}
              onChange={(e) => update("gtin", e.target.value.replace(/\D/g, ""))}
              placeholder="Ex : 3400930000000"
              inputMode="numeric"
              maxLength={14}
            />
            {errors.gtin && <p className="text-xs text-destructive">{errors.gtin}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnk_code">Code CNK (Belgique)</Label>
            <Input
              id="cnk_code"
              value={form.cnk_code}
              onChange={(e) => update("cnk_code", e.target.value.replace(/\D/g, ""))}
              placeholder="Ex : 1234567"
              inputMode="numeric"
              maxLength={10}
            />
            {errors.cnk_code && <p className="text-xs text-destructive">{errors.cnk_code}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category_hint">Catégorie suggérée</Label>
          <Input
            id="category_hint"
            value={form.category_hint}
            onChange={(e) => update("category_hint", e.target.value)}
            placeholder="Ex : Antalgiques, Hygiène buccale…"
            maxLength={120}
          />
          {catSuggestion?.name && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Suggestion auto : {catSuggestion.name}
            </p>
          )}
          {errors.category_hint && <p className="text-xs text-destructive">{errors.category_hint}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes complémentaires</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Conditionnement, dosage, packshot, lien fiche fabricant…"
            maxLength={1000}
            rows={4}
          />
          <p className="text-[11px] text-muted-foreground">{(form.notes ?? "").length} / 1000</p>
          {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 border-t">
          <Button variant="ghost" asChild disabled={isPending}>
            <Link to="/vendor/catalog">Annuler</Link>
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={isPending || !vendor?.id}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Soumettre la proposition
          </Button>
        </div>
      </Card>
    </div>
  );
}
