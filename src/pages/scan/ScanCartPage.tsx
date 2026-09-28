import { useEffect, useState } from "react";
import { useCart, type CartItem } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money-format";
import { Minus, Plus, Trash2 } from "lucide-react";

/** Ligne dont l'offre ou le produit n'est plus lisible (offre désactivée, supprimée…). */
export const isUnavailableCartItem = (i: CartItem) => !i.product || !(Number(i.price_excl_vat) > 0);

function QtyInput({ value, onCommit }: { value: number; onCommit: (q: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n >= 1 && n !== value) onCommit(n);
    else setV(String(value));
  };
  return (
    <input
      inputMode="numeric" pattern="[0-9]*" aria-label="Quantité"
      className="h-11 w-14 rounded-md border bg-background text-center font-semibold"
      value={v}
      onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/** Panier habituel MediKong (mêmes lignes que sur medikong.pro une fois connecté). */
export default function ScanCartPage() {
  const { items, updateQuantity, removeFromCart } = useCart();
  const available = items.filter((i) => !isUnavailableCartItem(i));
  const total = available.reduce((s, i) => s + (i.price_excl_vat ?? 0) * i.quantity, 0);
  const del = (id: string) => (
    <Button size="icon" variant="ghost" className="scan-tap h-11 w-11 shrink-0" aria-label="Supprimer la ligne" onClick={() => removeFromCart.mutate(id)}>
      <Trash2 className="h-5 w-5" />
    </Button>
  );
  return (
    <div className="px-5 pt-6 pb-8 space-y-4">
      <h1 className="text-2xl font-extrabold">Panier</h1>
      {items.length === 0 && <p className="text-muted-foreground">Votre panier est vide. Scannez un produit pour l'ajouter.</p>}
      {items.map((i) => isUnavailableCartItem(i) ? (
        <div key={i.id} className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-muted-foreground">Produit indisponible</div>
            <div className="text-sm text-muted-foreground">Cette offre n'est plus proposée. Supprimez la ligne.</div>
          </div>
          {del(i.id)}
        </div>
      ) : (
        <div key={i.id} className="rounded-xl border bg-card p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug line-clamp-2">{i.product?.name}</div>
              <div className="text-sm text-muted-foreground">{formatMoney(i.price_excl_vat ?? 0)} HTVA</div>
            </div>
            {del(i.id)}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="scan-tap h-11 w-11" aria-label="Retirer une unité" disabled={i.quantity <= 1}
                onClick={() => updateQuantity.mutate({ itemId: i.id, quantity: i.quantity - 1 })}>
                <Minus className="h-4 w-4" />
              </Button>
              <QtyInput value={i.quantity} onCommit={(q) => updateQuantity.mutate({ itemId: i.id, quantity: q })} />
              <Button size="icon" variant="outline" className="scan-tap h-11 w-11" aria-label="Ajouter une unité"
                onClick={() => updateQuantity.mutate({ itemId: i.id, quantity: i.quantity + 1 })}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="font-semibold">{formatMoney((i.price_excl_vat ?? 0) * i.quantity)}</span>
          </div>
        </div>
      ))}
      {available.length > 0 && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex justify-between font-semibold"><span>Total HTVA</span><span>{formatMoney(total)}</span></div>
          <Button asChild className="scan-tap h-12 w-full text-base">
            <a href="https://medikong.pro/panier">Finaliser la commande sur medikong.pro</a>
          </Button>
        </div>
      )}
    </div>
  );
}
