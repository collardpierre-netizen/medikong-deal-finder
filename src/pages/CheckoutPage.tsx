import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useState, useCallback, useEffect, useMemo } from "react";
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
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { getStripe, getStripeLoadError, resetStripe } from "@/lib/stripe";


interface AddressForm {
  company: string;
  street: string;
  street2: string;
  postalCode: string;
  city: string;
  country: string;
}

const emptyAddress: AddressForm = { company: "", street: "", street2: "", postalCode: "", city: "", country: "BE" };

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
      const fallback = [{ id: "default", name: "Standard", name_fr: "Standard", delivery_min_days: 5, delivery_max_days: 7, price_adjustment: 0, is_free: true, currency: "EUR" }];
      if (!data || data.length === 0) return fallback;
      // V1: only Standard option exposed
      const standard = data.filter((s: any) => /standard/i.test(s.name_fr || s.name || ""));
      return standard.length > 0 ? standard : [data[0]];
    },
    staleTime: 5 * 60 * 1000,
  });

  const paymentMethods = [
    { label: "Carte bancaire", enabled: true },
    { label: "Virement SEPA", enabled: false },
    { label: "Paiement différé Mondu", enabled: false },
  ];

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

  // Stripe state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeLoadError, setStripeLoadError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initErrorStage, setInitErrorStage] = useState<"order" | "intent" | null>(null);

  const [stripeLoadAttempt, setStripeLoadAttempt] = useState(0);
  const [stripeSlow, setStripeSlow] = useState(false);

  // Lazy-init Stripe.js (re-trigger on retry)
  useEffect(() => {
    setStripeReady(false);
    setStripeLoadError(null);
    setStripeSlow(false);
    const promise = getStripe();
    setStripePromise(promise);
    const slowTimer = setTimeout(() => setStripeSlow(true), 6000);
    let cancelled = false;
    promise.then((stripe) => {
      if (cancelled) return;
      clearTimeout(slowTimer);
      if (stripe) {
        setStripeReady(true);
      } else {
        setStripeLoadError(
          getStripeLoadError() ||
            "Stripe.js n'a pas pu se charger. Vérifiez votre connexion ou désactivez les bloqueurs de scripts."
        );
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [stripeLoadAttempt]);

  const retryStripeLoad = useCallback(() => {
    resetStripe();
    setStripeLoadAttempt((n) => n + 1);
  }, []);

  const [initStarted, setInitStarted] = useState(false);
  const [testMode, setTestMode] = useState(false);
  // When entering step 3 with no clientSecret yet, create order + payment intent
  useEffect(() => {
    if (step !== 3 || clientSecret || initStarted || testMode) return;
    setInitStarted(true);
    let cancelled = false;
    (async () => {
      setInitLoading(true);
      setInitError(null);
      setInitErrorStage(null);
      let stage: "order" | "intent" = "order";
      try {
        const finalBilling = sameAsBilling ? shippingAddr : billingAddr;
        const order = await createOrder.mutateAsync({
          shippingAddress: formatAddr(shippingAddr),
          billingAddress: formatAddr(finalBilling),
          paymentMethod: paymentMethods[payment].label,
          subtotal,
          total,
          customerInfo: {
            company: shippingAddr.company,
            street: shippingAddr.street,
            city: shippingAddr.city,
            postalCode: shippingAddr.postalCode,
            country: shippingAddr.country,
          },
          items: items.map(item => ({
            offer_id: item.offer_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price_excl_vat: item.price_excl_vat || 0,
            unit_price_incl_vat: item.price_incl_vat || item.price_excl_vat || 0,
          })),
        });
        if (cancelled) return;
        setOrderId(order.id);
        setOrderNumber(order.order_number);

        stage = "intent";
        const { data, error } = await supabase.functions.invoke("stripe-checkout", {
          body: { action: "create-payment-intent", order_id: order.id },
        });
        if (cancelled) return;
        if (error || !data?.client_secret) {
          throw new Error(error?.message || data?.error || "Initialisation paiement impossible");
        }
        setClientSecret(data.client_secret);
      } catch (e: any) {
        if (!cancelled) {
          setInitError(e.message || "Erreur d'initialisation");
          setInitErrorStage(stage);
          setInitStarted(false); // allow retry
          toast.error(
            stage === "order"
              ? "Création de commande impossible : " + (e.message || "Réessayez")
              : "Initialisation paiement impossible : " + (e.message || "Réessayez")
          );
        }
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, clientSecret, initStarted]);


  const handlePaymentSuccess = useCallback(async () => {
    if (!orderId || !orderNumber) return;
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "order-confirmation",
          recipientEmail: user!.email,
          idempotencyKey: `order-confirm-${orderId}`,
          templateData: {
            orderNumber,
            total: `${formatPrice(total)} EUR`,
            itemCount: items.length,
            shippingAddress: formatAddr(shippingAddr),
            paymentMethod: paymentMethods[payment].label,
          },
        },
      });
    } catch (e) {
      console.warn("Email confirmation failed:", e);
    }
    clearCart.mutate();
    navigate(`/confirmation?order=${orderNumber}`);
  }, [orderId, orderNumber, user, total, items, shippingAddr, payment, clearCart, navigate]);

  const handleTestOrderConfirmation = useCallback(async () => {
    if (!orderId || !orderNumber || submitting) return;
    setSubmitting(true);
    try {
      await handlePaymentSuccess();
    } finally {
      setSubmitting(false);
    }
  }, [orderId, orderNumber, submitting, handlePaymentSuccess]);

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
                        <motion.button key={s.id || i} onClick={() => setShipping(i)}
                          className={`border rounded-lg p-4 text-center ${shipping === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <p className="text-sm font-bold text-mk-navy">{s.name_fr || s.name}</p>
                          <p className="text-xs text-mk-sec">{s.delivery_min_days}–{s.delivery_max_days} jours</p>
                          <p className="text-sm font-bold text-mk-navy mt-1">{s.is_free ? "Gratuit" : `${Number(s.price_adjustment) > 0 ? "+" : ""}${formatPrice(Number(s.price_adjustment))} EUR`}</p>
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
                        <motion.button
                          key={i}
                          onClick={() => m.enabled && setPayment(i)}
                          disabled={!m.enabled}
                          title={m.enabled ? undefined : "Bientôt disponible"}
                          className={`border rounded-lg p-4 text-left transition ${payment === i && m.enabled ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"} ${!m.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                          whileHover={m.enabled ? { scale: 1.02 } : {}} whileTap={m.enabled ? { scale: 0.98 } : {}}>
                          <p className="text-sm font-bold text-mk-navy">{m.label}</p>
                          {!m.enabled && <p className="text-[11px] text-mk-sec mt-1">Bientôt disponible</p>}
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
                        { label: "Livraison", value: selectedOpt?.name_fr || selectedOpt?.name || "Standard" },
                        { label: "Paiement", value: paymentMethods[payment].label },
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

                    {(() => {
                      const steps = [
                        { key: "created", label: "Commande créée", done: !!orderId },
                        { key: "intent", label: "Paiement initialisé", done: !!clientSecret || testMode },
                        { key: "ready", label: testMode ? "Mode test prêt" : "Module carte prêt", done: testMode ? !!orderId : (stripeReady && !!clientSecret) },
                        { key: "submitting", label: "Paiement en cours", done: false, active: submitting },
                      ];
                      return (
                        <div className="border border-mk-line rounded-lg p-3 mb-4 bg-mk-alt/40">
                          <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                            {steps.map((s, i) => (
                              <li key={s.key} className="flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${s.done ? "bg-mk-green text-white" : s.active ? "bg-mk-blue text-white animate-pulse" : "bg-mk-line text-mk-sec"}`}>
                                  {s.done ? "✓" : i + 1}
                                </span>
                                <span className={s.done || s.active ? "text-mk-navy font-medium" : "text-mk-sec"}>{s.label}</span>
                              </li>
                            ))}
                          </ol>
                          {orderNumber && (
                            <p className="text-[11px] text-mk-sec mt-2">Commande <span className="font-mono text-mk-navy">{orderNumber}</span></p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="border border-mk-line rounded-lg p-4 mb-6">
                      <h3 className="text-sm font-semibold text-mk-navy mb-3">Paiement sécurisé par carte</h3>
                      {initLoading && (
                        <div className="py-6 space-y-3">
                          <div className="flex items-center gap-2 text-sm text-mk-sec justify-center">
                            <Loader2 size={16} className="animate-spin" />
                            {stripeSlow ? "Chargement plus long que prévu..." : "Initialisation du paiement..."}
                          </div>
                          {stripeSlow && !stripeReady && !stripeLoadError && (
                            <div className="text-center space-y-2">
                              <p className="text-xs text-mk-sec">
                                Stripe.js met du temps à se charger. Cela peut venir de votre connexion, d'un bloqueur de publicités ou d'une extension navigateur.
                              </p>
                              <button
                                type="button"
                                onClick={retryStripeLoad}
                                className="border border-mk-navy text-mk-navy font-bold text-xs px-3 py-1.5 rounded-md"
                              >
                                Relancer le chargement
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3 px-1">
                        <label className="flex items-center gap-2 text-xs text-mk-sec cursor-pointer">
                          <input
                            type="checkbox"
                            checked={testMode}
                            onChange={(e) => {
                              setTestMode(e.target.checked);
                              if (e.target.checked) {
                                setClientSecret(null);
                                setInitError(null);
                                setStripeLoadError(null);
                              } else {
                                setInitStarted(false);
                              }
                            }}
                          />
                          Mode test (sans paiement carte)
                        </label>
                      </div>
                      {testMode && (
                        <div className="rounded-md border border-dashed border-mk-line bg-mk-alt p-4 space-y-3">
                          <p className="text-sm text-mk-navy">
                            Mode test activé : la commande sera enregistrée sans appel à Stripe.
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              if (submitting) return;
                              setSubmitting(true);
                              try {
                                let oid = orderId;
                                let onum = orderNumber;
                                if (!oid || !onum) {
                                  const finalBilling = sameAsBilling ? shippingAddr : billingAddr;
                                  const order = await createOrder.mutateAsync({
                                    shippingAddress: formatAddr(shippingAddr),
                                    billingAddress: formatAddr(finalBilling),
                                    paymentMethod: paymentMethods[payment].label + " (test)",
                                    subtotal,
                                    total,
                                    customerInfo: {
                                      company: shippingAddr.company,
                                      street: shippingAddr.street,
                                      city: shippingAddr.city,
                                      postalCode: shippingAddr.postalCode,
                                      country: shippingAddr.country,
                                    },
                                    items: items.map(item => ({
                                      offer_id: item.offer_id,
                                      product_id: item.product_id,
                                      quantity: item.quantity,
                                      unit_price_excl_vat: item.price_excl_vat || 0,
                                      unit_price_incl_vat: item.price_incl_vat || item.price_excl_vat || 0,
                                    })),
                                  });
                                  oid = order.id;
                                  onum = order.order_number;
                                  setOrderId(oid);
                                  setOrderNumber(onum);
                                }
                                clearCart.mutate();
                                navigate(`/confirmation?order=${onum}&test=1`);
                              } catch (e: any) {
                                toast.error("Erreur test: " + (e.message || "réessayez"));
                              } finally {
                                setSubmitting(false);
                              }
                            }}
                            disabled={submitting}
                            className="bg-mk-navy text-white font-bold text-sm px-4 py-2 rounded-md disabled:opacity-60 flex items-center gap-2"
                          >
                            {submitting && <Loader2 size={16} className="animate-spin" />}
                            Simuler la confirmation de paiement
                          </button>
                        </div>
                      )}
                      {!testMode && initError && !initLoading && (() => {
                        const stage = initErrorStage ?? (orderId ? "intent" : "order");
                        const title =
                          stage === "order"
                            ? "Impossible de créer la commande"
                            : "Impossible d'initialiser le paiement";
                        const hint =
                          stage === "order"
                            ? "Vérifiez votre adresse et votre connexion, puis réessayez. Aucune commande n'a été enregistrée."
                            : `La commande ${orderNumber ?? ""} a bien été créée mais Stripe n'a pas pu démarrer le paiement. Vous pouvez réessayer ou poursuivre en mode test.`;
                        return (
                          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-destructive">{title}</p>
                              <span className="text-[11px] uppercase tracking-wide text-mk-sec">
                                Étape : {stage === "order" ? "Commande" : "Paiement"}
                              </span>
                            </div>
                            <p className="text-sm text-mk-navy">{initError}</p>
                            <p className="text-xs text-mk-sec">{hint}</p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setClientSecret(null);
                                  setInitError(null);
                                  setInitErrorStage(null);
                                  if (stage === "order") {
                                    setOrderId(null);
                                    setOrderNumber(null);
                                  }
                                  setInitStarted(false);
                                }}
                                className="bg-mk-blue text-white font-bold text-sm px-4 py-2 rounded-md"
                              >
                                {stage === "order" ? "Recréer la commande" : "Relancer le paiement"}
                              </button>
                              {stage === "order" && (
                                <button
                                  type="button"
                                  onClick={() => setStep(1)}
                                  className="border border-mk-navy text-mk-navy font-bold text-sm px-4 py-2 rounded-md"
                                >
                                  Modifier l'adresse
                                </button>
                              )}
                              {stage === "intent" && orderId && orderNumber && (
                                <button
                                  type="button"
                                  onClick={handleTestOrderConfirmation}
                                  disabled={submitting}
                                  className="border border-mk-navy text-mk-navy font-bold text-sm px-4 py-2 rounded-md disabled:opacity-60"
                                >
                                  {submitting ? "Validation..." : "Poursuivre en mode test"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      {!testMode && clientSecret && !stripeReady && !stripeLoadError && (
                        <div className="flex items-center gap-2 text-sm text-mk-sec py-6 justify-center">
                          <Loader2 size={16} className="animate-spin" /> Chargement du module carte...
                        </div>
                      )}
                      {!testMode && stripeLoadError && !initLoading && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                          <p className="text-sm font-semibold text-destructive">Impossible de charger Stripe.js</p>
                          <p className="text-sm text-mk-navy">{stripeLoadError}</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={retryStripeLoad}
                              className="bg-mk-blue text-white font-bold text-sm px-4 py-2 rounded-md"
                            >
                              Relancer le chargement de Stripe.js
                            </button>
                            {orderId && orderNumber && (
                              <button
                                type="button"
                                onClick={handleTestOrderConfirmation}
                                disabled={submitting}
                                className="border border-mk-navy text-mk-navy font-bold text-sm px-4 py-2 rounded-md disabled:opacity-60"
                              >
                                {submitting ? "Validation..." : "Poursuivre en mode test"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {!testMode && clientSecret && stripePromise && stripeReady && (
                        <Elements
                          stripe={stripePromise}
                          options={{ clientSecret, appearance: { theme: "stripe" } } satisfies StripeElementsOptions}
                        >
                          <StripePaymentForm onSuccess={handlePaymentSuccess} onBack={() => setStep(2)} />
                        </Elements>
                      )}
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

function StripePaymentForm({ onSuccess, onBack }: { onSuccess: () => void | Promise<void>; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setErrMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/confirmation`,
      },
      redirect: "if_required",
    });

    if (error) {
      const msg = error.message || "Paiement refusé";
      setErrMsg(msg);
      toast.error(msg);
      setSubmitting(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      await onSuccess();
      return;
    }

    // Fallback (e.g. requires_action handled via redirect)
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} disabled={submitting}
          className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md disabled:opacity-50">
          Retour
        </button>
        <button type="submit" disabled={!stripe || !elements || submitting}
          className="bg-mk-green text-white font-bold text-sm px-6 py-3 rounded-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? "Traitement en cours..." : "Passer la commande"}
        </button>
      </div>
    </form>
  );
}

