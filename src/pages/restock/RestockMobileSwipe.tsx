import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Heart, MessageSquare, ShoppingCart, Lock, Truck, MapPin, Clock, Box, Package } from "lucide-react";
import { toast } from "sonner";

const gradeConfig: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  A: { label: "A — Neuf", desc: "Emballage intact, DLU longue", color: "#00B85C", bg: "#EEFBF4" },
  B: { label: "B — Bon état", desc: "Emballage légèrement abîmé", color: "#1C58D9", bg: "#EBF0FB" },
  C: { label: "C — Abîmé", desc: "Emballage visiblement abîmé", color: "#F59E0B", bg: "#FEF3C7" },
  D: { label: "D — DLU courte", desc: "Date limite d'utilisation proche", color: "#E54545", bg: "#FEE2E2" },
};

/* ── Swipeable Card ── */
function SwipeCard({ offer, onSwipe, isFront }: { offer: any; onSwipe: (dir: string) => void; isFront: boolean }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  const takeOpacity = useTransform(x, [0, 80], [0, 1]);
  const passOpacity = useTransform(x, [-80, 0], [1, 0]);

  const cataloguePrice = (offer.price_ht || 0) * 1.3;
  const discount = Math.round(((cataloguePrice - (offer.price_ht || 0)) / cataloguePrice) * 100);
  const grade = gradeConfig[offer.grade] || gradeConfig.A;

  const formatPrice = (p: number) => `${p.toFixed(2)} €`;
  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, position: "absolute", top: 0, left: 0, width: "100%", zIndex: isFront ? 10 : 1, touchAction: "none" }}
      drag={isFront ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) onSwipe("right");
        else if (info.offset.x < -100) onSwipe("left");
      }}
      initial={isFront ? { scale: 1 } : { scale: 0.95 }}
      animate={isFront ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0.7 }}
      exit={{ x: 300, opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* Swipe overlays */}
      {isFront && (
        <>
          <motion.div style={{ opacity: takeOpacity }} className="absolute top-8 right-8 z-50 rotate-12 border-4 border-[#00B85C] text-[#00B85C] rounded-xl px-4 py-2 text-2xl font-bold pointer-events-none">
            JE PRENDS
          </motion.div>
          <motion.div style={{ opacity: passOpacity }} className="absolute top-8 left-8 z-50 -rotate-12 border-4 border-[#E54545] text-[#E54545] rounded-xl px-4 py-2 text-2xl font-bold pointer-events-none">
            PASSE
          </motion.div>
        </>
      )}

      <div className="bg-white rounded-2xl border border-[#D0D5DC] shadow-lg overflow-hidden select-none">
        {/* Hero gradient */}
        <div className="h-28 bg-gradient-to-br from-[#1C58D9] to-[#1549B8] relative flex items-center justify-center">
          {offer.product_image_url ? (
            <img src={offer.product_image_url} alt="" className="h-20 object-contain mix-blend-luminosity opacity-60" />
          ) : (
            <Package size={48} className="text-white/30" />
          )}
          {discount > 0 && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#00B85C] text-white text-xs font-bold">
              -{discount}%
            </span>
          )}
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/30 text-white/90 text-[10px] font-medium flex items-center gap-1">
            <Lock size={10} /> Vendeur anonyme
          </span>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold"
            style={{ backgroundColor: grade.bg, color: grade.color }}
          >
            {grade.label}
          </span>

          <h3 className="font-bold text-[#1E252F] text-base leading-tight">
            {offer.designation || "Produit"}
          </h3>
          <p className="text-xs text-[#8B929C]">
            {offer.ean && `EAN ${offer.ean}`}{offer.ean && offer.cnk && " · "}{offer.cnk && `CNK ${offer.cnk}`}
          </p>

          <div className="flex items-baseline gap-2">
            <span className="text-sm text-[#8B929C] line-through">{formatPrice(cataloguePrice)}</span>
            <span className="text-2xl font-bold text-[#1C58D9]">{formatPrice(offer.price_ht || 0)}</span>
            <span className="text-xs text-[#8B929C]">HT/u</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-[#5C6470]">
            <div className="flex items-center gap-1.5"><Box size={12} className="text-[#8B929C]" /><b>{offer.quantity}</b> unités</div>
            <div className="flex items-center gap-1.5"><Clock size={12} className="text-[#8B929C]" />DLU {formatDate(offer.dlu)}</div>
            <div className="flex items-center gap-1.5"><MapPin size={12} className="text-[#8B929C]" />{offer.seller_city || "Belgique"}</div>
            <div className="flex items-center gap-1.5">
              {offer.delivery_condition === "pickup" ? <MapPin size={12} /> : <Truck size={12} />}
              <span className="text-[#8B929C]">
                {offer.delivery_condition === "pickup" ? "Enlèvement" : offer.delivery_condition === "shipping" ? "Livraison" : "Les deux"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function RestockMobileSwipe() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQty, setCounterQty] = useState("");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["restock-mobile-offers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_offers")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const remaining = offers.slice(currentIdx);
  const currentOffer = remaining[0];
  const allSwiped = currentIdx >= offers.length;

  const onSwipe = useCallback((direction: string) => {
    const offer = offers[currentIdx];
    if (direction === "right" && offer) {
      setCart(prev => [...prev, offer]);
      toast.success("Ajouté au panier !");
    }
    setCurrentIdx(prev => prev + 1);
  }, [currentIdx, offers]);

  const formatPrice = (p: number) => `${p.toFixed(2)} €`;

  const skipCurrent = () => setCurrentIdx(prev => prev + 1);
  const takeCurrent = () => {
    if (currentOffer) {
      setCart(prev => [...prev, currentOffer]);
      toast.success("Ajouté au panier !");
      setCurrentIdx(prev => prev + 1);
    }
  };

  const handleCounter = async () => {
    if (!currentOffer || !counterPrice) return;
    const { data: buyerData } = await supabase.from("restock_buyers").select("id").limit(1).maybeSingle();
    await supabase.from("restock_counter_offers").insert({
      offer_id: currentOffer.id,
      buyer_id: buyerData?.id || "00000000-0000-0000-0000-000000000000",
      proposed_price: parseFloat(counterPrice),
      proposed_quantity: parseInt(counterQty) || currentOffer.quantity,
      status: "pending",
    });
    toast.success("Contre-offre envoyée !");
    setShowCounter(false);
    setCounterPrice("");
    setCounterQty("");
    setCurrentIdx(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <Package className="animate-pulse text-[#1C58D9]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#D0D5DC] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#1C58D9] font-bold text-lg">MediKong</span>
          <span className="text-[#00B85C] font-bold text-sm">ReStock</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/restock/opportunities`)}
            className="text-[10px] text-[#5C6470] border border-[#D0D5DC] px-2 py-1 rounded-full hover:bg-[#F0F1F3]"
          >
            ☰ Grille
          </button>
          <div className="relative">
            <ShoppingCart size={20} className="text-[#5C6470]" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00B85C] text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1 py-3 px-4">
        {offers.slice(0, Math.min(offers.length, 20)).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < currentIdx ? "w-1.5 bg-[#00B85C]" : i === currentIdx ? "w-4 bg-[#1C58D9]" : "w-1.5 bg-[#D0D5DC]"
            }`}
          />
        ))}
        {offers.length > 20 && <span className="text-[10px] text-[#8B929C] ml-1">+{offers.length - 20}</span>}
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-start justify-center px-4 pt-2">
        {allSwiped ? (
          <div className="text-center px-6 pt-20">
            <Package size={48} className="mx-auto mb-4 text-[#1C58D9]" />
            <h2 className="text-xl font-bold text-[#1E252F] mb-2">Vous avez parcouru toutes les offres</h2>
            {cart.length > 0 ? (
              <>
                <p className="text-[#5C6470] mb-4">{cart.length} produit(s) dans votre panier</p>
                <Button className="bg-[#00B85C] hover:bg-[#00A050] text-white rounded-xl w-full py-6 text-base">
                  Finaliser ma commande
                </Button>
              </>
            ) : (
              <p className="text-[#5C6470]">Revenez bientôt pour de nouvelles opportunités</p>
            )}
          </div>
        ) : (
          <div className="relative w-full max-w-sm" style={{ height: 480 }}>
            <AnimatePresence>
              {remaining.slice(0, 3).reverse().map((offer, i) => {
                const isFront = i === (Math.min(remaining.length, 3) - 1);
                return (
                  <SwipeCard
                    key={offer.id}
                    offer={offer}
                    onSwipe={onSwipe}
                    isFront={isFront}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!allSwiped && (
        <div className="flex items-center justify-center gap-6 py-6 px-4">
          <button
            onClick={skipCurrent}
            className="w-14 h-14 rounded-full bg-white border-2 border-[#E54545] flex items-center justify-center shadow-md active:scale-90 transition-transform"
          >
            <X size={28} className="text-[#E54545]" />
          </button>
          <button
            onClick={() => setShowCounter(true)}
            className="w-12 h-12 rounded-full bg-white border-2 border-[#F59E0B] flex items-center justify-center shadow-md active:scale-90 transition-transform"
          >
            <MessageSquare size={22} className="text-[#F59E0B]" />
          </button>
          <button
            onClick={takeCurrent}
            className="w-14 h-14 rounded-full bg-[#00B85C] flex items-center justify-center shadow-md active:scale-90 transition-transform"
          >
            <Heart size={28} className="text-white" />
          </button>
        </div>
      )}

      {/* Counter-offer bottom sheet */}
      {showCounter && currentOffer && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowCounter(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-2xl p-6 space-y-4 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#D0D5DC] rounded-full mx-auto" />
            <h3 className="font-bold text-[#1E252F]">Contre-offre pour {currentOffer.designation}</h3>
            <p className="text-sm text-[#5C6470]">Prix actuel : {formatPrice(currentOffer.price_ht || 0)} HT/unité</p>
            <div>
              <Label className="text-xs">Prix proposé (€ HT/unité)</Label>
              <Input
                type="number"
                step="0.01"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                className="rounded-xl border-[#D0D5DC]"
                placeholder="Ex: 8.50"
              />
            </div>
            <div>
              <Label className="text-xs">Quantité souhaitée</Label>
              <Input
                type="number"
                value={counterQty}
                onChange={(e) => setCounterQty(e.target.value)}
                className="rounded-xl border-[#D0D5DC]"
                placeholder={String(currentOffer.quantity)}
              />
            </div>
            <Button
              onClick={handleCounter}
              disabled={!counterPrice || parseFloat(counterPrice) <= 0}
              className="w-full bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-xl py-5"
            >
              Envoyer la contre-offre
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
