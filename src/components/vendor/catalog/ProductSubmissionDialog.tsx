import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const submissionSchema = z.object({
  product_name: z.string().trim().min(2, "Nom requis (min 2 caractères)").max(200, "Max 200 caractères"),
  brand_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  manufacturer_name: z.string().trim().max(120, "Max 120 caractères").optional().or(z.literal("")),
  gtin: z.string().trim().max(14, "GTIN max 14 chiffres").regex(/^\d*$/, "Chiffres uniquement").optional().or(z.literal("")),
  cnk_code: z.string().trim().max(10, "CNK max 10 caractères").optional().or(z.literal("")),
  category_hint: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(1000, "Max 1000 caractères").optional().or(z.literal("")),
});

export function ProductSubmissionDialog({ children }: { children?: React.ReactNode }) {
  const { data: vendor } = useCurrentVendor();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "", brand_name: "", manufacturer_name: "",
    gtin: "", cnk_code: "", category_hint: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setForm({ product_name: "", brand_name: "", manufacturer_name: "", gtin: "", cnk_code: "", category_hint: "", notes: "" });
    setErrors({});
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
      setErrors({});
      const payload = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v && String(v).trim() !== "")
      );
      const { error } = await supabase.from("product_submissions").insert({
        vendor_id: vendor.id,
        proposed_payload: payload,
        status: "pending_review",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Proposition envoyée", description: "Notre équipe catalogue va l'examiner." });
      qc.invalidateQueries({ queryKey: ["vendor-submissions"] });
      reset();
      setOpen(false);
    },
    onError: (err: any) => {
      if (err?.message === "invalid") return;
      toast({ title: "Erreur", description: err?.message ?? "Envoi impossible", variant: "destructive" });
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-1">
            <Plus className="h-4 w-4" /> Proposer un produit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Proposer un produit au catalogue</DialogTitle>
          <DialogDescription>
            Renseignez ce que vous savez. Notre équipe validera la fiche avant publication.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Nom du produit *" error={errors.product_name}>
            <Input value={form.product_name} onChange={set("product_name")} maxLength={200} placeholder="Ex : Doliprane 1000mg comprimés" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marque" error={errors.brand_name}>
              <Input value={form.brand_name} onChange={set("brand_name")} maxLength={120} />
            </Field>
            <Field label="Fabricant" error={errors.manufacturer_name}>
              <Input value={form.manufacturer_name} onChange={set("manufacturer_name")} maxLength={120} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GTIN / EAN" error={errors.gtin}>
              <Input value={form.gtin} onChange={set("gtin")} maxLength={14} inputMode="numeric" />
            </Field>
            <Field label="CNK (BE)" error={errors.cnk_code}>
              <Input value={form.cnk_code} onChange={set("cnk_code")} maxLength={10} />
            </Field>
          </div>
          <Field label="Catégorie suggérée" error={errors.category_hint}>
            <Input value={form.category_hint} onChange={set("category_hint")} maxLength={120} placeholder="Ex : Antalgiques" />
          </Field>
          <Field label="Notes pour notre équipe" error={errors.notes}>
            <Textarea value={form.notes} onChange={set("notes")} maxLength={1000} rows={3}
              placeholder="Conditionnement, posologie, lien fournisseur…" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>Annuler</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !vendor?.id}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer la proposition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
