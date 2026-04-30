import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Calendar, Coins } from "lucide-react";
import { useRfqQuota } from "@/hooks/useRfqQuota";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function nextMonthLabel(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" });
}

export default function RfqPaywallDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: quota } = useRfqQuota();

  const used = quota ? Math.max(0, (quota.monthly_quota ?? 0) - (quota.monthly_remaining ?? 0)) : 0;
  const monthlyQuota = quota?.monthly_quota ?? 0;
  const permanentCredits = quota?.permanent_credits ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700"><Lock className="h-4 w-4" /></div>
            <DialogTitle>Quota de demandes de prix atteint</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Vous avez utilisé l'ensemble de vos demandes de prix disponibles ce mois-ci. Pour continuer à
            interroger nos vendeurs, rechargez votre compte avec un pack de crédits ou activez un forfait mensuel.
          </DialogDescription>
        </DialogHeader>

        {quota && (
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <div className="font-medium text-foreground">Quota mensuel</div>
                <div className="text-muted-foreground">{used}/{monthlyQuota} utilisé</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <div className="font-medium text-foreground">Crédits permanents</div>
                <div className="text-muted-foreground">{permanentCredits} restant{permanentCredits > 1 ? "s" : ""}</div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          💡 Le quota gratuit est réinitialisé le <strong>{nextMonthLabel()}</strong>. Les crédits achetés sont valables à vie.
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Plus tard</Button>
          <Button onClick={() => { onOpenChange(false); navigate("/compte/rfq-credits"); }} className="gap-2">
            Voir les forfaits <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
