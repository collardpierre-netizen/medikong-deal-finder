import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Upload, Trash2, Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";

export default function CartPage() {
  const { user } = useAuth();
  const { items, isLoading, cartCount, updateQuantity, removeFromCart, clearCart } = useCart();
  const [showProducts, setShowProducts] = useState(true);

  const total = items.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);

  if (!user) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <ShoppingCart className="mx-auto text-mk-sec mb-4" size={48} />
          <h2 className="text-xl font-bold text-mk-navy mb-2">Connectez-vous pour voir votre panier</h2>
          <Link to="/connexion" className="text-mk-blue underline">Se connecter</Link>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return <Layout><div className="mk-container py-20 text-center text-mk-sec">Chargement du panier...</div></Layout>;
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <ShoppingCart className="mx-auto text-mk-sec mb-4" size={48} />
          <h2 className="text-xl font-bold text-mk-navy mb-2">Votre panier est vide</h2>
          <p className="text-mk-sec mb-4">Parcourez nos produits pour commencer vos achats</p>
          <Link to="/recherche" className="bg-mk-navy text-white px-6 py-2.5 rounded-md text-sm font-medium">Voir les produits</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-6 md:py-8">
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Votre panier ({cartCount} article{cartCount > 1 ? "s" : ""})</h1>
            <div className="flex gap-2 flex-wrap">
              <motion.button
                className="border border-mk-red text-mk-red text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => clearCart.mutate()}
              >
                <Trash2 size={13} /> Vider le panier
              </motion.button>
            </div>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <motion.div
                className="border border-mk-line rounded-lg"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="p-4 flex items-center justify-between">
                  <span className="font-semibold text-mk-navy">{items.length} produit{items.length > 1 ? "s" : ""}</span>
                  <button onClick={() => setShowProducts(!showProducts)} className="text-xs text-mk-blue">
                    {showProducts ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <AnimatePresence>
                  {showProducts && items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      className="px-4 py-3 border-t border-mk-line flex items-center gap-3 md:gap-4 flex-wrap"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                    >
                      <div className="w-12 h-12 bg-mk-alt rounded-md flex items-center justify-center shrink-0">
                        <ShoppingCart size={20} className="text-mk-sec" />
                      </div>
                      <div className="flex-1 min-w-[120px]">
                        <Link to={`/produit/${item.product?.slug}`} className="text-sm font-medium text-mk-text truncate block hover:text-mk-blue">
                          {item.product?.name || "Produit"}
                        </Link>
                        <p className="text-xs text-mk-ter">{item.product?.brand} · GTIN: {item.product?.ean || "N/A"}</p>
                      </div>
                      <span className="text-xs text-mk-sec hidden md:block">{item.product?.unit_price || ""}</span>
                      <div className="flex items-center border border-mk-line rounded-md">
                        <button
                          className="px-2 py-1"
                          onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-2 text-sm">{item.quantity}</span>
                        <button
                          className="px-2 py-1"
                          onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="font-bold text-mk-navy">{formatPrice((item.product?.price || 0) * item.quantity)} EUR</span>
                      <motion.button
                        className="text-mk-red"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.8 }}
                        onClick={() => removeFromCart.mutate(item.id)}
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Sidebar */}
            <motion.aside
              className="w-full lg:w-[320px] shrink-0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="border border-mk-line rounded-lg p-5 lg:sticky lg:top-20">
                <h3 className="text-lg font-bold text-mk-navy mb-4">Récapitulatif panier</h3>
                <motion.div
                  className="text-2xl font-bold text-mk-navy mb-4"
                  key={total}
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {formatPrice(total)} EUR
                </motion.div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-mk-sec">Sous-total</span><span className="text-mk-navy">{formatPrice(total)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">Livraison</span><span className="text-mk-green">Incluse</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">TVA</span><span className="text-mk-sec">Au checkout</span></div>
                </div>
                <div className="border-t border-mk-line pt-3 mb-4">
                  <div className="flex justify-between font-bold text-mk-navy">
                    <span>Total commande</span><span>{formatPrice(total)} EUR</span>
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/checkout" className="block w-full bg-mk-navy text-white text-center font-bold py-3 rounded-md text-sm hover:opacity-90">
                    Passer commande
                  </Link>
                </motion.div>
              </div>
            </motion.aside>
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
