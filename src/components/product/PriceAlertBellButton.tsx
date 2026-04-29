import { useState } from "react";
import { Bell, BellRing, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { usePriceWatches } from "@/hooks/usePriceWatches";
import { useToast } from "@/hooks/use-toast";

interface Props {
  productId: string;
  productName?: string;
  defaultPrice?: number;
  size?: number;
  className?: string;
}

/**
 * Bouton cloche d'alerte prix réutilisable.
 * - Si non connecté : redirige vers /login.
 * - Si connecté : ouvre une modale pour saisir le prix cible (HTVA).
 * - Si une veille existe déjà : la cloche est remplie + permet édition/suppression.
 */
export function PriceAlertBellButton({ productId, productName, defaultPrice, size = 13, className = "" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getWatchForProduct, savePrice, removeWatch } = usePriceWatches();
  const existing = user ? getWatchForProduct(productId) : undefined;

  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<string>(
    existing ? String(existing.user_price_excl_vat) : defaultPrice ? String(defaultPrice.toFixed(2)) : ""
  );
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour créer une alerte prix." });
      navigate("/login?redirect=" + encodeURIComponent(window.location.pathname));
      return;
    }
    setPrice(existing ? String(existing.user_price_excl_vat) : defaultPrice ? defaultPrice.toFixed(2) : "");
    setNotes(existing?.notes ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    const num = parseFloat(price.replace(",", "."));
    if (!isFinite(num) || num <= 0) {
      toast({ title: "Prix invalide", description: "Saisissez un montant HTVA en EUR." });
      return;
    }
    try {
      await savePrice.mutateAsync({ productId, price: num, notes });
      toast({ title: existing ? "Alerte mise à jour" : "Alerte créée", description: `Vous serez prévenu si le prix passe sous ${num.toFixed(2)} EUR HTVA.` });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message ?? "Impossible d'enregistrer l'alerte.", variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!existing) return;
    try {
      await removeWatch.mutateAsync(existing.id);
      toast({ title: "Alerte supprimée" });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message ?? "Suppression impossible.", variant: "destructive" });
    }
  };

  const Icon = existing ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-7 h-7 rounded-full border bg-white flex items-center justify-center transition-colors ${
          existing
            ? "border-mk-blue text-mk-blue hover:bg-mk-blue/5"
            : "border-mk-line text-mk-sec hover:border-mk-blue hover:text-mk-blue"
        } ${className}`}
        aria-label={existing ? "Modifier l'alerte prix" : "Créer une alerte prix"}
        title={existing ? `Alerte active : ${existing.user_price_excl_vat.toFixed(2)} EUR HTVA` : "Créer une alerte prix"}
      >
        <Icon size={size} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{existing ? "Modifier l'alerte prix" : "Créer une alerte prix"}</DialogTitle>
            <DialogDescription>
              {productName ? <span className="font-medium">{productName}</span> : null}
              <span className="block mt-1 text-xs">Vous serez notifié dès qu'un vendeur passe sous votre prix cible (HTVA).</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-mk-sec mb-1 block">Prix cible HTVA (EUR)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="ex: 4.20"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-mk-sec mb-1 block">Notes (optionnel)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mon prix d'achat actuel, conditions, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between gap-2">
            <div>
              {existing && (
                <Button variant="ghost" size="sm" onClick={handleRemove} disabled={removeWatch.isPending} className="text-destructive">
                  <Trash2 size={14} className="mr-1" /> Supprimer
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
              <Button size="sm" onClick={handleSave} disabled={savePrice.isPending}>
                {savePrice.isPending && <Loader2 size={14} className="mr-1 animate-spin" />}
                {existing ? "Enregistrer" : "Créer l'alerte"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
