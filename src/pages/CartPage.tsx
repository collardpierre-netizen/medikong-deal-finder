import { Layout } from "@/components/layout/Layout";
import { ProductImageSmall } from "@/components/shared/ProductCard";
import { products, formatPrice } from "@/data/mock";
import { Download, Upload, Trash2, Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";

const cartItems = products.slice(0, 3);
const cartItems2 = products.slice(3, 5);

export default function CartPage() {
  const [showProducts1, setShowProducts1] = useState(true);
  const [showProducts2, setShowProducts2] = useState(true);

  const total1 = cartItems.reduce((s, p) => s + p.price, 0);
  const total2 = cartItems2.reduce((s, p) => s + p.price, 0);
  const grandTotal = total1 + total2;

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
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Votre panier (2 fournisseurs)</h1>
            <div className="flex gap-2 flex-wrap">
              {[
                { icon: Download, label: "Telecharger", cls: "border-mk-line text-mk-sec" },
                { icon: Upload, label: "Importer", cls: "border-mk-line text-mk-sec" },
                { icon: Trash2, label: "Vider", cls: "border-mk-red text-mk-red" },
              ].map((btn, i) => (
                <motion.button
                  key={btn.label}
                  className={`border text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 ${btn.cls}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                >
                  <btn.icon size={13} /> {btn.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="flex gap-2 mb-6 overflow-x-auto pb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <motion.button className="bg-mk-navy text-white text-sm px-4 py-1.5 rounded-full font-medium whitespace-nowrap" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              Pret a commander (1)
            </motion.button>
            <motion.button className="bg-mk-mov-bg text-mk-amber text-sm px-4 py-1.5 rounded-full font-medium border border-mk-mov-border whitespace-nowrap" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              Sous le minimum (1)
            </motion.button>
            <motion.button className="border border-mk-line text-sm px-4 py-1.5 rounded-full text-mk-sec whitespace-nowrap" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              Fournisseurs modifies (0)
            </motion.button>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              {/* Supplier 1 */}
              <motion.div
                className="border border-mk-line rounded-lg"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">En stock</span>
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-medium">Top rated</span>
                    <span className="font-semibold text-mk-navy">#MedDistri</span>
                    <Check size={14} className="text-mk-green" />
                  </div>
                  <span className="font-bold text-mk-navy">{formatPrice(total1)} EUR · {cartItems.length} articles</span>
                </div>
                <div className="mx-4 bg-mk-mov-bg border border-mk-mov-border rounded-md p-3 mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-mk-amber font-medium">Minimum: 500 EUR</span>
                    <span className="text-mk-sec">Encore {formatPrice(500 - total1)} EUR</span>
                  </div>
                  <div className="h-1.5 bg-mk-mov-border rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-mk-amber rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(total1 / 500) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    />
                  </div>
                </div>
                <button onClick={() => setShowProducts1(!showProducts1)} className="text-xs text-mk-blue px-4 mb-2">{showProducts1 ? "Masquer" : "Afficher"} les produits</button>
                <AnimatePresence>
                  {showProducts1 && cartItems.map((p, i) => (
                    <motion.div
                      key={p.id}
                      className="px-4 py-3 border-t border-mk-line flex items-center gap-3 md:gap-4 flex-wrap"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                    >
                      <ProductImageSmall product={p} />
                      <div className="flex-1 min-w-[120px]">
                        <p className="text-sm font-medium text-mk-text truncate">{p.name}</p>
                        <p className="text-xs text-mk-ter">GTIN: {p.ean} · En stock</p>
                      </div>
                      <span className="text-xs text-mk-sec hidden md:block">{p.unit}</span>
                      <div className="flex items-center border border-mk-line rounded-md">
                        <button className="px-2 py-1"><Minus size={12} /></button>
                        <span className="px-2 text-sm">1</span>
                        <button className="px-2 py-1"><Plus size={12} /></button>
                      </div>
                      <span className="font-bold text-mk-navy">{formatPrice(p.price)} EUR</span>
                      <motion.button className="text-mk-red" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}>
                        <Trash2 size={14} />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* Supplier 2 */}
              <motion.div
                className="border border-mk-line rounded-lg"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">En stock</span>
                    <span className="font-semibold text-mk-navy">#Pharmamed</span>
                    <Check size={14} className="text-mk-green" />
                  </div>
                  <span className="font-bold text-mk-navy">{formatPrice(total2)} EUR · {cartItems2.length} articles</span>
                </div>
                <button onClick={() => setShowProducts2(!showProducts2)} className="text-xs text-mk-blue px-4 mb-2">{showProducts2 ? "Masquer" : "Afficher"} les produits</button>
                <AnimatePresence>
                  {showProducts2 && cartItems2.map((p, i) => (
                    <motion.div
                      key={p.id}
                      className="px-4 py-3 border-t border-mk-line flex items-center gap-3 md:gap-4 flex-wrap"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05 }}
                    >
                      <ProductImageSmall product={p} />
                      <div className="flex-1 min-w-[120px]">
                        <p className="text-sm font-medium text-mk-text truncate">{p.name}</p>
                        <p className="text-xs text-mk-ter">GTIN: {p.ean}</p>
                      </div>
                      <div className="flex items-center border border-mk-line rounded-md">
                        <button className="px-2 py-1"><Minus size={12} /></button>
                        <span className="px-2 text-sm">1</span>
                        <button className="px-2 py-1"><Plus size={12} /></button>
                      </div>
                      <span className="font-bold text-mk-navy">{formatPrice(p.price)} EUR</span>
                      <motion.button className="text-mk-red" whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}>
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
                <h3 className="text-lg font-bold text-mk-navy mb-4">Recapitulatif panier</h3>
                <div className="bg-mk-mov-bg border border-mk-mov-border rounded-md p-3 mb-4 text-xs text-mk-amber">
                  1 fournisseur sous le minimum de commande
                </div>
                <motion.div
                  className="text-2xl font-bold text-mk-navy mb-4"
                  key={grandTotal}
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {formatPrice(grandTotal)} EUR
                </motion.div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-mk-sec">Sous-total</span><span className="text-mk-navy">{formatPrice(grandTotal)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">Livraison</span><span className="text-mk-green">Incluse</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">TVA</span><span className="text-mk-sec">Au checkout</span></div>
                </div>
                <div className="border-t border-mk-line pt-3 mb-4">
                  <div className="flex justify-between font-bold text-mk-navy">
                    <span>Total commande</span><span>{formatPrice(grandTotal)} EUR</span>
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/checkout" className="block w-full bg-mk-navy text-white text-center font-bold py-3 rounded-md text-sm hover:opacity-90">
                    Passer commande
                  </Link>
                </motion.div>
                <p className="text-xs text-mk-ter text-center mt-3">Ref: #MK-240327</p>
                <Link to="#" className="text-xs text-mk-blue text-center block mt-2">Besoin d'aide avec votre panier ?</Link>
              </div>
            </motion.aside>
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
