import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText } from "lucide-react";

type Props = {
  orderId: string;
  orderNumber?: string | null;
  value: boolean | null;
};

const LABELS: Record<string, string> = {
  default: "Réglage du fournisseur",
  forced: "Forcée pour cette vente",
  excluded: "Exclue pour cette vente",
};

/**
 * Réglage de la facturation « au nom et pour le compte de » pour une vente précise.
 * null = on suit le réglage du fournisseur, true = forcée, false = exclue.
 */
export default function OrderSelfBillingOverridePanel({ orderId, orderNumber, value }: Props) {
  const qc = useQueryClient();

  const current = value === true ? "forced" : value === false ? "excluded" : "default";

  const save = useMutation({
    mutationFn: async (next: boolean | null) => {
      const { error } = await supabase
        .from("orders")
        .update({ self_billing_override: next })
        .eq("id", orderId);
      if (error) throw error;
      const label = next === true ? "forcée" : next === false ? "exclue" : "remise sur le réglage fournisseur";
      const { error: auditErr } = await supabase.from("audit_logs").insert({
        action: "self_billing_order_override",
        module: "invoicing",
        detail: `Commande ${orderNumber ?? orderId} : facturation au nom et pour le compte ${label}.`,
      });
      if (auditErr) console.error("[self-billing-override] audit_logs insert failed", auditErr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-order"] });
      toast.success("Réglage enregistré");
    },
    onError: (e: any) => toast.error("Modification impossible", { description: e?.message }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Facturation au nom et pour le compte
          <Badge variant={current === "default" ? "secondary" : current === "forced" ? "default" : "destructive"}>
            {LABELS[current]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Par défaut, cette vente suit le réglage du fournisseur. Vous pouvez forcer l'émission de la facture au nom du
          fournisseur, ou exclure cette vente. Un mandat signé reste obligatoire dans tous les cas.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={current === "default" ? "default" : "outline"}
            disabled={save.isPending}
            onClick={() => save.mutate(null)}
          >
            Réglage du fournisseur
          </Button>
          <Button
            size="sm"
            variant={current === "forced" ? "default" : "outline"}
            disabled={save.isPending}
            onClick={() => save.mutate(true)}
          >
            Forcer pour cette vente
          </Button>
          <Button
            size="sm"
            variant={current === "excluded" ? "destructive" : "outline"}
            disabled={save.isPending}
            onClick={() => save.mutate(false)}
          >
            Exclure cette vente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
