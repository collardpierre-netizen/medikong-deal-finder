import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Percent, Tag, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useEffectiveCommission } from "@/hooks/useEffectiveCommission";

interface Props {
  offerId: string;
  productName?: string;
  /** Optionnel : remplace le bouton trigger par défaut */
  trigger?: React.ReactNode;
  triggerLabel?: string;
}

type Model = "flat_percentage" | "margin_split" | "fixed_amount";

/**
 * Override de commission sur UNE offre (priorité maximale dans la cascade).
 * Cible les colonnes commission_* de la table public.offers.
 * Le vendeur soumet en "pending_approval"; un admin approuve ensuite.
 */
export function OfferCommissionOverrideDialog({
  offerId, productName, trigger, triggerLabel,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<Model>("flat_percentage");
  const [rate, setRate] = useState<string>("");
  const [marginSplit, setMarginSplit] = useState<string>("");
  const [fixedAmount, setFixedAmount] = useState<string>("");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [reason, setReason] = useState("");

  // Charge l'override actuel de l'offre
  const { data: existing, isLoading: loadingExisting } = useQuery({
    enabled: open && !!offerId,
    queryKey: ["offer-commission-override", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, commission_model, commission_rate, margin_split_pct, fixed_commission_amount, commission_override_status, commission_valid_from, commission_valid_until, commission_override_reason")
        .eq("id", offerId)
        .maybeSingle();
      if (error) throw error;
      if (data?.commission_model) {
        setModel((data.commission_model as Model) ?? "flat_percentage");
        setRate(data.commission_rate?.toString() ?? "");
        setMarginSplit(data.margin_split_pct?.toString() ?? "");
        setFixedAmount(data.fixed_commission_amount?.toString() ?? "");
        setValidFrom(data.commission_valid_from ? String(data.commission_valid_from).slice(0, 10) : "");
        setValidUntil(data.commission_valid_until ? String(data.commission_valid_until).slice(0, 10) : "");
        setReason(data.commission_override_reason ?? "");
      }
      return data;
    },
  });

  const eff = useEffectiveCommission(offerId);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        commission_model: model,
        commission_rate: model === "flat_percentage" && rate !== "" ? Number(rate) : null,
        margin_split_pct: model === "margin_split" && marginSplit !== "" ? Number(marginSplit) : null,
        fixed_commission_amount: model === "fixed_amount" && fixedAmount !== "" ? Number(fixedAmount) : null,
        commission_valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        commission_valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        commission_override_reason: reason.trim() || null,
        commission_override_status: "pending_approval",
      };
      const { error } = await supabase.from("offers").update(payload).eq("id", offerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override offre soumis. Un admin MediKong va le valider.");
      qc.invalidateQueries({ queryKey: ["offer-commission-override", offerId] });
      qc.invalidateQueries({ queryKey: ["effective-commission", offerId] });
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-commission-overrides"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("offers").update({
        commission_model: null,
        commission_rate: null,
        margin_split_pct: null,
        fixed_commission_amount: null,
        commission_valid_from: null,
        commission_valid_until: null,
        commission_override_reason: null,
        commission_override_status: null,
      }).eq("id", offerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override offre supprimé. La commission par défaut s'applique.");
      qc.invalidateQueries({ queryKey: ["offer-commission-override", offerId] });
      qc.invalidateQueries({ queryKey: ["effective-commission", offerId] });
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const validate = (): string | null => {
    if (model === "flat_percentage") {
      if (rate === "" || isNaN(Number(rate))) return "Indiquez un taux %";
      if (Number(rate) < 0 || Number(rate) > 50) return "Taux compris entre 0 et 50 %";
    }
    if (model === "margin_split") {
      if (marginSplit === "" || isNaN(Number(marginSplit))) return "Indiquez la part vendeur %";
      if (Number(marginSplit) < 0 || Number(marginSplit) > 100) return "Part comprise entre 0 et 100 %";
    }
    if (model === "fixed_amount") {
      if (fixedAmount === "" || isNaN(Number(fixedAmount))) return "Indiquez le montant fixe €";
      if (Number(fixedAmount) < 0) return "Montant ≥ 0";
    }
    if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) {
      return "La fin doit être postérieure au début";
    }
    return null;
  };

  const onSubmit = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    upsertMutation.mutate();
  };

  const hasExistingOverride = !!(existing?.commission_model);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Tag size={14} />
            {triggerLabel ?? "Override sur cette offre"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Commission spécifique à cette offre</DialogTitle>
          <DialogDescription>
            {productName ? <>Produit : <strong>{productName}</strong>. </> : null}
            Override prioritaire sur la règle produit et le défaut vendeur. Soumis à validation MediKong.
          </DialogDescription>
        </DialogHeader>

        {/* Cascade actuelle */}
        {eff.data && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs flex items-center gap-2">
            <Percent size={14} className="text-mk-blue" />
            <div>
              Commission actuellement appliquée :{" "}
              <strong>
                {eff.data.commission_model === "flat_percentage"
                  ? `${eff.data.commission_rate ?? "—"} %`
                  : eff.data.commission_model === "margin_split"
                  ? `Split ${eff.data.margin_split_pct ?? "—"} %`
                  : `${eff.data.fixed_commission_amount ?? "—"} €/u.`}
              </strong>
              <Badge variant="outline" className="ml-2">
                source : {eff.data.source === "offer" ? "Offre" : eff.data.source === "product" ? "Produit" : "Défaut vendeur"}
              </Badge>
            </div>
          </div>
        )}

        {hasExistingOverride && (
          <div className="rounded-md border bg-amber-50 border-amber-200 p-3 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-700 mt-0.5" />
            <div>
              Un override offre existe déjà (statut <strong>{existing?.commission_override_status ?? "—"}</strong>).
              Le modifier renverra la demande en validation.
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Modèle de commission</Label>
            <RadioGroup value={model} onValueChange={(v) => setModel(v as Model)} className="mt-2 grid gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="flat_percentage" /> Pourcentage fixe (%)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="margin_split" /> Partage de marge (%)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="fixed_amount" /> Montant fixe par unité (€)
              </label>
            </RadioGroup>
          </div>

          {model === "flat_percentage" && (
            <div>
              <Label htmlFor="orate" className="text-xs">Taux (%)</Label>
              <Input id="orate" type="number" min={0} max={50} step="0.1"
                value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex. 10" />
            </div>
          )}
          {model === "margin_split" && (
            <div>
              <Label htmlFor="oms" className="text-xs">Part conservée par le vendeur (%)</Label>
              <Input id="oms" type="number" min={0} max={100} step="1"
                value={marginSplit} onChange={(e) => setMarginSplit(e.target.value)} placeholder="ex. 60" />
            </div>
          )}
          {model === "fixed_amount" && (
            <div>
              <Label htmlFor="ofa" className="text-xs">Montant € HTVA / unité</Label>
              <Input id="ofa" type="number" min={0} step="0.01"
                value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} placeholder="ex. 0.50" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ovf" className="text-xs flex items-center gap-1"><Clock size={11} /> Valide à partir du</Label>
              <Input id="ovf" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ovu" className="text-xs flex items-center gap-1"><Clock size={11} /> Valide jusqu'au</Label>
              <Input id="ovu" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="oreason" className="text-xs">Raison (visible admin)</Label>
            <Textarea id="oreason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : déstockage 30 jours, deal one-shot acheteur stratégique…" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {hasExistingOverride && (
            <Button
              variant="ghost"
              onClick={() => { if (confirm("Supprimer l'override offre ? La commission par défaut s'appliquera.")) resetMutation.mutate(); }}
              disabled={resetMutation.isPending}
              className="mr-auto text-destructive hover:text-destructive gap-1"
            >
              <RotateCcw size={14} /> Retirer l'override
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={onSubmit} disabled={upsertMutation.isPending || loadingExisting}>
            {hasExistingOverride ? "Resoumettre l'override" : "Soumettre l'override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
