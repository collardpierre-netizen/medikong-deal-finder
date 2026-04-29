import { useState } from "react";
import { Bell, BellRing, Loader2, Trash2, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { usePriceWatches } from "@/hooks/usePriceWatches";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatUpdatedAt } from "@/lib/format-date";

interface Props {
  productId: string;
  productName?: string;
  defaultPrice?: number;
  size?: number;
  className?: string;
}

interface HistoryRow {
  id: string;
  action: "created" | "updated" | "deleted";
  price_excl_vat: number | null;
  previous_price_excl_vat: number | null;
  notes: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<HistoryRow["action"], string> = {
  created: "Créée",
  updated: "Modifiée",
  deleted: "Supprimée",
};

const ACTION_COLOR: Record<HistoryRow["action"], string> = {
  created: "bg-emerald-100 text-emerald-700 border-emerald-200",
  updated: "bg-sky-100 text-sky-700 border-sky-200",
  deleted: "bg-rose-100 text-rose-700 border-rose-200",
};

export function PriceAlertBellButton({ productId, productName, defaultPrice, size = 13, className = "" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getWatchForProduct, savePrice, removeWatch } = usePriceWatches();
  const existing = user ? getWatchForProduct(productId) : undefined;
  const isActive = !!existing;

  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<string>(
    existing ? String(existing.user_price_excl_vat) : defaultPrice ? String(defaultPrice.toFixed(2)) : ""
  );
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");

  const { data: history = [], isLoading: historyLoading } = useQuery<HistoryRow[]>({
    queryKey: ["price-watch-history", user?.id, productId],
    enabled: open && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_price_watch_history")
        .select("id, action, price_excl_vat, previous_price_excl_vat, notes, created_at")
        .eq("user_id", user!.id)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as HistoryRow[];
    },
  });

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

  const Icon = isActive ? BellRing : Bell;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`relative w-7 h-7 rounded-full border bg-white flex items-center justify-center transition-colors ${
          isActive
            ? "border-mk-blue text-mk-blue hover:bg-mk-blue/5"
            : "border-mk-line text-mk-sec hover:border-mk-blue hover:text-mk-blue"
        } ${className}`}
        aria-label={isActive ? "Modifier l'alerte prix (active)" : "Créer une alerte prix"}
        title={
          isActive
            ? `Alerte active : ${existing!.user_price_excl_vat.toFixed(2)} EUR HTVA`
            : "Aucune alerte prix — cliquez pour en créer une"
        }
      >
        <Icon size={size} />
        {/* Indicateur d'état actif/inactif */}
        <span
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white ${
            isActive ? "bg-emerald-500" : "bg-slate-300"
          }`}
          aria-hidden="true"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isActive ? "Modifier l'alerte prix" : "Créer une alerte prix"}
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                {isActive ? "Active" : "Inactive"}
              </span>
            </DialogTitle>
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

            {/* Historique des dernières mises à jour */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-mk-sec">
                <History size={12} />
                Historique
                {history.length > 0 && (
                  <span className="text-[10px] font-normal text-mk-ter">({history.length} dernier{history.length > 1 ? "s" : ""})</span>
                )}
              </div>
              {historyLoading ? (
                <p className="text-xs text-mk-ter italic">Chargement…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-mk-ter italic">Aucun historique pour ce produit.</p>
              ) : (
                <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 mt-0.5 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${ACTION_COLOR[h.action]}`}>
                        {ACTION_LABEL[h.action]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-mk-text">
                          {h.action === "updated" && h.previous_price_excl_vat != null && h.price_excl_vat != null ? (
                            <>
                              <span className="line-through text-mk-ter">{Number(h.previous_price_excl_vat).toFixed(2)} €</span>
                              {" → "}
                              <span className="font-semibold">{Number(h.price_excl_vat).toFixed(2)} €</span>
                              <span className="text-mk-ter"> HTVA</span>
                            </>
                          ) : h.action === "deleted" && h.previous_price_excl_vat != null ? (
                            <span className="text-mk-ter">Cible à {Number(h.previous_price_excl_vat).toFixed(2)} € HTVA</span>
                          ) : h.price_excl_vat != null ? (
                            <>
                              <span className="font-semibold">{Number(h.price_excl_vat).toFixed(2)} €</span>
                              <span className="text-mk-ter"> HTVA</span>
                            </>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-mk-ter">{formatUpdatedAt(h.created_at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
