import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from "framer-motion";
import {
  Search, Package, ShoppingCart, MessageSquare, Truck, MapPin, Clock, Box, Shield,
  Grid, List, ChevronDown, ChevronUp, X, Info, Minus, Plus, Lock, Flame,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { MEDIKONG_PLACEHOLDER, isValidProductImage } from "@/lib/image-utils";

const gradeConfig: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  A: { label: "A — Neuf", desc: "Emballage intact, DLU longue", color: "#00B85C", bg: "#EEFBF4" },
  B: { label: "B — Bon état", desc: "Emballage légèrement abîmé", color: "#1C58D9", bg: "#EBF0FB" },
  C: { label: "C — Abîmé", desc: "Emballage visiblement abîmé", color: "#F59E0B", bg: "#FEF3C7" },
  D: { label: "D — DLU courte", desc: "Date limite d'utilisation proche", color: "#E54545", bg: "#FEE2E2" },
};

const stateToGrade: Record<string, string> = {
  intact: "A", damaged_packaging: "B", near_expiry: "C",
};

const deliveryLabels: Record<string, { label: string; icon: typeof Truck }> = {
  pickup: { label: "Enlèvement", icon: MapPin },
  shipping: { label: "Livraison", icon: Truck },
  both: { label: "Enlèvement / Livraison", icon: Truck },
};

/* ── Sidebar filter section ── */
function FilterSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full text-xs font-bold text-foreground uppercase tracking-wider mb-2">
        {title}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && children}
    </div>
  );
}

function CheckItem({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-sm text-foreground hover:text-primary">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[11px] text-muted-foreground">({count})</span>
    </label>
  );
}

