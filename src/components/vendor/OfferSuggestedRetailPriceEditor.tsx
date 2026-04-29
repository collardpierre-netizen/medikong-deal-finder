import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Lock, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  offerId: string;
  vendorId: string;
  productId: string;
  initialPriceCents?: number | null;
  initialSource?: string | null;
}

/**
 * Encart "Prix Public Conseillé (PVP)" dans le formulaire d'édition d'offre vendeur.
 * - Visible uniquement si le vendeur est autorisé (fabricant ou distributeur officiel de la marque).
 * - Sinon : message explicatif avec icône cadenas.
 */
export default function OfferSuggestedRetailPriceEditor({
  offerId,
  vendorId,
  productId,
  initialPriceCents,
  initialSource,
}: Props) {
  const qc = useQueryClient();
  const [price, setPrice] = useState<string>(
    initialPriceCents != null ? (initialPriceCents / 100).toFixed(2) : ""
  );
  const [source, setSource] = useState<string>(initialSource ?? "manufacturer");

  useEffect(() => {
    setPrice(initialPriceCents != null ? (initialPriceCents / 100).toFixed(2) : "");
    setSource(initialSource ?? "manufacturer");
  }, [initialPriceCents, initialSource]);

  const { data: canEdit, isLoading } = useQuery({
    queryKey: ["can-set-pvp", vendorId, productId],
    enabled: !!vendorId && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_vendor_set_suggested_price", {
        _vendor_id: vendorId,
        _product_id: productId,
      });
      if (error) throw error;
      return data as boolean;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cents = price ? Math.round(parseFloat(price.replace(",", ".")) * 100) : null;
      const { error } = await supabase
        .from("offers")
        .update({
          suggested_retail_price_cents: cents,
          suggested_retail_price_source: cents ? (source as any) : null,
        })
        .eq("id", offerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PVP suggéré enregistré");
      qc.invalidateQueries({ queryKey: ["vendor-offers"] });
      qc.invalidateQueries({ queryKey: ["resolved-pvp", productId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  if (isLoading) return null;

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-4">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Prix public conseillé (PVP)</p>
            <p className="text-xs text-muted-foreground">
              Réservé aux fabricants et distributeurs officiels de la marque. Contactez l'administrateur
              MediKong pour faire valider votre statut.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-emerald-700" />
        <h4 className="text-sm font-semibold">Prix public conseillé (PVP TTC)</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        En tant que fabricant / distributeur officiel, vous pouvez indiquer un PVP TTC indicatif.
        Il sera affiché aux acheteurs comme référence pour calculer leur marge de revente.
        Un PVP officiel APB encodé par MediKong reste prioritaire.
      </p>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <Label htmlFor={`pvp-${offerId}`} className="text-xs">PVP TTC (€)</Label>
          <Input
            id={`pvp-${offerId}`}
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="ex: 24.90"
          />
        </div>
        <div>
          <Label className="text-xs">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manufacturer">Fabricant</SelectItem>
              <SelectItem value="distributor">Distributeur officiel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-3">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save size={14} className="mr-1" />
          Enregistrer le PVP
        </Button>
      </div>
    </div>
  );
}
