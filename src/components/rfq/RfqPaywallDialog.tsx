import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function RfqPaywallDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700"><Lock className="h-4 w-4" /></div>
            <DialogTitle>Quota de demandes de prix épuisé</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Vous avez utilisé toutes vos demandes de prix gratuites de ce mois. Rechargez avec un pack de crédits ou activez un forfait pour continuer à interroger nos vendeurs.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          💡 Le quota gratuit est réinitialisé le 1<sup>er</sup> de chaque mois. Les crédits achetés sont valables à vie.
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
