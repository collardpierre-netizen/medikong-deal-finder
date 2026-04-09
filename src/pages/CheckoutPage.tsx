import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";

interface AddressForm {
  company: string;
  street: string;
  street2: string;
  postalCode: string;
  city: string;
  country: string;
}

const emptyAddress: AddressForm = { company: "", street: "", street2: "", postalCode: "", city: "", country: "BE" };

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [shippingAddr, setShippingAddr] = useState<AddressForm>(emptyAddress);
  const [billingAddr, setBillingAddr] = useState<AddressForm>(emptyAddress);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shipping, setShipping] = useState(0);
  const [payment, setPayment] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data: shippingOpts = [] } = useQuery({
    queryKey: ["shipping-options", shippingAddr.country],
    queryFn: async () => {
      const { data } = await supabase
        .from("shipping_options")
        .select("*")
        .eq("country_code", shippingAddr.country)
        .eq("is_active", true)
        .order("sort_order");
      if (!data || data.length === 0) {
        return [{ id: "default", name: "Standard", name_fr: "Standard", delivery_min_days: 5, delivery_max_days: 7, price_adjustment: 0, is_free: true, currency: "EUR" }];
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const paymentMethods = ["Carte bancaire", "Virement SEPA", "Paiement différé Mondu"];

  const getItemPrice = (item: typeof items[0]) => item.price_excl_vat || item.product?.price || 0;
  const subtotal = items.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);
  const selectedOpt = shippingOpts[shipping] || shippingOpts[0];
  const shippingCost = selectedOpt ? Number(selectedOpt.price_adjustment) || 0 : 0;
  const total = subtotal + shippingCost;

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  const isAddressValid = (addr: AddressForm) =>
    addr.company.trim().length > 1 && addr.street.trim().length > 3 && addr.postalCode.trim().length > 2 && addr.city.trim().length > 1;

  const canProceedStep1 = isAddressValid(shippingAddr) && (sameAsBilling || isAddressValid(billingAddr));

  const formatAddr = (a: AddressForm) =>
    `${a.company}, ${a.street}${a.street2 ? ", " + a.street2 : ""}, ${a.postalCode} ${a.city}, ${a.country}`;

  const handlePlaceOrder = useCallback(async () => {
    if (submitting) return; // double-click guard
    setSubmitting(true);
    try {
      const finalBilling = sameAsBilling ? shippingAddr : billingAddr;
      const order = await createOrder.mutateAsync({
        shippingAddress: formatAddr(shippingAddr),
        billingAddress: formatAddr(finalBilling),
        paymentMethod: paymentMethods[payment],
        subtotal,
        total,
        items: items.map(item => ({
          offer_id: item.offer_id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price_excl_vat: item.price_excl_vat || 0,
          unit_price_incl_vat: item.price_incl_vat || item.price_excl_vat || 0,
        })),
      });
      clearCart.mutate();

      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "order-confirmation",
            recipientEmail: user!.email,
            idempotencyKey: `order-confirm-${order.id}`,
            templateData: {
              orderNumber: order.order_number,
              total: `${formatPrice(total)} EUR`,
              itemCount: items.length,
              shippingAddress: formatAddr(shippingAddr),
              paymentMethod: paymentMethods[payment],
            },
          },
        });
      } catch (emailErr) {
        console.warn("Email confirmation failed:", emailErr);
      }

      navigate(`/confirmation?order=${order.order_number}`);
    } catch (e: any) {
      toast.error("Erreur lors de la commande: " + (e.message || "Réessayez"));
      setSubmitting(false);
    }
  }, [submitting, shippingAddr, billingAddr, sameAsBilling, payment, subtotal, total, items]);

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

  const AddressFields = ({ value, onChange, prefix }: { value: AddressForm; onChange: (v: AddressForm) => void; prefix: string }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <Label htmlFor={`${prefix}-company`} className="text-xs text-mk-sec mb-1">Société *</Label>
        <Input id={`${prefix}-company`} value={value.company} onChange={e => onChange({ ...value, company: e.target.value })} placeholder="Nom de la société" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${prefix}-street`} className="text-xs text-mk-sec mb-1">Adresse *</Label>
        <Input id={`${prefix}-street`} value={value.street} onChange={e => onChange({ ...value, street: e.target.value })} placeholder="Rue et numéro" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${prefix}-street2`} className="text-xs text-mk-sec mb-1">Complément</Label>
        <Input id={`${prefix}-street2`} value={value.street2} onChange={e => onChange({ ...value, street2: e.target.value })} placeholder="Étage, boîte, etc." />
      </div>
      <div>
        <Label htmlFor={`${prefix}-postal`} className="text-xs text-mk-sec mb-1">Code postal *</Label>
        <Input id={`${prefix}-postal`} value={value.postalCode} onChange={e => onChange({ ...value, postalCode: e.target.value })} placeholder="1000" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-city`} className="text-xs text-mk-sec mb-1">Ville *</Label>
        <Input id={`${prefix}-city`} value={value.city} onChange={e => onChange({ ...value, city: e.target.value })} placeholder="Bruxelles" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-country`} className="text-xs text-mk-sec mb-1">Pays</Label>
        <select id={`${prefix}-country`} value={value.country} onChange={e => onChange({ ...value, country: e.target.value })}
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
          <option value="BE">Belgique</option>
          <option value="FR">France</option>
          <option value="LU">Luxembourg</option>
          <option value="NL">Pays-Bas</option>
          <option value="DE">Allemagne</option>
        </select>
      </div>
    </div>
  );

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-6 md:py-8">
          {/* Stepper */}
          <div className="flex items-center justify-center gap-3 md:gap-6 mb-8 md:mb-10">
            {["Livraison", "Paiement", "Vérification"].map((s, i) => (
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
                    <AddressFields value={shippingAddr} onChange={setShippingAddr} prefix="ship" />

                    <label className="flex items-center gap-2 mt-4 mb-4 cursor-pointer">
                      <input type="checkbox" checked={sameAsBilling} onChange={e => setSameAsBilling(e.target.checked)}
                        className="w-4 h-4 rounded border-input" />
                      <span className="text-sm text-mk-text">Adresse de facturation identique</span>
                    </label>

                    {!sameAsBilling && (
                      <>
                        <h3 className="text-lg font-bold text-mk-navy mb-3">Adresse de facturation</h3>
                        <AddressFields value={billingAddr} onChange={setBillingAddr} prefix="bill" />
                      </>
                    )}

                    <h3 className="text-lg font-bold text-mk-navy mb-4 mt-6">Options de livraison</h3>
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
                    <motion.button
                      onClick={() => setStep(2)}
                      disabled={!canProceedStep1}
                      className="w-full sm:w-auto bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={canProceedStep1 ? { scale: 1.03 } : {}} whileTap={canProceedStep1 ? { scale: 0.97 } : {}}>
                      Continuer vers le paiement
                    </motion.button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}>
                    <h2 className="text-xl font-bold text-mk-navy mb-5">Méthode de paiement</h2>
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
                    <h2 className="text-xl font-bold text-mk-navy mb-5">Vérification</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      {[
                        { label: "Adresse de livraison", value: formatAddr(shippingAddr) },
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

                    <div className="border border-mk-line rounded-lg mb-6">
                      <div className="p-3 border-b border-mk-line">
                        <span className="text-sm font-semibold text-mk-navy">{items.length} article{items.length > 1 ? "s" : ""}</span>
                      </div>
                      {items.map((item) => (
                        <div key={item.id} className="px-3 py-2 border-b border-mk-line last:border-0 flex justify-between text-sm">
                          <span className="text-mk-text">{item.product?.name} × {item.quantity}</span>
                          <span className="font-medium text-mk-navy">{formatPrice(getItemPrice(item) * item.quantity)} EUR</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <motion.button onClick={() => setStep(2)} className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Retour</motion.button>
                      <motion.button
                        onClick={handlePlaceOrder}
                        disabled={submitting || createOrder.isPending}
                        className="bg-mk-green text-white font-bold text-sm px-6 py-3 rounded-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        whileHover={!submitting ? { scale: 1.03 } : {}} whileTap={!submitting ? { scale: 0.97 } : {}}
                      >
                        {(submitting || createOrder.isPending) && <Loader2 size={16} className="animate-spin" />}
                        {submitting ? "Traitement en cours..." : "Passer la commande"}
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
                <h3 className="text-lg font-bold text-mk-navy mb-4">Récapitulatif</h3>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-mk-sec">Sous-total ({items.length} article{items.length > 1 ? "s" : ""})</span><span className="text-mk-navy">{formatPrice(subtotal)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">Livraison</span><span className="text-mk-navy">{shippingCost === 0 ? "Incluse" : `${formatPrice(shippingCost)} EUR`}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-mk-sec flex items-center gap-1"><Truck size={13} /> Délai estimé</span>
                    <span className="text-mk-navy">
                      {(() => {
                        const allDays = items.map(i => i.delivery_days).filter((d): d is number => typeof d === "number" && d > 0);
                        if (allDays.length === 0) return "5-10 jours ouvrables";
                        return `${Math.max(...allDays)} jours ouvrables`;
                      })()}
                    </span>
                  </div>
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