/* ── Swipe Card (inline for mobile tinder mode) ── */
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
  const imgSrc = offer.product_image_url && isValidProductImage(offer.product_image_url) ? offer.product_image_url : null;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) onSwipe("right");
    else if (info.offset.x < -100) onSwipe("left");
  };

  return (
    <motion.div
      style={{ x, rotate, position: "absolute", top: 0, left: 0, width: "100%", zIndex: isFront ? 10 : 1, touchAction: "none" }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      onTap={isFront ? onTap : undefined}
      initial={isFront ? { scale: 1 } : { scale: 0.95, y: 8 }}
      animate={isFront ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.95, opacity: 0.6, y: 8 }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.25 } }}
    >
      {isFront && (
        <>
          <motion.div style={{ opacity: rightOverlay }} className="absolute inset-0 z-20 rounded-2xl bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center pointer-events-none">
            <div className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-xl font-bold rotate-12 shadow-lg"><ShoppingCart className="inline mr-2" size={20} />PANIER</div>
          </motion.div>
          <motion.div style={{ opacity: leftOverlay }} className="absolute inset-0 z-20 rounded-2xl bg-red-500/20 border-4 border-red-500 flex items-center justify-center pointer-events-none">
            <div className="bg-red-500 text-white px-5 py-2 rounded-xl text-xl font-bold -rotate-12 shadow-lg"><X className="inline mr-2" size={20} />PASSE</div>
          </motion.div>
        </>
      )}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden select-none border border-border">
        <div className="relative h-44 bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center overflow-hidden">
          {imgSrc ? <img src={imgSrc} alt="" className="h-36 object-contain drop-shadow-lg" /> : <Package size={56} className="text-white/25" />}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white/90 text-[10px] font-medium flex items-center gap-1"><Lock size={10} /> Vendeur anonyme</span>
          {discount > 0 && <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-500 text-white text-sm font-bold shadow-md">−{discount}%</span>}
          {isFront && <div className="absolute bottom-2 right-2 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-[9px] text-white/80"><ChevronUp size={10} /> Détails</div>}
        </div>
        <div className="p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: grade.bg, color: grade.color }}>{grade.label}</span>
            <span className="text-[10px] text-muted-foreground italic">{grade.desc}</span>
          </div>
          <h3 className="font-bold text-foreground text-[17px] leading-tight line-clamp-2">{offer.designation || "Produit"}</h3>
          <p className="text-[11px] text-muted-foreground">{offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground line-through">{cataloguePrice.toFixed(2)} €</span>
            <span className="text-2xl font-extrabold text-primary">{(offer.price_ht || 0).toFixed(2)} €</span>
            <span className="text-xs text-muted-foreground">HT/u</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-1.5"><Box size={13} /><b className="text-foreground">{offer.quantity}</b> unités</div>
            <div className="flex items-center gap-1.5"><Clock size={13} />DLU {offer.dlu ? new Date(offer.dlu).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
            <div className="flex items-center gap-1.5"><MapPin size={13} />{offer.seller_city || "Belgique"}</div>
            <div className="flex items-center gap-1.5">{offer.delivery_condition === "pickup" ? <MapPin size={13} /> : <Truck size={13} />}{offer.delivery_condition === "pickup" ? "Enlèvement" : offer.delivery_condition === "shipping" ? "Livraison" : "Les deux"}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Detail bottom sheet ── */
function TinderDetailSheet({ offer, onClose, onAddToCart, onCounterOffer }: {
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
  const adjustQty = (delta: number) => setQty(prev => Math.max(moq, Math.min(maxQty, prev + delta * lotSize)));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-h-[85vh] bg-white rounded-t-3xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white pt-3 pb-2 flex justify-center z-10"><div className="w-10 h-1 bg-muted-foreground/30 rounded-full" /></div>
        <div className="px-5 pb-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {offer.product_image_url ? <img src={offer.product_image_url} alt="" className="w-full h-full object-contain" /> : <Package size={28} className="text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-foreground text-lg leading-tight">{offer.designation}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: grade.bg, color: grade.color }}>{grade.label}</span>
            <span className="text-xs text-muted-foreground">{grade.desc}</span>
          </div>
          <div className="bg-primary/5 rounded-xl p-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-extrabold text-primary">{(offer.price_ht || 0).toFixed(2)} €</span>
              <span className="text-sm text-muted-foreground">HT/unité</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="line-through">{cataloguePrice.toFixed(2)} €</span>
              {discount > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">−{discount}%</span>}
              <span>soit <b className="text-foreground">{((offer.price_ht || 0) * qty).toFixed(2)} €</b> pour {qty} u</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Box, label: "Quantité", value: `${offer.quantity} unités` },
              { icon: Clock, label: "DLU", value: offer.dlu ? new Date(offer.dlu).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
              { icon: MapPin, label: "Localisation", value: offer.seller_city || "Belgique" },
              { icon: Truck, label: "Livraison", value: offer.delivery_condition === "pickup" ? "Enlèvement" : offer.delivery_condition === "shipping" ? "Livraison" : "Les deux" },
            ].map((item, i) => (
              <div key={i} className="bg-muted/40 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1"><item.icon size={11} />{item.label}</div>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
          {offer.allow_partial && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Quantité (min. {moq}{lotSize > 1 ? `, ×${lotSize}` : ""}, max. {maxQty})</p>
              <div className="flex items-center gap-3">
                <button onClick={() => adjustQty(-1)} disabled={qty - lotSize < moq} className="w-10 h-10 rounded-full border border-border flex items-center justify-center disabled:opacity-30"><Minus size={16} /></button>
                <span className="text-xl font-bold text-foreground w-16 text-center">{qty}</span>
                <button onClick={() => adjustQty(1)} disabled={qty + lotSize > maxQty} className="w-10 h-10 rounded-full border border-border flex items-center justify-center disabled:opacity-30"><Plus size={16} /></button>
                <button onClick={() => setQty(maxQty)} className="text-xs text-primary font-medium ml-auto">Tout prendre</button>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onCounterOffer} className="flex-1 h-12 rounded-xl border-2 border-amber-400 text-amber-600 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"><MessageSquare size={16} /> Contre-offre</button>
            <button onClick={() => onAddToCart(qty)} className="flex-1 h-12 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-emerald-500/30"><ShoppingCart size={16} /> Ajouter ({qty} u)</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
/* ── Tinder View (inline) ── */
function TinderView({ offers, tinderIdx, setTinderIdx, tinderCart, setTinderCart, tinderDetail, setTinderDetail, tinderCounter, setTinderCounter, tinderCounterPrice, setTinderCounterPrice, tinderCounterQty, setTinderCounterQty, buyer, formatPrice }: any) {
  const remaining = offers.slice(tinderIdx);
  const currentOffer = remaining[0];
  const allSwiped = tinderIdx >= offers.length;
  const progress = offers.length > 0 ? Math.round((tinderIdx / offers.length) * 100) : 0;
  const cartTotal = tinderCart.reduce((sum: number, c: any) => sum + (c.price_ht || 0) * (c.qty || c.quantity || 1), 0);

  // Full-screen flash feedback
  const [flash, setFlash] = useState<"accept" | "reject" | null>(null);
  const flashRef = useRef<NodeJS.Timeout | null>(null);
  const triggerFlash = useCallback((type: "accept" | "reject") => {
    if (flashRef.current) clearTimeout(flashRef.current);
    setFlash(type);
    flashRef.current = setTimeout(() => setFlash(null), 900);
  }, []);

  const onSwipe = useCallback((dir: "left" | "right") => {
    const offer = offers[tinderIdx];
    if (dir === "right" && offer) {
      setTinderCart((prev: any[]) => [...prev, { ...offer, qty: offer.allow_partial ? (offer.moq || 1) : offer.quantity }]);
      triggerFlash("accept");
    } else {
      triggerFlash("reject");
    }
    setTinderIdx((prev: number) => prev + 1);
  }, [tinderIdx, offers, setTinderCart, setTinderIdx, triggerFlash]);

  const addFromDetail = (offer: any, qty: number) => {
    setTinderCart((prev: any[]) => [...prev, { ...offer, qty }]);
    triggerFlash("accept");
    setTinderDetail(null);
    setTinderIdx((prev: number) => prev + 1);
  };

  const handleCounter = async () => {
    const target = tinderDetail || currentOffer;
    if (!target || !tinderCounterPrice) return;
    const { data: buyerData } = await supabase.from("restock_buyers").select("id").limit(1).maybeSingle();
    await supabase.from("restock_counter_offers").insert({
      offer_id: target.id, buyer_id: buyerData?.id || "00000000-0000-0000-0000-000000000000",
      proposed_price: parseFloat(tinderCounterPrice), proposed_quantity: parseInt(tinderCounterQty) || target.quantity, status: "pending",
    });
    toast.success("Contre-offre envoyée !", { icon: "💬" });
    setTinderCounter(false);
    setTinderDetail(null);
    setTinderCounterPrice("");
    setTinderCounterQty("");
    setTinderIdx((prev: number) => prev + 1);
  };

  return (
    <div className="space-y-3 relative">
      {/* Full-screen flash feedback */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`fixed inset-0 z-[100] pointer-events-none flex items-center justify-center ${flash === "accept" ? "bg-emerald-500/25" : "bg-red-500/25"}`}
          >
            {/* Thick glowing border */}
            <div className={`absolute inset-0 border-[6px] rounded-none ${flash === "accept" ? "border-emerald-400 shadow-[inset_0_0_120px_40px_rgba(16,185,129,0.35)]" : "border-red-400 shadow-[inset_0_0_120px_40px_rgba(239,68,68,0.35)]"}`} />
            {/* Centered feedback */}
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
      {/* Progress */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{tinderIdx}/{offers.length} offres vues</span>
        <span>{tinderCart.length} au panier</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      <AnimatePresence>
        {tinderIdx === 0 && !allSwiped && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-emerald-500/10 border border-primary/20 rounded-2xl px-5 py-4 mx-auto max-w-sm"
          >
            <p className="text-center text-sm font-semibold text-foreground mb-3">Comment ça marche ?</p>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><X size={18} className="text-red-500" /></div>
                <span className="font-medium text-foreground">Passer</span>
                <span className="text-[10px]">Swipez gauche</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Info size={18} className="text-primary" /></div>
                <span className="font-medium text-foreground">Détails</span>
                <span className="text-[10px]">Tapez la carte</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"><ShoppingCart size={18} className="text-emerald-600" /></div>
                <span className="font-medium text-foreground">Panier</span>
                <span className="text-[10px]">Swipez droite</span>
              </div>
            </div>
            {/* Swipe hand animation */}
            <motion.div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 pointer-events-none"
              initial={{ x: 0, opacity: 0.7 }}
              animate={{ x: [0, 40, 0, -40, 0], opacity: [0.7, 1, 0.7, 1, 0.7] }}
              transition={{ duration: 3, repeat: 2, ease: "easeInOut" }}
            >
              <span className="text-2xl">👆</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {allSwiped ? (
        <div className="text-center px-4 py-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"><Package size={32} className="text-primary" /></div>
          <h2 className="text-lg font-bold text-foreground mb-2">Toutes les offres parcourues !</h2>
          {tinderCart.length > 0 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm"><b className="text-foreground">{tinderCart.length}</b> produit{tinderCart.length > 1 ? "s" : ""}</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-left space-y-1.5">
                {tinderCart.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-emerald-700">
                    <span className="truncate flex-1 mr-2">{c.designation}</span>
                    <span className="font-medium">{formatPrice((c.price_ht || 0) * (c.qty || c.quantity))}</span>
                  </div>
                ))}
                {tinderCart.length > 5 && <p className="text-[10px] text-emerald-600">+{tinderCart.length - 5} autres…</p>}
                <div className="border-t border-emerald-200 pt-2 flex justify-between text-sm font-bold text-emerald-800">
                  <span>Total HT</span><span>{formatPrice(cartTotal)}</span>
                </div>
              </div>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-5 text-base font-bold shadow-lg shadow-emerald-500/30">Finaliser ma commande →</Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Revenez bientôt pour de nouvelles opportunités</p>
          )}
          <button onClick={() => { setTinderIdx(0); setTinderCart([]); }} className="text-xs text-primary hover:underline mt-3">Recommencer</button>
        </div>
      ) : (
        <>
          <div className="relative w-full max-w-sm mx-auto" style={{ height: "min(480px, 55dvh)" }}>
            <AnimatePresence>
              {remaining.slice(0, 3).reverse().map((offer: any, i: number) => {
                const isFront = i === Math.min(remaining.length, 3) - 1;
                return <SwipeCard key={offer.id} offer={offer} onSwipe={onSwipe} isFront={isFront} onTap={() => isFront && setTinderDetail(offer)} />;
              })}
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-center gap-5 py-3">
            <button onClick={() => onSwipe("left")} className="w-14 h-14 rounded-full bg-white border-2 border-red-400 flex items-center justify-center shadow-md active:scale-90 transition-transform"><X size={26} className="text-red-500" /></button>
            <button onClick={() => currentOffer && setTinderDetail(currentOffer)} className="w-11 h-11 rounded-full bg-white border-2 border-primary/40 flex items-center justify-center shadow-md active:scale-90 transition-transform"><Info size={20} className="text-primary" /></button>
            <button onClick={() => onSwipe("right")} className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform"><ShoppingCart size={26} className="text-white" /></button>
          </div>
        </>
      )}

      {tinderCart.length > 0 && !allSwiped && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-emerald-700"><b>{tinderCart.length}</b> produit{tinderCart.length > 1 ? "s" : ""} · <b>{formatPrice(cartTotal)}</b> HT</span>
        </div>
      )}

      <AnimatePresence>
        {tinderDetail && !tinderCounter && (
          <TinderDetailSheet offer={tinderDetail} onClose={() => setTinderDetail(null)} onAddToCart={(qty: number) => addFromDetail(tinderDetail, qty)} onCounterOffer={() => setTinderCounter(true)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tinderCounter && (tinderDetail || currentOffer) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end" onClick={() => { setTinderCounter(false); setTinderDetail(null); }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full bg-white rounded-t-3xl p-6 space-y-4" onClick={(e: any) => e.stopPropagation()}>
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
              <h3 className="font-bold text-foreground text-lg">Faire une contre-offre</h3>
              <p className="text-sm text-muted-foreground"><b>{(tinderDetail || currentOffer)?.designation}</b> — Prix : {formatPrice((tinderDetail || currentOffer)?.price_ht || 0)} HT</p>
              <div>
                <Label className="text-xs font-medium">Prix proposé (€ HT/unité)</Label>
                <Input type="number" step="0.01" value={tinderCounterPrice} onChange={(e: any) => setTinderCounterPrice(e.target.value)} className="rounded-xl mt-1" placeholder="Ex: 3.50" autoFocus />
              </div>
              <div>
                <Label className="text-xs font-medium">Quantité souhaitée</Label>
                <Input type="number" value={tinderCounterQty} onChange={(e: any) => setTinderCounterQty(e.target.value)} className="rounded-xl mt-1" placeholder={String((tinderDetail || currentOffer)?.quantity)} />
              </div>
              <Button onClick={handleCounter} disabled={!tinderCounterPrice || parseFloat(tinderCounterPrice) <= 0} className="w-full bg-primary text-primary-foreground rounded-xl py-5 text-base font-bold">Envoyer la contre-offre</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RestockOpportunities() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "tinder">("grid");
  const [counterOfferTarget, setCounterOfferTarget] = useState<any>(null);
  const [counterForm, setCounterForm] = useState({ price: "", quantity: "" });
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [buyQuantity, setBuyQuantity] = useState<number>(0);

  // Tinder mode state
  const [tinderIdx, setTinderIdx] = useState(0);
  const [tinderCart, setTinderCart] = useState<any[]>([]);
  const [tinderDetail, setTinderDetail] = useState<any>(null);
  const [tinderCounter, setTinderCounter] = useState(false);
  const [tinderCounterPrice, setTinderCounterPrice] = useState("");
  const [tinderCounterQty, setTinderCounterQty] = useState("");

  // Sidebar filters
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [dluMin, setDluMin] = useState<number>(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);

  // Default to tinder on mobile
  useEffect(() => {
    if (isMobile) setViewMode("tinder");
  }, [isMobile]);

  const { data: buyer } = useQuery({
    queryKey: ["restock-buyer-token", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data } = await supabase.from("restock_buyers").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["restock-public-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_offers")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const offersData = data || [];
      // Batch-fetch matched MediKong products
      const matchedIds = offersData.map((o: any) => o.matched_product_id).filter(Boolean);
      let productsMap: Record<string, any> = {};
      if (matchedIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, best_price_excl_vat, best_price_incl_vat, image_url, gtin")
          .in("id", [...new Set(matchedIds)]);
        if (products) {
          productsMap = Object.fromEntries(products.map(p => [p.id, p]));
        }
      }
      return offersData.map((o: any) => ({
        ...o,
        medikong_product: o.matched_product_id ? productsMap[o.matched_product_id] || null : null,
      }));
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["restock-rules-public"],
    queryFn: async () => {
      const { data } = await supabase.from("restock_rules").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const shippingFee = useMemo(() => {
    const rule = rules.find((r: any) => r.rule_type === "shipping_flat_fee");
    return rule ? parseFloat(String(rule.value)) : 9.90;
  }, [rules]);

  // Extract facets
  const facets = useMemo(() => {
    const grades = new Map<string, number>();
    const brands = new Map<string, number>();
    const deliveries = new Map<string, number>();
    let maxPrice = 0;
    for (const o of offers) {
      const g = o.grade || stateToGrade[o.product_state] || "A";
      grades.set(g, (grades.get(g) || 0) + 1);
      const b = (o as any).brand_name || "Autre";
      brands.set(b, (brands.get(b) || 0) + 1);
      const d = o.delivery_condition || "both";
      deliveries.set(d, (deliveries.get(d) || 0) + 1);
      if ((o.price_ht || 0) > maxPrice) maxPrice = o.price_ht || 0;
    }
    return {
      grades: Array.from(grades.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      brands: Array.from(brands.entries()).sort((a, b) => b[1] - a[1]),
      deliveries: Array.from(deliveries.entries()),
      maxPrice: Math.ceil(maxPrice / 10) * 10 || 100,
    };
  }, [offers]);

  // Initialize price range
  useEffect(() => {
    if (facets.maxPrice > 0) setPriceRange([0, facets.maxPrice]);
  }, [facets.maxPrice]);

  // Filter offers
  const filtered = useMemo(() => {
    let list = offers;

    if (selectedGrades.length > 0) {
      list = list.filter((o: any) => {
        const g = o.grade || stateToGrade[o.product_state] || "A";
        return selectedGrades.includes(g);
      });
    }
    if (selectedBrands.length > 0) {
      list = list.filter((o: any) => selectedBrands.includes((o as any).brand_name || "Autre"));
    }
    if (selectedDelivery.length > 0) {
      list = list.filter((o: any) => selectedDelivery.includes(o.delivery_condition || "both"));
    }
    if (dluMin > 0) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() + dluMin);
      list = list.filter((o: any) => o.dlu && new Date(o.dlu) > cutoff);
    }
    if (priceRange[0] > 0 || priceRange[1] < facets.maxPrice) {
      list = list.filter((o: any) => (o.price_ht || 0) >= priceRange[0] && (o.price_ht || 0) <= priceRange[1]);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o: any) =>
          (o.designation || "").toLowerCase().includes(q) ||
          (o.ean || "").toLowerCase().includes(q) ||
          (o.cnk || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [offers, selectedGrades, selectedBrands, selectedDelivery, dluMin, priceRange, search, facets.maxPrice]);

  const sellerCount = useMemo(() => new Set(offers.map((o: any) => o.seller_id)).size, [offers]);
  const hasFilters = selectedGrades.length > 0 || selectedBrands.length > 0 || selectedDelivery.length > 0 || dluMin > 0 || search.length > 0;

  const clearFilters = () => {
    setSelectedGrades([]);
    setSelectedBrands([]);
    setSelectedDelivery([]);
    setDluMin(0);
    setPriceRange([0, facets.maxPrice]);
    setSearch("");
  };

  const toggleFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  // Mutations
  const takeMutation = useMutation({
    mutationFn: async ({ offer, qty }: { offer: any; qty: number }) => {
      const isFullTake = qty >= offer.quantity;
      if (isFullTake) {
        const { error } = await supabase.from("restock_offers").update({ status: "sold" }).eq("id", offer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("restock_offers").update({ quantity: offer.quantity - qty }).eq("id", offer.id);
        if (error) throw error;
      }
      await supabase.from("restock_transactions").insert({
        offer_id: offer.id, buyer_id: buyer?.id || null, seller_id: offer.seller_id,
        final_price: offer.price_ht, quantity: qty,
        delivery_mode: offer.delivery_condition === "pickup" ? "pickup" : "shipping",
        shipping_cost: offer.delivery_condition === "pickup" ? 0 : shippingFee,
        commission_amount: offer.price_ht * qty * 0.05, status: "confirmed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-public-offers"] });
      toast.success("Offre confirmée !");
      setConfirmTarget(null);
      setBuyQuantity(0);
    },
    onError: () => toast.error("Erreur lors de la confirmation"),
  });

  const counterMutation = useMutation({
    mutationFn: async () => {
      if (!counterOfferTarget) return;
      const { error } = await supabase.from("restock_counter_offers").insert({
        offer_id: counterOfferTarget.id, buyer_id: buyer?.id || null,
        proposed_price: parseFloat(counterForm.price),
        proposed_quantity: parseInt(counterForm.quantity) || counterOfferTarget.quantity,
        status: "pending",
      });
      if (error) throw error;
      await supabase.from("restock_offers").update({ status: "counter_offer" }).eq("id", counterOfferTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-public-offers"] });
      toast.success("Contre-offre envoyée !");
      setCounterOfferTarget(null);
      setCounterForm({ price: "", quantity: "" });
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
  };
  const formatPrice = (p: number) => `${p.toFixed(2)} €`;
  const getCataloguePrice = (offer: any) => offer.medikong_product?.best_price_excl_vat || (offer.price_ht || 0) * 1.3;
  const getDiscount = (offer: any) => {
    const mk = offer.medikong_product?.best_price_excl_vat;
    if (mk && mk > 0) return Math.round((1 - (offer.price_ht || 0) / mk) * 100);
    const cat = (offer.price_ht || 0) * 1.3;
    return Math.round(((cat - (offer.price_ht || 0)) / cat) * 100);
  };

  /* ── Render helpers ── */
  const renderOfferCard = (offer: any) => {
    const cataloguePrice = getCataloguePrice(offer);
    const discount = getDiscount(offer);
    const grade = offer.grade || stateToGrade[offer.product_state] || "A";
    const gc = gradeConfig[grade] || gradeConfig.A;
    const delivery = deliveryLabels[offer.delivery_condition] || deliveryLabels.both;
    const DeliveryIcon = delivery.icon;
    const imgSrc = offer.product_image_url && isValidProductImage(offer.product_image_url) ? offer.product_image_url : null;

    if (viewMode === "list") {
      return (
        <div key={offer.id} className="bg-white rounded-xl border border-border shadow-sm flex gap-4 p-4 hover:shadow-md transition-shadow">
          {/* Image */}
          <div className="shrink-0 w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {imgSrc ? (
              <img src={imgSrc} alt={offer.designation} className="w-full h-full object-contain" />
            ) : (
              <Package size={28} className="text-muted-foreground" />
            )}
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{offer.designation || "Produit"}</h3>
            <p className="text-[11px] text-muted-foreground">
              {offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: gc.bg, color: gc.color }} title={gc.desc}>{gc.label}</span>
              <span className="text-xs text-muted-foreground"><b>{offer.quantity}</b> u</span>
              <span className="text-xs text-muted-foreground">DLU {formatDate(offer.dlu)}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={10} />{offer.seller_city || "BE"}</span>
            </div>
          </div>
          {/* Price + actions */}
          <div className="shrink-0 flex flex-col items-end justify-between">
            <div className="text-right">
              <span className="text-lg font-bold text-primary">{formatPrice(offer.price_ht || 0)}</span>
              <span className="text-[10px] text-muted-foreground ml-1">HT/u</span>
              {discount > 0 && <span className="ml-2 text-xs font-bold text-emerald-600">-{discount}% {offer.medikong_product ? 'vs neuf' : ''}</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { setCounterOfferTarget(offer); setCounterForm({ price: "", quantity: String(offer.allow_partial ? offer.moq : offer.quantity) }); }}>
                <MessageSquare size={12} /> Contre-offre
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setConfirmTarget(offer); setBuyQuantity(offer.allow_partial ? offer.moq : offer.quantity); }}>
                <ShoppingCart size={12} /> Je prends
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Grid card
    return (
      <div key={offer.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        {/* Image */}
        <div className="h-40 bg-muted flex items-center justify-center overflow-hidden relative">
          {imgSrc ? (
            <img src={imgSrc} alt={offer.designation} className="w-full h-full object-contain p-3" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Package size={36} />
              <span className="text-[10px]">Pas de photo</span>
            </div>
          )}
          {discount > 0 && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold">-{discount}%</span>
          )}
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: gc.bg, color: gc.color }} title={gc.desc}>
            {gc.label}
          </span>
        </div>

        <div className="p-4 flex-1 space-y-2">
          <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{offer.designation || "Produit"}</h3>
          <p className="text-[11px] text-muted-foreground">
            {offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}
          </p>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary">{formatPrice(offer.price_ht || 0)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatPrice(cataloguePrice)}</span>
            <span className="text-[11px] text-muted-foreground">HT/u</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Box size={12} /><b>{offer.quantity}</b> u</span>
            <span className="flex items-center gap-1"><Clock size={12} />DLU {formatDate(offer.dlu)}</span>
            <span className="flex items-center gap-1"><MapPin size={12} />{offer.seller_city || "BE"}</span>
            <span className="flex items-center gap-1"><DeliveryIcon size={12} />{delivery.label}</span>
          </div>

          {offer.allow_partial && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 rounded-lg px-2.5 py-1">
              <Package size={11} />
              <span>Min. {offer.moq} u{offer.lot_size > 1 ? `, par ${offer.lot_size}` : ""}</span>
            </div>
          )}

          {offer.delivery_condition !== "pickup" && (
            <p className="text-[11px] text-muted-foreground">Livraison : {formatPrice(shippingFee)}</p>
          )}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => { setCounterOfferTarget(offer); setCounterForm({ price: "", quantity: String(offer.allow_partial ? offer.moq : offer.quantity) }); }}>
            <MessageSquare size={13} /> Contre-offre
          </Button>
          <Button size="sm" className="flex-1 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setConfirmTarget(offer); setBuyQuantity(offer.allow_partial ? offer.moq : offer.quantity); }}>
            <ShoppingCart size={13} /> Je prends
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary font-bold text-lg">MediKong</span>
            <span className="text-emerald-600 font-bold text-base">ReStock</span>
          </div>
          <div className="flex items-center gap-3">
            {viewMode === "tinder" && tinderCart.length > 0 && (
              <div className="relative">
                <ShoppingCart size={20} className="text-muted-foreground" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold px-1">{tinderCart.length}</span>
              </div>
            )}
            {buyer && <span className="text-sm text-muted-foreground">{buyer.pharmacy_name}</span>}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-5 text-white mb-6">
          <div className="flex items-center gap-3">
            <Package size={28} strokeWidth={1.5} />
            <div>
              <h1 className="text-xl font-bold">
                {offers.length} offre{offers.length !== 1 ? "s" : ""} disponible{offers.length !== 1 ? "s" : ""} de {sellerCount} pharmacie{sellerCount !== 1 ? "s" : ""}
              </h1>
              <p className="text-white/80 text-sm">
                Mise à jour : {new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block w-60 shrink-0 space-y-1">
            <div className="bg-white rounded-xl border border-border p-4 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Filtres</h2>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-[11px] text-primary hover:underline">Effacer</button>
                )}
              </div>

              {/* Grade */}
              <FilterSection title="Grade">
                {facets.grades.map(([g, count]) => (
                  <CheckItem key={g} label={gradeConfig[g]?.label || g} count={count} checked={selectedGrades.includes(g)} onChange={() => toggleFilter(selectedGrades, g, setSelectedGrades)} />
                ))}
              </FilterSection>

              {/* DLU */}
              <FilterSection title="DLU minimum">
                <div className="space-y-1">
                  {[0, 1, 3, 6, 12].map(m => (
                    <label key={m} className="flex items-center gap-2 py-1 cursor-pointer text-sm text-foreground">
                      <input type="radio" name="dlu" checked={dluMin === m} onChange={() => setDluMin(m)} className="accent-primary" />
                      {m === 0 ? "Toutes" : `> ${m} mois`}
                    </label>
                  ))}
                </div>
              </FilterSection>

              {/* Price */}
              <FilterSection title="Prix HT/unité">
                <div className="px-1 pt-2 pb-1">
                  <Slider
                    min={0} max={facets.maxPrice} step={1}
                    value={priceRange}
                    onValueChange={(v) => setPriceRange(v as [number, number])}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                    <span>{priceRange[0]} €</span>
                    <span>{priceRange[1]} €</span>
                  </div>
                </div>
              </FilterSection>

              {/* Delivery */}
              <FilterSection title="Livraison">
                {facets.deliveries.map(([d, count]) => (
                  <CheckItem key={d} label={deliveryLabels[d]?.label || d} count={count} checked={selectedDelivery.includes(d)} onChange={() => toggleFilter(selectedDelivery, d, setSelectedDelivery)} />
                ))}
              </FilterSection>

              {/* Brands */}
              {facets.brands.length > 1 && (
                <FilterSection title="Marque" defaultOpen={false}>
                  {facets.brands.slice(0, 15).map(([b, count]) => (
                    <CheckItem key={b} label={b} count={count} checked={selectedBrands.includes(b)} onChange={() => toggleFilter(selectedBrands, b, setSelectedBrands)} />
                  ))}
                </FilterSection>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Rechercher par nom, EAN, CNK…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-full" />
              </div>
              <span className="text-sm text-muted-foreground">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</span>
              <div className="ml-auto flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => { setViewMode("tinder"); setTinderIdx(0); setTinderCart([]); }} className={`p-2 ${viewMode === "tinder" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`} title="Mode Tinder">
                  <Flame size={16} />
                </button>
                <button onClick={() => setViewMode("grid")} className={`p-2 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                  <Grid size={16} />
                </button>
                <button onClick={() => setViewMode("list")} className={`p-2 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                  <List size={16} />
                </button>
              </div>
            </div>

            {/* Active filters pills */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2">
                {selectedGrades.map(g => (
                  <span key={g} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {gradeConfig[g]?.label || g}
                    <button onClick={() => toggleFilter(selectedGrades, g, setSelectedGrades)}><X size={12} /></button>
                  </span>
                ))}
                {dluMin > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    DLU &gt; {dluMin} mois
                    <button onClick={() => setDluMin(0)}><X size={12} /></button>
                  </span>
                )}
                {selectedDelivery.map(d => (
                  <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {deliveryLabels[d]?.label || d}
                    <button onClick={() => toggleFilter(selectedDelivery, d, setSelectedDelivery)}><X size={12} /></button>
                  </span>
                ))}
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-primary underline">Tout effacer</button>
              </div>
            )}

            {/* Results */}
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Chargement…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package size={48} className="mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">Aucune offre trouvée</p>
                {hasFilters && <button onClick={clearFilters} className="text-sm text-primary hover:underline mt-2">Effacer les filtres</button>}
              </div>
            ) : viewMode === "tinder" ? (
              <TinderView
                offers={filtered}
                tinderIdx={tinderIdx}
                setTinderIdx={setTinderIdx}
                tinderCart={tinderCart}
                setTinderCart={setTinderCart}
                tinderDetail={tinderDetail}
                setTinderDetail={setTinderDetail}
                tinderCounter={tinderCounter}
                setTinderCounter={setTinderCounter}
                tinderCounterPrice={tinderCounterPrice}
                setTinderCounterPrice={setTinderCounterPrice}
                tinderCounterQty={tinderCounterQty}
                setTinderCounterQty={setTinderCounterQty}
                buyer={buyer}
                formatPrice={formatPrice}
              />
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(renderOfferCard)}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(renderOfferCard)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Counter-offer dialog */}
      <Dialog open={!!counterOfferTarget} onOpenChange={(o) => !o && setCounterOfferTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Faire une contre-offre</DialogTitle></DialogHeader>
          {counterOfferTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground"><b>{counterOfferTarget.designation}</b> — Prix actuel : {formatPrice(counterOfferTarget.price_ht || 0)} HT</p>
              <div>
                <Label>Prix proposé (€ HT/unité) *</Label>
                <Input type="number" step="0.01" min="0.01" value={counterForm.price} onChange={(e) => setCounterForm((f) => ({ ...f, price: e.target.value }))} className="rounded-lg" placeholder="Ex: 8.50" />
              </div>
              <div>
                <Label>Quantité souhaitée</Label>
                <Input type="number" min="1" value={counterForm.quantity} onChange={(e) => setCounterForm((f) => ({ ...f, quantity: e.target.value }))} className="rounded-lg" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterOfferTarget(null)}>Annuler</Button>
            <Button onClick={() => counterMutation.mutate()} disabled={!counterForm.price || parseFloat(counterForm.price) <= 0 || counterMutation.isPending} className="bg-primary text-primary-foreground">Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) { setConfirmTarget(null); setBuyQuantity(0); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmer l'achat</DialogTitle></DialogHeader>
          {confirmTarget && (() => {
            const isPartial = confirmTarget.allow_partial;
            const moq = confirmTarget.moq || 1;
            const lotSz = confirmTarget.lot_size || 1;
            const maxQty = confirmTarget.quantity;
            const isValidQty = buyQuantity >= moq && buyQuantity <= maxQty && (lotSz <= 1 || buyQuantity % lotSz === 0);
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Vous confirmez vouloir acheter :</p>
                <div className="bg-accent rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-foreground">{confirmTarget.designation}</p>
                  {isPartial ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Quantité (min. {moq}{lotSz > 1 ? `, ×${lotSz}` : ""}, max. {maxQty})</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" disabled={buyQuantity - lotSz < moq} onClick={() => setBuyQuantity(Math.max(moq, buyQuantity - lotSz))}>−</Button>
                        <Input type="number" min={moq} max={maxQty} step={lotSz} value={buyQuantity} onChange={(e) => setBuyQuantity(Math.min(maxQty, Math.max(moq, Number(e.target.value) || moq)))} className="w-24 text-center" />
                        <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" disabled={buyQuantity + lotSz > maxQty} onClick={() => setBuyQuantity(Math.min(maxQty, buyQuantity + lotSz))}>+</Button>
                        <Button type="button" variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setBuyQuantity(maxQty)}>Tout</Button>
                      </div>
                      {!isValidQty && buyQuantity > 0 && (
                        <p className="text-xs text-destructive mt-1">
                          {buyQuantity < moq ? `Minimum ${moq} unités` : lotSz > 1 && buyQuantity % lotSz !== 0 ? `Multiple de ${lotSz}` : `Maximum ${maxQty}`}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">{buyQuantity} × {formatPrice(confirmTarget.price_ht || 0)} HT</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{maxQty} × {formatPrice(confirmTarget.price_ht || 0)} HT</p>
                  )}
                  <p className="text-sm font-bold text-primary">Total : {formatPrice((confirmTarget.price_ht || 0) * buyQuantity)} HT</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmTarget(null); setBuyQuantity(0); }}>Annuler</Button>
            <Button onClick={() => takeMutation.mutate({ offer: confirmTarget, qty: buyQuantity })} disabled={takeMutation.isPending || !confirmTarget || buyQuantity < (confirmTarget?.moq || 1) || (confirmTarget?.lot_size > 1 && buyQuantity % confirmTarget.lot_size !== 0)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
