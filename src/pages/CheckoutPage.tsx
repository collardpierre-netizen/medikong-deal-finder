import { Layout } from "@/components/layout/Layout";
import { computeCartTotals } from "@/lib/cart-totals";
import { formatPrice } from "@/data/mock";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateOrder } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { useCartValidation, validateCartNow } from "@/hooks/useCartValidation";
import { toast } from "sonner";
import { ShoppingCart, Loader2, Truck, Pencil, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { StripePaymentFlow, type PaymentIntentInfo } from "@/components/checkout/StripePaymentFlow";
import { BankTransferInstructions } from "@/components/checkout/BankTransferInstructions";
import { useVendorLabels } from "@/hooks/useVendorLabels";



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
  const [prefillSource, setPrefillSource] = useState<"saved_address" | "customer_profile" | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);


  // Pré-remplissage automatique depuis le compte (adresse par défaut > profil client)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: cust } = await supabase
        .from("customers")
        .select("id, company_name, address_line1, address_line2, city, postal_code, country_code")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cancelled || !cust) return;
      setCustomerId((cust as any).id);
      const { data: savedAddrs } = await supabase
        .from("customer_shipping_addresses")

        .select("*")
        .eq("customer_id", (cust as any).id)
        .order("is_default", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const saved = savedAddrs?.[0] as any;
      if (saved) {
        const prefill: AddressForm = {
          company: (cust as any).company_name || "",
          street: saved.address_l1 || "",
          street2: saved.address_l2 || "",
          postalCode: saved.postal_code || "",
          city: saved.city || "",
          country: saved.country_code || "BE",
        };
        setShippingAddr((prev) => (prev.street || prev.city || prev.postalCode ? prev : prefill));
        setBillingAddr((prev) => (prev.street || prev.city || prev.postalCode ? prev : prefill));
        setPrefillSource("saved_address");
      } else if ((cust as any).address_line1 || (cust as any).city) {
        const prefill: AddressForm = {
          company: (cust as any).company_name || "",
          street: (cust as any).address_line1 || "",
          street2: (cust as any).address_line2 || "",
          postalCode: (cust as any).postal_code || "",
          city: (cust as any).city || "",
          country: (cust as any).country_code || "BE",
        };
        setShippingAddr((prev) => (prev.street || prev.city || prev.postalCode ? prev : prefill));
        setBillingAddr((prev) => (prev.street || prev.city || prev.postalCode ? prev : prefill));
        setPrefillSource("customer_profile");
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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

  // Per-vendor invoice eligibility (resolved server-side via RPC)
  const vendorIdsInCart = useMemo(
    () => [...new Set(items.map((i: any) => i.vendor_id).filter(Boolean))] as string[],
    [items],
  );
  const { data: invoiceEligibility = [] } = useQuery({
    queryKey: ["invoice-eligibility", user?.id, vendorIdsInCart.join(",")],
    enabled: !!user && vendorIdsInCart.length > 0,
    queryFn: async () => {
      const { data: cust } = await supabase.from("customers").select("id").eq("auth_user_id", user!.id).maybeSingle();
      if (!cust) return [];
      const subtotalsByVendor = new Map<string, number>();
      for (const it of items as any[]) {
        const k = it.vendor_id; if (!k) continue;
        subtotalsByVendor.set(k, (subtotalsByVendor.get(k) || 0) + (it.price_excl_vat || 0) * it.quantity);
      }
      const results: Array<{ vendor_id: string; eligible: boolean; net_days: number | null }> = [];
      for (const vid of vendorIdsInCart) {
        const cents = Math.round((subtotalsByVendor.get(vid) || 0) * 100);
        const { data } = await supabase.rpc("resolve_invoice_payment_eligibility", {
          _vendor_id: vid, _customer_id: cust.id, _amount_cents: cents,
        });
        const row = Array.isArray(data) ? data[0] : data;
        results.push({ vendor_id: vid, eligible: !!row?.eligible, net_days: row?.net_days ?? null });
      }
      return results;
    },
    staleTime: 60_000,
  });
  const invoiceEligibleCount = invoiceEligibility.filter((e) => e.eligible).length;
  const invoiceAvailable = invoiceEligibleCount > 0;

  const paymentMethods = [
    { label: "Carte bancaire", enabled: true },
    { label: `Paiement sur facture${invoiceEligibleCount ? ` (${invoiceEligibleCount} vendeur${invoiceEligibleCount > 1 ? "s" : ""} éligible${invoiceEligibleCount > 1 ? "s" : ""})` : ""}`, enabled: invoiceAvailable },
    { label: "Virement bancaire (SEPA)", enabled: true },
  ];

  const getItemPrice = (item: typeof items[0]) => item.price_excl_vat || item.product?.price || 0;
  const getItemPriceTTC = (item: typeof items[0]) => {
    if (item.price_incl_vat && item.price_incl_vat > 0) return item.price_incl_vat;
    return getItemPrice(item) * 1.21;
  };
  const { subtotalExcl: subtotal, subtotalIncl: subtotalTTC, vat: vatAmount } =
    computeCartTotals(items as any);
  const selectedOpt = shippingOpts[shipping] || shippingOpts[0];
  const shippingCost = selectedOpt ? Number(selectedOpt.price_adjustment) || 0 : 0;
  const total = subtotalTTC + shippingCost;

  // Live cart validation (MOV, MOQ, stock, offre indispo) — debounced
  const validateItems = useMemo(
    () => items.map(it => ({ offer_id: it.offer_id, quantity: it.quantity })),
    [items],
  );
  const { data: validation, loading: validating } = useCartValidation(validateItems, { enabled: items.length > 0 });

  type BlockedVendor = {
    vendor_id: string;
    vendor_name: string;
    reasons: string[];
    missing?: number;
    current?: number;
    required?: number;
  };
  const blockedVendors: BlockedVendor[] = useMemo(() => {
    if (!validation || validation.valid) return [];
    const map = new Map<string, BlockedVendor>();
    const keyFor = (vid: string | null, vname: string | null) => vid || vname || "_unknown";
    // Vendor MOV errors
    for (const e of validation.errors) {
      const vid = (e.details as any)?.vendor_id || null;
      const vname = e.vendor_name || (e.details as any)?.vendor_name || "Vendeur";
      const k = keyFor(vid, vname);
      const entry: BlockedVendor = map.get(k) || { vendor_id: k, vendor_name: vname, reasons: [] };
      if (e.type === "vendor_mov_not_reached") {
        const missing = Number(e.details?.missing) || 0;
        const current = Number(e.details?.current) || 0;
        const required = Number(e.details?.required) || 0;
        entry.missing = missing;
        entry.current = current;
        entry.required = required;
        entry.reasons.push(`MOV non atteint — il manque ${missing.toFixed(2)} €`);
      } else if (e.type === "below_moq") {
        entry.reasons.push(`Quantité minimum non respectée (${e.details?.current}/${e.details?.required})`);
      } else if (e.type === "exceeds_stock") {
        entry.reasons.push(`Stock insuffisant (${e.details?.current}/${e.details?.available})`);
      } else if (e.type === "offer_not_available") {
        entry.reasons.push(`Offre indisponible`);
      } else if (e.type === "invalid_quantity") {
        entry.reasons.push(`Quantité invalide`);
      }
      map.set(k, entry);
    }
    return Array.from(map.values());
  }, [validation]);

  const readyVendors = useMemo(() => {
    if (!validation) return [];
    const blockedIds = new Set(blockedVendors.map(v => v.vendor_id));
    return (validation.vendors || []).filter(v => !blockedIds.has(v.vendor_id) && v.mov_reached);
  }, [validation, blockedVendors]);

  const hasBlocking = blockedVendors.length > 0;


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

  // Stripe Connect PaymentIntents flow — 1 PI par vendeur
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initErrorStage, setInitErrorStage] = useState<"order" | "session" | null>(null);
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntentInfo[]>([]);
  type ManualPaymentVendor = { vendor_id: string; vendor_name: string; reason: "no_stripe_account" | "charges_disabled"; amount: number };
  const [manualPaymentVendors, setManualPaymentVendors] = useState<ManualPaymentVendor[]>([]);
  const testMode = false;

  // 🟢 Résolution unifiée du libellé vendeur (panier + checkout + confirmation).
  // On regroupe tous les vendor_ids présents sur la page pour un seul fetch.
  const allVendorIdsOnPage = useMemo(() => {
    const set = new Set<string>(vendorIdsInCart);
    for (const v of validation?.vendors || []) if (v.vendor_id) set.add(v.vendor_id);
    for (const e of validation?.errors || []) {
      const vid = (e.details as any)?.vendor_id;
      if (vid) set.add(vid);
    }
    for (const v of manualPaymentVendors) if (v.vendor_id) set.add(v.vendor_id);
    for (const pi of paymentIntents) if (pi.vendor_id) set.add(pi.vendor_id);
    return Array.from(set);
  }, [vendorIdsInCart, validation, manualPaymentVendors, paymentIntents]);
  const { labelsById: vendorLabelById, getLabel: getVendorLabel } = useVendorLabels(allVendorIdsOnPage);

  const handlePlaceOrder = useCallback(async () => {
    if (submitting || initLoading) return;
    setSubmitting(true);
    setInitLoading(true);
    setInitError(null);
    setInitErrorStage(null);
    let stage: "order" | "session" = "order";
    let oid = orderId;
    let onum = orderNumber;
    try {
      // Pre-flight server-side validation (MOQ, stock, vendor MOV with floor 500€)
      const validation = await validateCartNow(items.map(it => ({ offer_id: it.offer_id, quantity: it.quantity })));
      if (!validation.valid) {
        const reasons = validation.errors.map(e => {
          if (e.type === "vendor_mov_not_reached") return `MOV non atteint pour ${getVendorLabel((e.details as any)?.vendor_id, e.vendor_name)} (manque ${Number(e.details.missing).toFixed(2)} €)`;
          if (e.type === "below_moq") return `Quantité minimum non respectée (${e.details.current}/${e.details.required})`;
          if (e.type === "exceeds_stock") return `Stock insuffisant (${e.details.current}/${e.details.available})`;
          if (e.type === "offer_not_available") return `Offre indisponible`;
          return null;
        }).filter(Boolean).join(" — ");
        throw new Error(reasons || "Panier invalide");
      }
      // Step 1 : create order if not already created
      if (!oid || !onum) {
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
        oid = order.id;
        onum = order.order_number;
        setOrderId(oid);
        setOrderNumber(onum);
      }

      // Enregistrement en adresse par défaut (best-effort)
      if (saveAsDefault && customerId) {
        try {
          await supabase
            .from("customer_shipping_addresses")
            .update({ is_default: false })
            .eq("customer_id", customerId)
            .eq("is_default", true);
          await supabase.from("customer_shipping_addresses").insert({
            customer_id: customerId,
            label: "Adresse par défaut",
            address_l1: shippingAddr.street,
            address_l2: shippingAddr.street2 || null,
            postal_code: shippingAddr.postalCode,
            city: shippingAddr.city,
            country_code: shippingAddr.country,
            is_default: true,
          });
          setSaveAsDefault(false);
        } catch {
          // best-effort — n'interrompt pas la commande
        }
      }


      // Invoice payment : pas de Stripe, redirection vers confirmation
      const selectedLabel = paymentMethods[payment].label;
      if (selectedLabel.startsWith("Paiement sur facture")) {
        toast.success("Commande enregistrée — paiement sur facture");
        clearCart.mutate();
        navigate(`/account/orders?ok=${onum}`);
        return;
      }

      // Step 2 : create PaymentIntent(s) — 1 par vendeur (Stripe Connect mandataire)
      stage = "session";
      const isBankTransfer = selectedLabel.startsWith("Virement bancaire");
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          action: "create-payment-intent",
          order_id: oid,
          payment_method: isBankTransfer ? "bank_transfer" : "card",
        },
      });
      if (error) {
        throw new Error(error?.message || data?.error || "Création des PaymentIntents impossible");
      }
      const manualVendors = (data?.manual_payment_vendors ?? []) as ManualPaymentVendor[];
      const pis = (data?.payment_intents ?? []) as PaymentIntentInfo[];
      setManualPaymentVendors(manualVendors);
      setPaymentIntents(pis);

      // Cas 100% manuel : aucun vendeur Stripe-ready → on saute Stripe et on va direct sur la confirmation
      if (pis.length === 0 && manualVendors.length > 0) {
        toast.success("Commande enregistrée — notre équipe vous contacte pour finaliser");
        clearCart.mutate();
        navigate(`/commande/confirmation?order_id=${oid}`);
        return;
      }
      if (pis.length === 0) {
        throw new Error("Aucun PaymentIntent créé pour cette commande");
      }
      // Sinon on reste sur la page — StripePaymentFlow prend le relais
    } catch (e: any) {
      setInitError(e.message || "Erreur");
      setInitErrorStage(stage);
      toast.error(
        stage === "order"
          ? "Création de commande impossible : " + (e.message || "Réessayez")
          : "Initialisation du paiement Stripe impossible : " + (e.message || "Réessayez")
      );
    } finally {
      setSubmitting(false);
      setInitLoading(false);
    }
  }, [
    submitting, initLoading, orderId, orderNumber, sameAsBilling, shippingAddr, billingAddr,
    paymentMethods, payment, subtotal, total, items, createOrder, clearCart, navigate,
    saveAsDefault, customerId,
  ]);





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

          {/* Cart validation banner — visible sur les 3 étapes */}
          {items.length > 0 && (
            <div className="mb-6">
              {hasBlocking ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-destructive">
                        {blockedVendors.length === 1
                          ? "1 vendeur bloque la validation de la commande"
                          : `${blockedVendors.length} vendeurs bloquent la validation de la commande`}
                      </p>
                      <p className="text-xs text-mk-sec mt-0.5">
                        Tant qu'un seul vendeur est bloqué, la commande complète ne peut pas être envoyée. Ajustez votre panier ou retirez les articles concernés.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {blockedVendors.map(v => (
                          <li key={v.vendor_id} className="bg-white border border-destructive/20 rounded-md px-3 py-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <span className="text-sm font-semibold text-mk-navy">{v.vendor_name}</span>
                              {typeof v.missing === "number" && v.missing > 0 && (
                                <span className="text-xs font-medium text-destructive">
                                  +{v.missing.toFixed(2)} € pour atteindre le minimum
                                </span>
                              )}
                            </div>
                            <ul className="mt-1 space-y-0.5">
                              {v.reasons.map((r, i) => (
                                <li key={i} className="text-xs text-mk-sec">• {r}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                      {readyVendors.length > 0 && (
                        <p className="text-xs text-mk-sec mt-3">
                          {readyVendors.length === 1
                            ? "1 autre vendeur est prêt à être commandé."
                            : `${readyVendors.length} autres vendeurs sont prêts à être commandés.`}
                        </p>
                      )}
                      <div className="mt-3">
                        <Link
                          to="/panier"
                          className="inline-flex items-center gap-1.5 bg-mk-navy text-white text-xs font-bold px-4 py-2 rounded-md hover:bg-mk-navy/90"
                        >
                          <Pencil size={12} /> Modifier le panier
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : validation && validation.valid ? (
                <div className="rounded-lg border border-mk-green/30 bg-mk-green/5 px-4 py-2.5 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-mk-green shrink-0" />
                  <span className="text-xs text-mk-navy">
                    Panier validé — {validation.vendors.length} vendeur{validation.vendors.length > 1 ? "s" : ""} prêt{validation.vendors.length > 1 ? "s" : ""}.
                  </span>
                </div>
              ) : validating ? (
                <div className="rounded-lg border border-mk-line bg-mk-alt/40 px-4 py-2.5 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-mk-sec" />
                  <span className="text-xs text-mk-sec">Vérification du panier…</span>
                </div>
              ) : null}
            </div>
          )}



          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.3 }}>
                    <h2 className="text-xl font-bold text-mk-navy mb-3">Adresse de livraison</h2>
                    {prefillSource && (
                      <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div className="flex-1">
                          <span className="font-semibold">Adresse pré-remplie depuis votre compte</span>
                          <span className="text-emerald-700">
                            {" "}— {prefillSource === "saved_address" ? "adresse de livraison par défaut" : "coordonnées de votre profil client"}. Modifiez librement les champs si besoin.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShippingAddr(emptyAddress); setBillingAddr(emptyAddress); setPrefillSource(null); }}
                          className="text-[11px] font-medium underline text-emerald-700 hover:text-emerald-900 shrink-0"
                        >
                          Vider
                        </button>
                      </div>
                    )}
                    <AddressFields value={shippingAddr} onChange={setShippingAddr} prefix="ship" />

                    {user && customerId && (
                      <label className="flex items-start gap-2 mt-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={saveAsDefault}
                          onChange={(e) => setSaveAsDefault(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-input"
                        />
                        <span className="text-[13px] text-mk-text leading-snug">
                          <span className="font-semibold">Enregistrer comme adresse par défaut du compte</span>
                          <span className="block text-[11.5px] text-mk-sec">
                            Elle sera pré-remplie automatiquement lors de vos prochaines commandes.
                          </span>
                        </span>
                      </label>
                    )}


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
                      disabled={!canProceedStep1 || hasBlocking}
                      title={hasBlocking ? "Résolvez les blocages vendeurs ci-dessus" : undefined}
                      className="w-full sm:w-auto bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={canProceedStep1 && !hasBlocking ? { scale: 1.03 } : {}} whileTap={canProceedStep1 && !hasBlocking ? { scale: 0.97 } : {}}>
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
                      <motion.button
                        onClick={() => setStep(3)}
                        disabled={hasBlocking}
                        title={hasBlocking ? "Résolvez les blocages vendeurs ci-dessus" : undefined}
                        className="bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={!hasBlocking ? { scale: 1.03 } : {}} whileTap={!hasBlocking ? { scale: 0.97 } : {}}>
                        Confirmer la commande
                      </motion.button>
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
                        { key: "redirect", label: testMode ? "Mode test prêt" : "Redirection vers Stripe", done: !!orderId, active: initLoading && !testMode },
                        { key: "submitting", label: "Paiement en cours sur stripe.com", done: false, active: submitting && !testMode },
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

                    <div className="border border-mk-line rounded-lg p-4 mb-6 space-y-4">
                      {paymentIntents.length === 0 ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold text-mk-navy">Paiement sécurisé par Stripe</h3>
                            <p className="text-xs text-mk-sec mt-1">
                              Votre carte est saisie directement sur MediKong via Stripe Elements. Aucune donnée sensible ne transite par nos serveurs.
                              {vendorIdsInCart.length > 1 && (
                                <> Un paiement séparé sera présenté pour chacun des <strong>{vendorIdsInCart.length}</strong> fournisseurs de votre panier.</>
                              )}
                            </p>
                          </div>

                          {!testMode && initError && !initLoading && (() => {
                            const stage = initErrorStage ?? (orderId ? "session" : "order");
                            const title =
                              stage === "order"
                                ? "Impossible de créer la commande"
                                : "Impossible d'initialiser le paiement Stripe";
                            const hint =
                              stage === "order"
                                ? "Vérifiez votre adresse et votre connexion, puis réessayez. Aucune commande n'a été enregistrée."
                                : `La commande ${orderNumber ?? ""} a bien été créée mais Stripe n'a pas pu préparer le paiement. Vous pouvez réessayer.`;
                            return (
                              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-destructive">{title}</p>
                                  <span className="text-[11px] uppercase tracking-wide text-mk-sec">
                                    Étape : {stage === "order" ? "Commande" : "Stripe"}
                                  </span>
                                </div>
                                <p className="text-sm text-mk-navy">{initError}</p>
                                <p className="text-xs text-mk-sec">{hint}</p>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInitError(null);
                                      setInitErrorStage(null);
                                      if (stage === "order") {
                                        setOrderId(null);
                                        setOrderNumber(null);
                                      }
                                      handlePlaceOrder();
                                    }}
                                    className="bg-mk-blue text-white font-bold text-sm px-4 py-2 rounded-md"
                                  >
                                    {stage === "order" ? "Recréer la commande" : "Relancer Stripe"}
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
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setStep(2)}
                              disabled={submitting || initLoading}
                              className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md disabled:opacity-50"
                            >
                              Retour
                            </button>
                            <button
                              type="button"
                              onClick={handlePlaceOrder}
                              disabled={submitting || initLoading || hasBlocking}
                              title={hasBlocking ? "Résolvez les blocages vendeurs ci-dessus" : undefined}
                              className="bg-mk-green text-white font-bold text-sm px-6 py-3 rounded-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {(submitting || initLoading) && <Loader2 size={16} className="animate-spin" />}
                              {initLoading ? "Préparation du paiement..." : "Confirmer et payer"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {manualPaymentVendors.length > 0 && (
                            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
                              <p className="text-sm font-semibold text-amber-800">
                                Paiement en ligne partiel — {manualPaymentVendors.length} fournisseur{manualPaymentVendors.length > 1 ? "s" : ""} traité{manualPaymentVendors.length > 1 ? "s" : ""} manuellement
                              </p>
                              <ul className="space-y-1">
                                {manualPaymentVendors.map((v) => (
                                  <li key={v.vendor_id} className="text-xs text-amber-900">
                                    • Le paiement en ligne n'est pas encore disponible pour <strong>{v.vendor_name}</strong> — commande enregistrée, notre équipe vous contacte pour finaliser.
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {paymentMethods[payment].label.startsWith("Virement bancaire") ? (
                            <>
                              <BankTransferInstructions paymentIntents={paymentIntents} />
                              <button
                                type="button"
                                onClick={() => {
                                  clearCart.mutate();
                                  navigate(`/commande/confirmation?order_id=${orderId}`);
                                }}
                                className="w-full bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md"
                              >
                                J'ai noté les instructions — voir ma commande
                              </button>
                            </>
                          ) : (
                            <StripePaymentFlow
                              orderId={orderId!}
                              paymentIntents={paymentIntents}
                              onAllPaid={() => {
                                clearCart.mutate();
                                navigate(`/commande/confirmation?order_id=${orderId}`);
                              }}
                            />
                          )}
                        </>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-mk-navy">Récapitulatif</h3>
                  <Link to="/panier" className="text-xs font-medium text-mk-blue hover:underline inline-flex items-center gap-1">
                    <Pencil size={12} /> Modifier le panier
                  </Link>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-mk-sec">Sous-total HTVA ({items.length} article{items.length > 1 ? "s" : ""})</span><span className="text-mk-navy">{formatPrice(subtotal)} EUR</span></div>
                  <div className="flex justify-between"><span className="text-mk-sec">TVA</span><span className="text-mk-navy">{formatPrice(vatAmount)} EUR</span></div>
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
                  {hasBlocking && (
                    <div className="mb-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle size={12} />
                        <span className="text-[11px] font-semibold uppercase tracking-wide">Vendeurs bloqués</span>
                      </div>
                      {blockedVendors.map(v => (
                        <div key={v.vendor_id} className="border border-destructive/20 rounded-md bg-destructive/5 p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-mk-navy truncate">{v.vendor_name}</span>
                            {typeof v.missing === "number" && v.missing > 0 && (
                              <span className="text-[10px] font-bold text-destructive shrink-0">+{v.missing.toFixed(2)} €</span>
                            )}
                          </div>
                          {(typeof v.current === "number" || typeof v.required === "number") && (
                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-mk-sec">
                              {typeof v.current === "number" && (
                                <div>Actuel : <span className="font-medium text-mk-navy">{v.current.toFixed(2)} €</span></div>
                              )}
                              {typeof v.required === "number" && (
                                <div>Minimum : <span className="font-medium text-mk-navy">{v.required.toFixed(2)} €</span></div>
                              )}
                            </div>
                          )}
                          {v.reasons.length > 0 && (
                            <ul className="space-y-0.5">
                              {v.reasons.map((r, i) => (
                                <li key={i} className="text-[10px] text-destructive">• {r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
