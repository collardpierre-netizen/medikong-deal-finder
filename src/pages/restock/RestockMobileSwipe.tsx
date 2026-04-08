import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X, ShoppingCart, Lock, Truck, MapPin, Clock, Box, Package,
  ChevronUp, Info, MessageSquare, ArrowLeft, Minus, Plus,
} from "lucide-react";
import { toast } from "sonner";

const gradeConfig: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  A: { label: "A — Neuf", desc: "Emballage intact, DLU longue", color: "#00B85C", bg: "#EEFBF4" },
  B: { label: "B — Bon état", desc: "Emballage légèrement abîmé", color: "#1C58D9", bg: "#EBF0FB" },
  C: { label: "C — Abîmé", desc: "Emballage visiblement abîmé", color: "#F59E0B", bg: "#FEF3C7" },
  D: { label: "D — DLU courte", desc: "Date limite d'utilisation proche", color: "#E54545", bg: "#FEE2E2" },
};

const formatPrice = (p: number) => `${p.toFixed(2)} €`;
const formatDate = (d: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
};

/* ── Swipeable Card ── */
function SwipeCard({
  offer, onSwipe, isFront, onTap,
}: {
  offer: any; onSwipe: (dir: "left" | "right") => void; isFront: boolean; onTap: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const rightOverlay = useTransform(x, [0, 80], [0, 1]);
  const leftOverlay = useTransform(x, [-80, 0], [1, 0]);

  const medikongPrice = offer.medikong_product?.best_price_excl_vat;
  const cataloguePrice = medikongPrice || (offer.price_ht || 0) * 1.3;
  const discount = medikongPrice
    ? Math.round((1 - (offer.price_ht || 0) / medikongPrice) * 100)
    : Math.round(((cataloguePrice - (offer.price_ht || 0)) / cataloguePrice) * 100);
  const grade = gradeConfig[offer.grade] || gradeConfig.A;
  const imgSrc = offer.product_image_url || null;
  const dluDate = offer.dlu ? new Date(offer.dlu) : null;
  const dluMonths = dluDate ? Math.max(0, Math.round((dluDate.getTime() - Date.now()) / (30.44 * 86400000))) : null;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) onSwipe("right");
    else if (info.offset.x < -100) onSwipe("left");
  };

  return (
    <motion.div
      style={{
        x, rotate,
        position: "absolute", top: 0, left: 0, width: "100%",
        zIndex: isFront ? 10 : 1, touchAction: "none",
      }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      onTap={isFront ? onTap : undefined}
      initial={isFront ? { scale: 1 } : { scale: 0.95, y: 8 }}
      animate={isFront ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.95, opacity: 0.6, y: 8 }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.25 } }}
    >
      {/* Swipe overlays */}
      {isFront && (
        <>
          <motion.div
            style={{ opacity: rightOverlay }}
            className="absolute inset-0 z-20 rounded-2xl bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-xl font-bold rotate-12 shadow-lg">
              <ShoppingCart className="inline mr-2" size={20} />PANIER
            </div>
          </motion.div>
          <motion.div
            style={{ opacity: leftOverlay }}
            className="absolute inset-0 z-20 rounded-2xl bg-red-500/20 border-4 border-red-500 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-red-500 text-white px-5 py-2 rounded-xl text-xl font-bold -rotate-12 shadow-lg">
              <X className="inline mr-2" size={20} />PASSE
            </div>
          </motion.div>
        </>
      )}

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden select-none border border-border">
        {/* Image area */}
        <div className="relative h-44 bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center overflow-hidden">
          {imgSrc ? (
            <img src={imgSrc} alt="" className="h-36 object-contain drop-shadow-lg" />
          ) : (
            <Package size={56} className="text-white/25" />
          )}
          {/* Badges */}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white/90 text-[10px] font-medium flex items-center gap-1">
            <Lock size={10} /> Vendeur anonyme
          </span>
          {discount > 0 && (
            <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-500 text-white text-sm font-bold shadow-md">
              −{discount}%{medikongPrice ? ' vs neuf' : ''}
            </span>
          )}
          {/* Tap hint */}
          {isFront && (
            <div className="absolute bottom-2 right-2 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-[9px] text-white/80">
              <ChevronUp size={10} /> Détails
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2.5">
          {/* Grade badge + description */}
          <div className="flex items-center gap-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: grade.bg, color: grade.color }}
            >
              {grade.label}
            </span>
            <span className="text-[10px] text-muted-foreground italic">{grade.desc}</span>
          </div>

          <h3 className="font-bold text-foreground text-[17px] leading-tight line-clamp-2">
            {offer.designation || "Produit"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}
          </p>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground line-through">{formatPrice(cataloguePrice)}</span>
            <span className="text-2xl font-extrabold text-primary">{formatPrice(offer.price_ht || 0)}</span>
            <span className="text-xs text-muted-foreground">HT/u</span>
          </div>
          {offer.medikong_product && (
            <a href={`/produit/${offer.medikong_product.slug || offer.medikong_product.id}`} className="text-[11px] text-emerald-600 font-medium hover:underline" onClick={e => e.stopPropagation()}>
              Voir le produit neuf sur MediKong →
            </a>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-1.5"><Box size={13} /><b className="text-foreground">{offer.quantity}</b> unités</div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>DLU {formatDate(offer.dlu)}</span>
            </div>
            <div className="flex items-center gap-1.5"><MapPin size={13} />{offer.seller_city || "Belgique"}</div>
            <div className="flex items-center gap-1.5">
              {offer.delivery_condition === "pickup" ? <MapPin size={13} /> : <Truck size={13} />}
              {offer.delivery_condition === "pickup" ? "Enlèvement" : offer.delivery_condition === "shipping" ? "Livraison" : "Les deux"}
            </div>
          </div>

          {/* DLU warning */}
          {dluMonths !== null && dluMonths <= 3 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
              <Clock size={12} /> DLU dans {dluMonths} mois — prix réduit
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Detail bottom sheet ── */
function DetailSheet({ offer, onClose, onAddToCart, onCounterOffer }: {
  offer: any; onClose: () => void; onAddToCart: (qty: number) => void; onCounterOffer: () => void;
}) {
  const medikongPrice = offer.medikong_product?.best_price_excl_vat;
  const cataloguePrice = medikongPrice || (offer.price_ht || 0) * 1.3;
  const discount = medikongPrice
    ? Math.round((1 - (offer.price_ht || 0) / medikongPrice) * 100)
    : Math.round(((cataloguePrice - (offer.price_ht || 0)) / cataloguePrice) * 100);
  const grade = gradeConfig[offer.grade] || gradeConfig.A;
  const moq = offer.moq || 1;
  const lotSize = offer.lot_size || 1;
  const maxQty = offer.quantity || 1;
  const [qty, setQty] = useState(offer.allow_partial ? moq : maxQty);

  const adjustQty = (delta: number) => {
    setQty(prev => {
      const next = prev + delta * lotSize;
      return Math.max(moq, Math.min(maxQty, next));
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-h-[85vh] bg-white rounded-t-3xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sticky top-0 bg-white pt-3 pb-2 flex justify-center z-10">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {offer.product_image_url ? (
                <img src={offer.product_image_url} alt="" className="w-full h-full object-contain" />
              ) : (
                <Package size={28} className="text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-foreground text-lg leading-tight">{offer.designation}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}
              </p>
            </div>
          </div>

          {/* Grade */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
            <span
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              style={{ backgroundColor: grade.bg, color: grade.color }}
            >
              {grade.label}
            </span>
            <span className="text-xs text-muted-foreground">{grade.desc}</span>
          </div>

          {/* Price */}
          <div className="bg-primary/5 rounded-xl p-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-primary">{formatPrice(offer.price_ht || 0)}</span>
              <span className="text-sm text-muted-foreground">HT/unité</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="line-through">{formatPrice(cataloguePrice)}</span>
              {discount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">−{discount}%</span>
              )}
              <span>soit <b className="text-foreground">{formatPrice((offer.price_ht || 0) * qty)}</b> pour {qty} u</span>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Box, label: "Quantité", value: `${offer.quantity} unités` },
              { icon: Clock, label: "DLU", value: formatDate(offer.dlu) },
              { icon: MapPin, label: "Localisation", value: offer.seller_city || "Belgique" },
              { icon: Truck, label: "Livraison", value: offer.delivery_condition === "pickup" ? "Enlèvement" : offer.delivery_condition === "shipping" ? "Livraison" : "Les deux" },
            ].map((item, i) => (
              <div key={i} className="bg-muted/40 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  <item.icon size={11} />{item.label}
                </div>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Quantity selector (if partial allowed) */}
          {offer.allow_partial && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Quantité (min. {moq}{lotSize > 1 ? `, ×${lotSize}` : ""}, max. {maxQty})</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjustQty(-1)}
                  disabled={qty - lotSize < moq}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center disabled:opacity-30"
                >
                  <Minus size={16} />
                </button>
                <span className="text-xl font-bold text-foreground w-16 text-center">{qty}</span>
                <button
                  onClick={() => adjustQty(1)}
                  disabled={qty + lotSize > maxQty}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center disabled:opacity-30"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => setQty(maxQty)}
                  className="text-xs text-primary font-medium ml-auto"
                >
                  Tout prendre
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCounterOffer}
              className="flex-1 h-12 rounded-xl border-2 border-amber-400 text-amber-600 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <MessageSquare size={16} /> Contre-offre
            </button>
            <button
              onClick={() => onAddToCart(qty)}
              className="flex-1 h-12 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-emerald-500/30"
            >
              <ShoppingCart size={16} /> Ajouter ({qty} u)
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ── */
export default function RestockMobileSwipe() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [detailOffer, setDetailOffer] = useState<any>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQty, setCounterQty] = useState("");
  const [exitDir, setExitDir] = useState<"left" | "right">("right");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["restock-mobile-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_offers")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      const offersData = data || [];
      const matchedIds = offersData.map((o: any) => o.matched_product_id).filter(Boolean);
      let productsMap: Record<string, any> = {};
      if (matchedIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, slug, best_price_excl_vat, best_price_incl_vat, image_url, gtin")
          .in("id", [...new Set(matchedIds)]);
        if (products) productsMap = Object.fromEntries(products.map(p => [p.id, p]));
      }
      return offersData.map((o: any) => ({
        ...o,
        medikong_product: o.matched_product_id ? productsMap[o.matched_product_id] || null : null,
      }));
    },
  });

  const remaining = offers.slice(currentIdx);
  const currentOffer = remaining[0];
  const allSwiped = currentIdx >= offers.length;
  const progress = offers.length > 0 ? Math.round((currentIdx / offers.length) * 100) : 0;
  const cartTotal = cart.reduce((sum, c) => sum + (c.price_ht || 0) * (c.qty || c.quantity || 1), 0);

  // Full-screen flash feedback
  const [flash, setFlash] = useState<"accept" | "reject" | null>(null);
  const flashTimer = useRef<NodeJS.Timeout | null>(null);
  const triggerFlash = useCallback((type: "accept" | "reject") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(type);
    flashTimer.current = setTimeout(() => setFlash(null), 900);
  }, []);

  const onSwipe = useCallback((dir: "left" | "right") => {
    const offer = offers[currentIdx];
    setExitDir(dir);
    if (dir === "right" && offer) {
      setCart(prev => [...prev, { ...offer, qty: offer.allow_partial ? (offer.moq || 1) : offer.quantity }]);
      triggerFlash("accept");
    } else {
      triggerFlash("reject");
    }
    setCurrentIdx(prev => prev + 1);
  }, [currentIdx, offers, triggerFlash]);

  const addFromDetail = (offer: any, qty: number) => {
    setCart(prev => [...prev, { ...offer, qty }]);
    triggerFlash("accept");
    setDetailOffer(null);
    setCurrentIdx(prev => prev + 1);
  };

  const handleCounter = async () => {
    const target = detailOffer || currentOffer;
    if (!target || !counterPrice) return;
    const { data: buyerData } = await supabase.from("restock_buyers").select("id").limit(1).maybeSingle();
    await supabase.from("restock_counter_offers").insert({
      offer_id: target.id,
      buyer_id: buyerData?.id || "00000000-0000-0000-0000-000000000000",
      proposed_price: parseFloat(counterPrice),
      proposed_quantity: parseInt(counterQty) || target.quantity,
      status: "pending",
    });
    toast.success("Contre-offre envoyée !", { icon: "💬" });
    setShowCounter(false);
    setDetailOffer(null);
    setCounterPrice("");
    setCounterQty("");
    setCurrentIdx(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Package className="animate-pulse text-primary mx-auto" size={48} />
          <p className="text-sm text-muted-foreground">Chargement des offres…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Full-screen flash feedback */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-[100] pointer-events-none flex items-center justify-center ${flash === "accept" ? "bg-emerald-500/25" : "bg-red-500/25"}`}
          >
            <div className={`absolute inset-0 border-[6px] ${flash === "accept" ? "border-emerald-400 shadow-[inset_0_0_120px_40px_rgba(16,185,129,0.35)]" : "border-red-400 shadow-[inset_0_0_120px_40px_rgba(239,68,68,0.35)]"}`} />
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className={`flex flex-col items-center gap-3 px-10 py-6 rounded-3xl backdrop-blur-md ${flash === "accept" ? "bg-emerald-500/30" : "bg-red-500/30"}`}
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl ${flash === "accept" ? "bg-emerald-500" : "bg-red-500"}`}>
                {flash === "accept" ? <ShoppingCart size={40} className="text-white" /> : <X size={40} className="text-white" />}
              </div>
              <span className={`text-xl font-extrabold ${flash === "accept" ? "text-emerald-800" : "text-red-800"}`}>
                {flash === "accept" ? "Ajouté au panier !" : "Passé !"}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={18} className="text-muted-foreground" /></button>
          <span className="text-primary font-bold text-base">MediKong</span>
          <span className="text-emerald-600 font-bold text-xs">ReStock</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/restock/opportunities")}
            className="text-[10px] text-muted-foreground border border-border px-2.5 py-1 rounded-full"
          >
            ☰ Grille
          </button>
          <div className="relative">
            <ShoppingCart size={20} className="text-muted-foreground" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold px-1">
                {cart.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-4 pt-2.5 pb-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>{currentIdx}/{offers.length} offres vues</span>
          <span>{cart.length} au panier</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Instructions */}
      {currentIdx === 0 && !allSwiped && (
        <div className="flex items-center justify-center gap-4 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">← Passer</span>
          <span className="flex items-center gap-1">↑ Détails</span>
          <span className="flex items-center gap-1">Panier →</span>
        </div>
      )}

      {/* Card stack */}
      <div className="flex-1 flex items-start justify-center px-4 pt-1">
        {allSwiped ? (
          <div className="text-center px-6 pt-12 w-full max-w-sm mx-auto">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <Package size={36} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Toutes les offres parcourues !</h2>
            {cart.length > 0 ? (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  <b className="text-foreground">{cart.length}</b> produit{cart.length > 1 ? "s" : ""} dans votre panier
                </p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
                  <p className="text-sm font-semibold text-emerald-800">Récapitulatif</p>
                  {cart.slice(0, 5).map((c, i) => (
                    <div key={i} className="flex justify-between text-xs text-emerald-700">
                      <span className="truncate flex-1 mr-2">{c.designation}</span>
                      <span className="font-medium">{formatPrice((c.price_ht || 0) * (c.qty || c.quantity))}</span>
                    </div>
                  ))}
                  {cart.length > 5 && <p className="text-[10px] text-emerald-600">+{cart.length - 5} autres…</p>}
                  <div className="border-t border-emerald-200 pt-2 flex justify-between text-sm font-bold text-emerald-800">
                    <span>Total HT</span>
                    <span>{formatPrice(cartTotal)}</span>
                  </div>
                </div>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-6 text-base font-bold shadow-lg shadow-emerald-500/30">
                  Finaliser ma commande →
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">Revenez bientôt pour de nouvelles opportunités</p>
            )}
          </div>
        ) : (
          <div className="relative w-full max-w-sm mx-auto" style={{ height: "min(480px, 60dvh)" }}>
            <AnimatePresence>
              {remaining.slice(0, 3).reverse().map((offer, i) => {
                const isFront = i === Math.min(remaining.length, 3) - 1;
                return (
                  <SwipeCard
                    key={offer.id}
                    offer={offer}
                    onSwipe={onSwipe}
                    isFront={isFront}
                    onTap={() => isFront && setDetailOffer(offer)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!allSwiped && (
        <div className="flex items-center justify-center gap-5 py-4 px-4">
          {/* Pass */}
          <button
            onClick={() => onSwipe("left")}
            className="w-14 h-14 rounded-full bg-white border-2 border-red-400 flex items-center justify-center shadow-md active:scale-90 transition-transform"
          >
            <X size={26} className="text-red-500" />
          </button>
          {/* Info */}
          <button
            onClick={() => currentOffer && setDetailOffer(currentOffer)}
            className="w-11 h-11 rounded-full bg-white border-2 border-primary/40 flex items-center justify-center shadow-md active:scale-90 transition-transform"
          >
            <Info size={20} className="text-primary" />
          </button>
          {/* Cart */}
          <button
            onClick={() => onSwipe("right")}
            className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform"
          >
            <ShoppingCart size={26} className="text-white" />
          </button>
        </div>
      )}

      {/* Cart summary banner */}
      {cart.length > 0 && !allSwiped && (
        <div className="px-4 pb-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-emerald-700">
              <b>{cart.length}</b> produit{cart.length > 1 ? "s" : ""} · <b>{formatPrice(cartTotal)}</b> HT
            </span>
            <button className="text-xs font-bold text-emerald-700 underline">Voir</button>
          </div>
        </div>
      )}

      {/* Detail bottom sheet */}
      <AnimatePresence>
        {detailOffer && !showCounter && (
          <DetailSheet
            offer={detailOffer}
            onClose={() => setDetailOffer(null)}
            onAddToCart={(qty) => addFromDetail(detailOffer, qty)}
            onCounterOffer={() => setShowCounter(true)}
          />
        )}
      </AnimatePresence>

      {/* Counter-offer bottom sheet */}
      <AnimatePresence>
        {showCounter && (detailOffer || currentOffer) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            onClick={() => { setShowCounter(false); setDetailOffer(null); }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full bg-white rounded-t-3xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
              <h3 className="font-bold text-foreground text-lg">Faire une contre-offre</h3>
              <p className="text-sm text-muted-foreground">
                <b>{(detailOffer || currentOffer)?.designation}</b> — Prix actuel : {formatPrice((detailOffer || currentOffer)?.price_ht || 0)} HT
              </p>
              <div>
                <Label className="text-xs font-medium">Prix proposé (€ HT/unité)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: 3.50"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Quantité souhaitée</Label>
                <Input
                  type="number"
                  value={counterQty}
                  onChange={(e) => setCounterQty(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder={String((detailOffer || currentOffer)?.quantity)}
                />
              </div>
              <Button
                onClick={handleCounter}
                disabled={!counterPrice || parseFloat(counterPrice) <= 0}
                className="w-full bg-primary text-primary-foreground rounded-xl py-5 text-base font-bold"
              >
                Envoyer la contre-offre
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
