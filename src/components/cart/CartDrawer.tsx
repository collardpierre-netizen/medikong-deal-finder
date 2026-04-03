import { useCart } from "@/hooks/useCart";
import { formatPrice } from "@/data/mock";
import { ShoppingCart, X, Minus, Plus, Trash2, ArrowRight, Package, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function CartDrawer() {
  const { items, cartCount, isDrawerOpen, closeDrawer, updateQuantity, removeFromCart } = useCart();

  const total = items.reduce((s, i) => s + (i.price_excl_vat || i.product?.price || 0) * i.quantity, 0);
  const francoTarget = 250;
  const francoProgress = Math.min((total / francoTarget) * 100, 100);
  const francoRemaining = Math.max(francoTarget - total, 0);

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside className="fixed top-0 right-0 bottom-0 w-full max-w-[460px] bg-white z-[61] flex flex-col shadow-2xl" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-mk-line">
              <div className="flex items-center gap-2"><ShoppingCart size={20} className="text-mk-navy" /><span className="text-lg font-bold text-mk-navy">Mon Panier</span></div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-mk-sec">{cartCount} article{cartCount > 1 ? "s" : ""}</span>
                <button onClick={closeDrawer} className="text-mk-sec hover:text-mk-navy transition-colors"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="text-center py-12"><ShoppingCart className="mx-auto text-mk-sec mb-3" size={40} /><p className="text-mk-sec text-sm">Votre panier est vide</p></div>
              ) : (
                <div className="space-y-0">
                  <div className="bg-mk-alt rounded-t-lg px-4 py-3 border border-mk-line">
                    <h3 className="font-semibold text-mk-navy text-[15px]">Panier ({items.length} article{items.length > 1 ? "s" : ""})</h3>
                  </div>
                  <div className="border-x border-mk-line">
                    {items.map((item, i) => {
                      const unitPrice = item.price_excl_vat || item.product?.price || 0;
                      return (
                        <motion.div key={item.id} className="px-4 py-3 border-b border-mk-line" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-mk-navy leading-tight">{item.product?.name || "Produit"}</p>
                              <p className="text-sm text-mk-navy mt-1">
                                <span className="font-medium">{formatPrice(unitPrice)}€</span>
                                <span className="text-mk-ter"> × {item.quantity} = </span>
                                <span className="font-bold">{formatPrice(unitPrice * item.quantity)}€</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Truck size={11} />
                                {item.delivery_days ? `${item.delivery_days} jours ouvrables` : "5-10 jours ouvrables"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center border border-mk-line rounded-md bg-white">
                                <button onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 })} className="px-1.5 py-1 text-mk-sec hover:text-mk-navy"><Minus size={12} /></button>
                                <span className="px-2 text-sm font-medium min-w-[28px] text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 })} className="px-1.5 py-1 text-mk-sec hover:text-mk-navy disabled:opacity-40 disabled:cursor-not-allowed" disabled={!!item.max_quantity && item.quantity >= item.max_quantity}><Plus size={12} /></button>
                              </div>
                              <button onClick={() => removeFromCart.mutate(item.id)} className="text-mk-ter hover:text-mk-red transition-colors p-1"><Trash2 size={15} /></button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="border border-mk-line rounded-b-lg px-4 py-3 bg-white">
                    <div className="flex items-center gap-2 mb-2"><Package size={14} className="text-mk-navy" /><span className="text-sm font-medium text-mk-navy">Franco de port</span></div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: francoProgress >= 100 ? "#16A34A" : "#F97316" }} initial={{ width: 0 }} animate={{ width: `${francoProgress}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    {francoProgress >= 100 ? <p className="text-sm text-mk-green font-medium">✓ Livraison gratuite</p> : <p className="text-sm text-orange-500">Plus que {formatPrice(francoRemaining)}€ pour la livraison gratuite</p>}
                  </div>
                </div>
              )}
            </div>
            {items.length > 0 && (
              <div className="border-t border-mk-line px-5 py-4 space-y-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/panier" onClick={closeDrawer} className="flex items-center justify-center gap-2 w-full bg-mk-navy text-white font-bold py-3.5 rounded-lg text-sm hover:opacity-90 transition-opacity">
                    Voir mon panier <ArrowRight size={16} />
                  </Link>
                </motion.div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
