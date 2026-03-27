import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { toast } from "sonner";
import { ShoppingCart, Loader2 } from "lucide-react";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedAddr, setSelectedAddr] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [payment, setPayment] = useState(0);

  const addresses = [
    { label: "Adresse principale", addr: "23 rue de la Procession, B-7822 Ath" },
    { label: "Siege social", addr: "15 avenue Louise, B-1050 Bruxelles" },
  ];
  const shippingOpts = [
    { name: "Standard", delay: "5-7 jours", price: 0 },
    { name: "Express", delay: "2-3 jours", price: 15 },
    { name: "Economique", delay: "7-10 jours", price: -2.5 },
  ];
  const paymentMethods = ["Carte bancaire", "Virement SEPA", "Paiement differe Mondu"];

  const subtotal = items.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);
  const shippingCost = shippingOpts[shipping].price;
  const total = subtotal + shippingCost;

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  if (!user) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <ShoppingCart className="mx-auto text-mk-sec mb-4" size={48} />
          <h2 className="text-xl font-bold text-mk-navy mb-2">Connectez-vous pour passer commande</h2>
          <Link to="/connexion" className="text-mk-blue underline">Se connecter</Link>
        </div>
      </Layout>
    );
  }

  if (items.length === 0) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <ShoppingCart className="mx-auto text-mk-sec mb-4" size={48} />
          <h2 className="text-xl font-bold text-mk-navy mb-2">Votre panier est vide</h2>
          <Link to="/recherche" className="text-mk-blue underline">Voir les produits</Link>
        </div>
      </Layout>
    );
  }

  const handlePlaceOrder = async () => {
    try {
      const order = await createOrder.mutateAsync({
        shippingAddress: addresses[selectedAddr].addr,
        shippingMethod: shippingOpts[shipping].name,
        shippingCost,
        paymentMethod: paymentMethods[payment],
        subtotal,
        total,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product?.name || "Produit",
          product_brand: i.product?.brand || "",
          quantity: i.quantity,
          unit_price: i.product?.price || 0,
          total_price: (i.product?.price || 0) * i.quantity,
        })),
      });
      clearCart.mutate();
      navigate(`/confirmation?order=${order.order_number}`);
    } catch (e: any) {
      toast.error("Erreur lors de la commande: " + (e.message || "Réessayez"));
    }
  };

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-6 md:py-8">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-3 md:gap-6 mb-8 md:mb-10">
            {["Livraison", "Paiement", "Verification"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 md:gap-3">
                <motion.div
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold ${step > i ? "bg-mk-green text-white" : step === i + 1 ? "bg-mk-navy text-white" : "bg-mk-alt text-mk-sec"}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
                  key={`step-${i}-${step}`}
                >
                  {step > i ? "✓" : i + 1}
                </motion.div>
                <span className={`text-xs md:text-sm hidden sm:inline ${step === i + 1 ? "font-bold text-mk-navy" : "text-mk-sec"}`}>{s}</span>
                {i < 2 && <div className="w-8 md:w-16 h-px bg-mk-line" />}
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}>
                    <h2 className="text-xl font-bold text-mk-navy mb-5">Adresse de livraison</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {addresses.map((a, i) => (
                        <motion.button key={i} onClick={() => setSelectedAddr(i)}
                          className={`border rounded-lg p-4 text-left ${selectedAddr === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <p className="text-sm font-bold text-mk-navy mb-1">{a.label}</p>
                          <p className="text-sm text-mk-sec">{a.addr}</p>
                        </motion.button>
                      ))}
                    </div>
                    <h3 className="text-lg font-bold text-mk-navy mb-4">Options de livraison</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      {shippingOpts.map((s, i) => (
                        <motion.button key={i} onClick={() => setShipping(i)}
                          className={`border rounded-lg p-4 text-center ${shipping === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <p className="text-sm font-bold text-mk-navy">{s.name}</p>
                          <p className="text-xs text-mk-sec">{s.delay}</p>
                          <p className="text-sm font-bold text-mk-navy mt-1">{s.price === 0 ? "Gratuit" : `${s.price > 0 ? "+" : ""}${formatPrice(s.price)} EUR`}</p>
                        </motion.button>
                      ))}
                    </div>
                    <motion.button onClick={() => setStep(2)} className="w-full sm:w-auto bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md"
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      Continuer vers le paiement
                    </motion.button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}>
                    <h2 className="text-xl font-bold text-mk-navy mb-5">Methode de paiement</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {paymentMethods.map((m, i) => (
                        <motion.button key={i} onClick={() => setPayment(i)}
                          className={`border rounded-lg p-4 text-left ${payment === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <p className="text-sm font-bold text-mk-navy">{m}</p>
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <motion.button onClick={() => setStep(1)} className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Retour</motion.button>
                      <motion.button onClick={() => setStep(3)} className="bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Confirmer la commande</motion.button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}>
                    <h2 className="text-xl font-bold text-mk-navy mb-5">Verification</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      {[
                        { label: "Adresse", value: addresses[selectedAddr].addr },
                        { label: "Livraison", value: shippingOpts[shipping].name },
                        { label: "Paiement", value: paymentMethods[payment] },
                      ].map((item, i) => (
                        <motion.div key={item.label} className="border border-mk-line rounded-lg p-4"
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                          <p className="text-xs text-mk-sec mb-1">{item.label}</p>
                          <p className="text-sm font-medium text-mk-navy">{item.value}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Order items summary */}
                    <div className="border border-mk-line rounded-lg mb-6">
                      <div className="p-3 border-b border-mk-line">
                        <span className="text-sm font-semibold text-mk-navy">{items.length} article{items.length > 1 ? "s" : ""}</span>
                      </div>
                      {items.map((item) => (
                        <div key={item.id} className="px-3 py-2 border-b border-mk-line last:border-0 flex justify-between text-sm">
                          <span className="text-mk-text">{item.product?.name} × {item.quantity}</span>
                          <span className="font-medium text-mk-navy">{formatPrice((item.product?.price || 0) * item.quantity)} EUR</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <motion.button onClick={() => setStep(2)} className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Retour</motion.button>
                      <motion.button
                        onClick={handlePlaceOrder}
                        disabled={createOrder.isPending}
                        className="bg-mk-green text-white font-bold text-sm px-6 py-3 rounded-md flex items-center gap-2 disabled:opacity-60"
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      >
                        {createOrder.isPending && <Loader2 size={16} className="animate-spin" />}
                        Passer la commande
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar */}
            <motion.aside className="w-full lg:w-[320px] shrink-0"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <div className="border border-mk-line rounded-lg p-5 lg:sticky lg:top-20">
                <h3 className="text-lg font-bold text-mk-navy mb-4">Recapitulatif</h3>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-mk-sec">Sous-total ({items.length} article{items.length > 1 ? "s" : ""})</span><span className="text-mk-navy">{formatPrice(subtotal)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">Livraison</span><span className="text-mk-navy">{shippingCost === 0 ? "Incluse" : `${formatPrice(shippingCost)} EUR`}</span></div>
                </div>
                <div className="border-t border-mk-line pt-3">
                  <motion.div className="flex justify-between font-bold text-base text-mk-navy"
                    key={`${subtotal}-${shipping}`}
                    initial={{ scale: 1.05, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <span>Total TTC</span><span>{formatPrice(total)} EUR</span>
                  </motion.div>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
