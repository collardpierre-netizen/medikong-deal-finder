import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Upload, Trash2, Minus, Plus, ShoppingCart, ChevronDown, ChevronUp, Package, AlertTriangle, HelpCircle, CheckCircle2, Store } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getVendorPublicName } from "@/lib/vendor-display";

// MOV tiers per supplier
const MOV_TIERS = [500, 1500, 5000, 10000];

interface SupplierGroup {
  vendorId: string;
  vendorName: string;
  vendorSlug?: string;
  isVerified: boolean;
  items: ReturnType<typeof useCart>["items"];
  total: number;
  currentMov: number;
  remaining: number;
  progress: number;
  meetsMinimum: boolean;
}

type FilterType = "all" | "ready" | "below" | "changes";

export default function CartPage() {
  const { user } = useAuth();
  const { items, isLoading, cartCount, updateQuantity, removeFromCart, clearCart } = useCart();
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<FilterType>("all");
  const [remark, setRemark] = useState("");

  // Fetch real vendor data for all vendor_ids in cart
  const vendorIds = useMemo(() => [...new Set(items.map(i => i.vendor_id).filter(Boolean))], [items]);
  const { data: vendors = [] } = useQuery({
    queryKey: ["cart-vendors", vendorIds],
    queryFn: async () => {
      if (vendorIds.length === 0) return [];
      const { data } = await supabase
        .from("vendors")
        .select("id, name, company_name, slug, is_verified, display_code, show_real_name")
        .in("id", vendorIds as string[]);
      return data || [];
    },
    enabled: vendorIds.length > 0,
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);

  // Group items by vendor_id
  const supplierGroups = useMemo<SupplierGroup[]>(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach(item => {
      const key = item.vendor_id || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).map(([vendorId, groupItems]) => {
      const total = groupItems.reduce((s, i) => s + (i.price_excl_vat || i.product?.price || 0) * i.quantity, 0);
      const vendor = vendorMap.get(vendorId);
      const currentMov = MOV_TIERS[0];
      const remaining = Math.max(currentMov - total, 0);
      const progress = Math.min((total / currentMov) * 100, 100);
      return {
        vendorId,
        vendorName: vendor ? getVendorPublicName(vendor) : `Fournisseur #${vendorId.slice(0, 6).toUpperCase()}`,
        vendorSlug: vendor?.slug || undefined,
        isVerified: vendor?.is_verified || false,
        items: groupItems,
        total,
        currentMov,
        remaining,
        progress,
        meetsMinimum: total >= currentMov,
      };
    });
  }, [items, vendorMap]);

  const totalCart = items.reduce((s, i) => s + (i.price_excl_vat || i.product?.price || 0) * i.quantity, 0);
  const readyCount = supplierGroups.filter(g => g.meetsMinimum).length;
  const belowCount = supplierGroups.filter(g => !g.meetsMinimum).length;
  const totalReady = supplierGroups.filter(g => g.meetsMinimum).reduce((s, g) => s + g.total, 0);

  const filteredGroups = supplierGroups.filter(g => {
    if (filter === "ready") return g.meetsMinimum;
    if (filter === "below") return !g.meetsMinimum;
    return true;
  });

  const toggleSupplier = (code: string) => {
    setExpandedSuppliers(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: "ready", label: "Prêt au checkout", count: readyCount },
    { key: "below", label: "Sous le minimum", count: belowCount },
    { key: "changes", label: "Avec modifications", count: 0 },
  ];

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
          {/* Header */}
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">
              Votre panier ({supplierGroups.length} fournisseur{supplierGroups.length > 1 ? "s" : ""})
            </h1>
            <div className="flex gap-3 flex-wrap text-sm">
              <button className="flex items-center gap-1.5 text-mk-navy hover:underline">
                <Download size={14} /> Télécharger
              </button>
              <span className="text-mk-line">|</span>
              <button className="flex items-center gap-1.5 text-mk-navy hover:underline">
                <Upload size={14} /> Importer une liste
              </button>
              <span className="text-mk-line">|</span>
              <button
                className="flex items-center gap-1.5 text-mk-red hover:underline"
                onClick={() => clearCart.mutate()}
              >
                <Trash2 size={14} /> Vider
              </button>
            </div>
          </motion.div>

          {/* Filter pills */}
          <motion.div
            className="flex items-center gap-3 mb-6 flex-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <span className="text-sm font-medium text-mk-sec">Filtrer fournisseurs:</span>
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(filter === f.key ? "all" : f.key)}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                  filter === f.key
                    ? "bg-mk-navy text-white border-mk-navy"
                    : "bg-white text-mk-navy border-mk-line hover:border-mk-navy"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
            {/* Supplier cards */}
            <div className="flex-1 min-w-0 space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredGroups.map((group, gi) => (
                  <motion.div
                    key={group.vendorId}
                    className="border border-mk-line rounded-lg bg-white overflow-hidden"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ delay: gi * 0.06 }}
                  >
                    {/* Stock status */}
                    <div className="px-5 py-3 border-b border-mk-line bg-mk-alt flex items-center gap-2">
                      <Store size={16} className="text-mk-navy" />
                      <span className="text-sm font-medium text-mk-navy">En stock</span>
                      <HelpCircle size={13} className="text-mk-ter" />
                    </div>

                    {/* Supplier info + MOV */}
                    <div className="px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-mk-navy underline cursor-pointer">
                              {group.vendorName}
                            </span>
                            <CheckCircle2 size={16} className="text-mk-green" />
                          </div>
                          <p className="text-sm text-mk-sec">
                            Total: <span className="font-semibold text-mk-navy">{formatPrice(group.total)}€</span>
                            <span className="mx-1.5">|</span>
                            {group.items.length} produit{group.items.length > 1 ? "s" : ""}
                          </p>
                        </div>

                        {/* MOV progress */}
                        <div className="flex items-center gap-3 sm:min-w-[280px]">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-mk-sec flex items-center gap-1">
                                Minimum: <span className="font-medium text-mk-navy">{formatPrice(group.currentMov)}€</span>
                                <HelpCircle size={11} className="text-mk-ter" />
                              </span>
                              <span className="text-mk-sec">
                                {group.remaining > 0
                                  ? `${formatPrice(group.remaining)}€ restant`
                                  : "✓ Atteint"
                                }
                              </span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  backgroundColor: group.meetsMinimum ? "#16A34A" : "#F59E0B",
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${group.progress}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              // Remove all items from this supplier group
                              group.items.forEach(item => removeFromCart.mutate(item.id));
                            }}
                            className="text-mk-ter hover:text-mk-red transition-colors p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* MOV tiers */}
                      <div className="flex items-center gap-2 text-xs text-mk-sec mb-4 border-t border-mk-line pt-3">
                        <span className="flex items-center gap-1 font-medium">
                          Paliers MOV: <HelpCircle size={11} className="text-mk-ter" />
                        </span>
                        {MOV_TIERS.map((tier, i) => (
                          <span key={tier} className="flex items-center gap-1">
                            {i > 0 && <span className="text-mk-line">|</span>}
                            <span className={group.total >= tier ? "font-semibold text-mk-navy" : ""}>
                              {formatPrice(tier)}€
                            </span>
                          </span>
                        ))}
                      </div>

                      {/* Products toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-mk-alt rounded border border-mk-line flex items-center justify-center">
                            <Package size={16} className="text-mk-sec" />
                          </div>
                          <button
                            onClick={() => toggleSupplier(group.vendorId)}
                            className="text-sm text-mk-blue font-medium flex items-center gap-1 hover:underline"
                          >
                            {expandedSuppliers[group.vendorId] ? "Masquer" : "Afficher"} les produits
                            {expandedSuppliers[group.vendorId] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                        <Link
                          to={group.vendorSlug ? `/vendeur/${group.vendorSlug}` : `/recherche`}
                          className="border border-mk-line text-mk-navy text-sm font-medium px-4 py-2 rounded-md hover:bg-mk-alt transition-colors"
                        >
                          Voir inventaire fournisseur
                        </Link>
                      </div>

                      {/* Expanded products */}
                      <AnimatePresence>
                        {expandedSuppliers[group.vendorId] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 border border-mk-line rounded-lg divide-y divide-mk-line">
                              {group.items.map(item => (
                                <div key={item.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                                  <div className="w-10 h-10 bg-mk-alt rounded flex items-center justify-center shrink-0">
                                    <Package size={16} className="text-mk-sec" />
                                  </div>
                                  <div className="flex-1 min-w-[140px]">
                                    <Link
                                      to={`/produit/${item.product?.slug}`}
                                      className="text-sm font-medium text-mk-navy hover:text-mk-blue block truncate"
                                    >
                                      {item.product?.name || "Produit"}
                                    </Link>
                                    <p className="text-xs text-mk-ter">
                                      Réf: {item.product_id?.slice(0, 8) || "N/A"}
                                    </p>
                                    <p className="text-sm text-mk-navy mt-0.5">
                                      {formatPrice(item.price_excl_vat || item.product?.price || 0)}€ × {item.quantity} = <span className="font-bold">{formatPrice((item.price_excl_vat || item.product?.price || 0) * item.quantity)}€</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex items-center border border-mk-line rounded-md">
                                      <button
                                        className="px-2 py-1.5 text-mk-sec hover:text-mk-navy"
                                        onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                                      >
                                        <Minus size={13} />
                                      </button>
                                      <span className="px-2.5 text-sm font-medium min-w-[32px] text-center">{item.quantity}</span>
                                      <button
                                        className="px-2 py-1.5 text-mk-sec hover:text-mk-navy"
                                        onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                                      >
                                        <Plus size={13} />
                                      </button>
                                    </div>
                                    <button
                                      className="text-mk-ter hover:text-mk-red transition-colors p-1"
                                      onClick={() => removeFromCart.mutate(item.id)}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Cart summary sidebar */}
            <motion.aside
              className="w-full lg:w-[360px] shrink-0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="border border-mk-line rounded-lg bg-white lg:sticky lg:top-24">
                <div className="p-5">
                  <h3 className="text-lg font-bold text-mk-navy mb-4">Récapitulatif panier</h3>

                  {/* Warning if suppliers below minimum */}
                  {belowCount > 0 && (
                    <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-mk-navy">
                          {belowCount} fournisseur{belowCount > 1 ? "s" : ""} sous le minimum
                        </p>
                        <p className="text-xs text-mk-sec mt-0.5">
                          Augmentez les quantités ou ajoutez des produits de ces fournisseurs.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Total ready */}
                  <div className="mb-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-bold text-mk-navy">Total prêt au checkout</span>
                      <span className="text-xl font-bold text-mk-navy">{formatPrice(totalReady)}€</span>
                    </div>
                    <p className="text-xs text-mk-sec mt-1">
                      Les fournisseurs en stock et pré-commande sont traités séparément.
                    </p>
                  </div>

                  <div className="border-t border-mk-line pt-4 mb-4">
                    {/* Tabs: In stock / Pre-order */}
                    <div className="flex border-b border-mk-line mb-4">
                      <button className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-mk-navy border-b-2 border-mk-navy">
                        <Store size={14} />
                        En stock ({readyCount})
                      </button>
                      <button className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-mk-sec">
                        <Package size={14} />
                        Pré-commande (0)
                      </button>
                    </div>

                    {/* Details */}
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-mk-sec">Livraison</span>
                        <span className="text-mk-navy font-medium">Incluse</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-mk-sec">TVA</span>
                        <span className="text-mk-sec">Ajoutée au checkout</span>
                      </div>
                    </div>
                  </div>

                  {/* Order total */}
                  <div className="border-t border-mk-line pt-4 mb-5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-mk-navy">Total commande</span>
                      <span className="text-xl font-bold text-mk-navy">{formatPrice(totalCart)}€</span>
                    </div>
                  </div>

                  {/* Remark field */}
                  <div className="mb-5">
                    <label htmlFor="cart-remark" className="text-sm font-medium text-mk-navy mb-1.5 block">
                      Remarque <span className="text-mk-ter font-normal">(optionnel)</span>
                    </label>
                    <textarea
                      id="cart-remark"
                      value={remark}
                      onChange={e => setRemark(e.target.value.slice(0, 500))}
                      placeholder="Message pour le fournisseur, instruction de livraison…"
                      rows={3}
                      className="w-full border border-mk-line rounded-lg px-3 py-2 text-sm text-mk-navy placeholder:text-mk-ter focus:outline-none focus:ring-2 focus:ring-mk-navy/20 focus:border-mk-navy resize-none"
                    />
                    <p className="text-xs text-mk-ter mt-1 text-right">{remark.length}/500</p>
                  </div>

                  {/* Checkout button */}
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      to="/checkout"
                      className={`block w-full text-center font-bold py-3.5 rounded-lg text-sm transition-colors ${
                        readyCount > 0
                          ? "bg-mk-navy text-white hover:opacity-90"
                          : "bg-gray-200 text-mk-sec cursor-not-allowed pointer-events-none"
                      }`}
                    >
                      Passer commande
                    </Link>
                  </motion.div>
                </div>

                {/* Footer info */}
                <div className="border-t border-mk-line px-5 py-3 text-center space-y-1">
                  <p className="text-xs text-mk-ter">
                    Réf. panier #{(items[0]?.product_id || "cart").slice(0, 7).toUpperCase()}
                  </p>
                  <button className="text-xs text-mk-blue hover:underline flex items-center gap-1 mx-auto">
                    💬 Besoin d'aide avec votre panier ?
                  </button>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
