import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money-format";
import { Minus, Plus, Trash2 } from "lucide-react";

/** Panier habituel MediKong (mêmes lignes que sur medikong.pro une fois connecté). */
export default function ScanCartPage() {
  const { items, updateQuantity, removeFromCart } = useCart();
  const total = items.reduce((s, i) => s + (i.price_excl_vat ?? 0) * i.quantity, 0);
  return (
    <div className="px-5 pt-6 space-y-4">
      <h1 className="text-2xl font-extrabold">Panier</h1>
      {items.length === 0 && <p className="text-muted-foreground">Votre panier est vide. Scannez un produit pour l'ajouter.</p>}
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{i.product?.name ?? "Produit"}</div>
            <div className="text-sm text-muted-foreground">{formatMoney(i.price_excl_vat ?? 0)} HTVA</div>
          </div>
          <Button size="icon" variant="outline" className="scan-tap" aria-label="Retirer une unité"
            onClick={() => i.quantity > 1 ? updateQuantity.mutate({ itemId: i.id, quantity: i.quantity - 1 }) : removeFromCart.mutate(i.id)}>
            {i.quantity > 1 ? <Minus className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          </Button>
          <span className="w-6 text-center font-semibold">{i.quantity}</span>
          <Button size="icon" variant="outline" className="scan-tap" aria-label="Ajouter une unité"
            onClick={() => updateQuantity.mutate({ itemId: i.id, quantity: i.quantity + 1 })}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {items.length > 0 && (
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
