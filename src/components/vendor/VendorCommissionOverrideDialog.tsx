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
import { Percent, Settings2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useEffectiveCommission } from "@/hooks/useEffectiveCommission";

interface Props {
  vendorId: string;
  productId: string;
  productName?: string;
  /** Optionnel : si vous avez une offre, on affiche la cascade actuelle. */
  offerId?: string;
  triggerLabel?: string;
  /** Optionnel : remplace complètement le bouton trigger par défaut. */
  trigger?: React.ReactNode;
}

type Model = "flat_percentage" | "margin_split" | "fixed_amount";

export function VendorCommissionOverrideDialog({
  vendorId, productId, productName, offerId, triggerLabel, trigger,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<Model>("flat_percentage");
  const [rate, setRate] = useState<string>("");
  const [marginSplit, setMarginSplit] = useState<string>("");
  const [fixedAmount, setFixedAmount] = useState<string>("");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [note, setNote] = useState("");

  // Charge l'override existant éventuel
  const { data: existing, isLoading: loadingExisting } = useQuery({
    enabled: open,
    queryKey: ["vpc", vendorId, productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_product_commissions")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setModel((data.commission_model as Model) ?? "flat_percentage");
        setRate(data.commission_rate?.toString() ?? "");
        setMarginSplit(data.margin_split_pct?.toString() ?? "");
        setFixedAmount(data.fixed_commission_amount?.toString() ?? "");
        setValidFrom(data.valid_from ? data.valid_from.slice(0, 10) : "");
        setValidUntil(data.valid_until ? data.valid_until.slice(0, 10) : "");
        setNote(data.note ?? "");
      }
      return data;
    },
  });

  const eff = useEffectiveCommission(offerId);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        vendor_id: vendorId,
        product_id: productId,
        commission_model: model,
        commission_rate: model === "flat_percentage" && rate !== "" ? Number(rate) : null,
        margin_split_pct: model === "margin_split" && marginSplit !== "" ? Number(marginSplit) : null,
        fixed_commission_amount: model === "fixed_amount" && fixedAmount !== "" ? Number(fixedAmount) : null,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        note: note.trim() || null,
        status: "pending_approval",
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("vendor_product_commissions")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vendor_product_commissions")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Demande envoyée. Un admin MediKong va la valider.");
      qc.invalidateQueries({ queryKey: ["vpc", vendorId, productId] });
      qc.invalidateQueries({ queryKey: ["effective-commission"] });
      qc.invalidateQueries({ queryKey: ["admin-commission-overrides"] });
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Settings2 size={14} />
            {triggerLabel ?? "Personnaliser la commission"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Commission personnalisée sur ce produit</DialogTitle>
          <DialogDescription>
            {productName ? <>Produit : <strong>{productName}</strong>. </> : null}
            Votre proposition sera soumise à validation MediKong.
          </DialogDescription>
        </DialogHeader>

        {/* Cascade actuelle */}
        {offerId && eff.data && (
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

        {existing && (
          <div className="rounded-md border bg-amber-50 border-amber-200 p-3 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-700 mt-0.5" />
            <div>
              Une règle existe déjà pour ce produit (statut <strong>{existing.status}</strong>).
              {existing.status === "rejected" && existing.rejected_reason && (
                <div className="mt-1 italic">Motif du rejet : « {existing.rejected_reason} »</div>
              )}
              La modifier renverra la demande en validation.
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
              <Label htmlFor="rate" className="text-xs">Taux (%)</Label>
              <Input id="rate" type="number" min={0} max={50} step="0.1"
                value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex. 12" />
            </div>
          )}
          {model === "margin_split" && (
            <div>
              <Label htmlFor="ms" className="text-xs">Part conservée par le vendeur (%)</Label>
              <Input id="ms" type="number" min={0} max={100} step="1"
                value={marginSplit} onChange={(e) => setMarginSplit(e.target.value)} placeholder="ex. 60" />
            </div>
          )}
          {model === "fixed_amount" && (
            <div>
              <Label htmlFor="fa" className="text-xs">Montant € HTVA / unité</Label>
              <Input id="fa" type="number" min={0} step="0.01"
                value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} placeholder="ex. 0.50" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vf" className="text-xs flex items-center gap-1"><Clock size={11} /> Valide à partir du</Label>
              <Input id="vf" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="vu" className="text-xs flex items-center gap-1"><Clock size={11} /> Valide jusqu'au</Label>
              <Input id="vu" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="note" className="text-xs">Note pour l'admin</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : produit en surstock, marge négociée avec MediKong, campagne promo…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={onSubmit} disabled={upsertMutation.isPending || loadingExisting}>
            {existing ? "Resoumettre la règle" : "Soumettre la règle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
