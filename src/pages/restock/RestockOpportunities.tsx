import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Package, ShoppingCart, MessageSquare, Truck, MapPin, Clock, Box, Shield } from "lucide-react";
import { toast } from "sonner";
import logoHorizontal from "@/assets/logo-medikong.png";

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "dlu3", label: "DLU > 3 mois" },
  { key: "intact", label: "Grade A" },
  { key: "shipping", label: "Livraison dispo" },
];

const gradeConfig: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: "A — Intact", color: "#00B85C", bg: "#EEFBF4" },
  B: { label: "B — Emb. abîmé", color: "#1C58D9", bg: "#EBF0FB" },
  C: { label: "C — DLU courte", color: "#F59E0B", bg: "#FEF3C7" },
  D: { label: "D — DLU courte + abîmé", color: "#E54545", bg: "#FEE2E2" },
};

// Fallback for old product_state values
const stateToGrade: Record<string, string> = {
  intact: "A",
  damaged_packaging: "B",
  near_expiry: "C",
};

const deliveryLabels: Record<string, { label: string; icon: typeof Truck }> = {
  pickup: { label: "Enlèvement", icon: MapPin },
  shipping: { label: "Livraison", icon: Truck },
  both: { label: "Enlèvement / Livraison", icon: Truck },
};

export default function RestockOpportunities() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [counterOfferTarget, setCounterOfferTarget] = useState<any>(null);
  const [counterForm, setCounterForm] = useState({ price: "", quantity: "" });
  const [confirmTarget, setConfirmTarget] = useState<any>(null);
  const [buyQuantity, setBuyQuantity] = useState<number>(0);

  // Auto-redirect to mobile swipe on small screens
  useEffect(() => {
    if (window.innerWidth < 768 && campaignId) {
      navigate(`/m/opportunities/${campaignId}`, { replace: true });
    }
  }, [campaignId, navigate]);

  // Fetch buyer info from token (campaignId used as token)
  const { data: buyer } = useQuery({
    queryKey: ["restock-buyer-token", campaignId],
    queryFn: async () => {
      // For now, try to find buyer by campaign or return null
      if (!campaignId) return null;
      const { data } = await supabase
        .from("restock_buyers")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch published offers
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["restock-public-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_offers")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch rules for shipping fee
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

  // Filter offers
  const filtered = useMemo(() => {
    let list = offers;

    if (activeFilter === "dlu3") {
      const in3Months = new Date();
      in3Months.setMonth(in3Months.getMonth() + 3);
      list = list.filter((o: any) => o.dlu && new Date(o.dlu) > in3Months);
    } else if (activeFilter === "intact") {
      list = list.filter((o: any) => (o.grade || stateToGrade[o.product_state] || "A") === "A");
    } else if (activeFilter === "shipping") {
      list = list.filter((o: any) => o.delivery_condition === "shipping" || o.delivery_condition === "both");
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
  }, [offers, activeFilter, search]);

  const sellerCount = useMemo(() => new Set(offers.map((o: any) => o.seller_id)).size, [offers]);

  // "Je prends" mutation
  const takeMutation = useMutation({
    mutationFn: async ({ offer, qty }: { offer: any; qty: number }) => {
      const isFullTake = qty >= offer.quantity;
      
      if (isFullTake) {
        // Mark as sold
        const { error } = await supabase
          .from("restock_offers")
          .update({ status: "sold" })
          .eq("id", offer.id);
        if (error) throw error;
      } else {
        // Partial: reduce remaining quantity
        const { error } = await supabase
          .from("restock_offers")
          .update({ quantity: offer.quantity - qty })
          .eq("id", offer.id);
        if (error) throw error;
      }

      // Create transaction
      await supabase.from("restock_transactions").insert({
        offer_id: offer.id,
        buyer_id: buyer?.id || null,
        seller_id: offer.seller_id,
        final_price: offer.price_ht,
        quantity: qty,
        delivery_mode: offer.delivery_condition === "pickup" ? "pickup" : "shipping",
        shipping_cost: offer.delivery_condition === "pickup" ? 0 : shippingFee,
        commission_amount: offer.price_ht * qty * 0.05,
        status: "confirmed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-public-offers"] });
      toast.success("Offre confirmée ! Le vendeur sera notifié.");
      setConfirmTarget(null);
      setBuyQuantity(0);
    },
    onError: () => toast.error("Erreur lors de la confirmation"),
  });

  // Counter-offer mutation
  const counterMutation = useMutation({
    mutationFn: async () => {
      if (!counterOfferTarget) return;
      const { error } = await supabase.from("restock_counter_offers").insert({
        offer_id: counterOfferTarget.id,
        buyer_id: buyer?.id || null,
        proposed_price: parseFloat(counterForm.price),
        proposed_quantity: parseInt(counterForm.quantity) || counterOfferTarget.quantity,
        status: "pending",
      });
      if (error) throw error;

      // Update offer status
      await supabase.from("restock_offers").update({ status: "counter_offer" }).eq("id", counterOfferTarget.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-public-offers"] });
      toast.success("Contre-offre envoyée au vendeur !");
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

  // Fake catalogue price for discount display (price_ht * 1.3 as placeholder)
  const getCataloguePrice = (priceHt: number) => priceHt * 1.3;

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#D0D5DC] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoHorizontal} alt="MediKong" className="h-9" />
            <span className="text-[#00B85C] font-bold text-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>ReStock</span>
          </div>
          {buyer && (
            <span className="text-sm text-[#5C6470]">
              {buyer.pharmacy_name}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#1C58D9] to-[#1549B8] rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <Package size={28} strokeWidth={1.5} />
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {offers.length} offre{offers.length !== 1 ? "s" : ""} disponible{offers.length !== 1 ? "s" : ""} de {sellerCount} pharmacie{sellerCount !== 1 ? "s" : ""}
              </h1>
              <p className="text-white/80 text-sm">
                Mise à jour : {new Date().toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === f.key
                  ? "bg-[#1C58D9] text-white"
                  : "bg-white text-[#5C6470] border border-[#D0D5DC] hover:border-[#1C58D9] hover:text-[#1C58D9]"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
            <Input
              placeholder="Rechercher par nom, EAN, CNK…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full border-[#D0D5DC] bg-white"
            />
          </div>
        </div>

        {/* Cards grid */}
        {isLoading ? (
          <div className="text-center py-16 text-[#8B929C]">Chargement des opportunités…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#8B929C]">
            <Package size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">Aucune offre disponible</p>
            <p className="text-sm">Revenez bientôt pour de nouvelles opportunités</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((offer: any) => {
              const cataloguePrice = getCataloguePrice(offer.price_ht || 0);
              const discount = Math.round(((cataloguePrice - (offer.price_ht || 0)) / cataloguePrice) * 100);
              const state = offer.product_state || "intact";
              const sc = stateColors[state] || stateColors.intact;
              const delivery = deliveryLabels[offer.delivery_condition] || deliveryLabels.both;
              const DeliveryIcon = delivery.icon;

              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-xl border border-[#D0D5DC] shadow-[0_1px_3px_rgba(0,0,0,.06)] overflow-hidden flex flex-col"
                >
                  {/* Card body */}
                  <div className="p-5 flex-1 space-y-3">
                    {/* Title + codes */}
                    <div>
                      <h3 className="font-semibold text-[#1E252F] text-base leading-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {offer.designation || "Produit sans nom"}
                      </h3>
                      <p className="text-xs text-[#8B929C] mt-0.5">
                        {offer.ean && `EAN ${offer.ean}`}
                        {offer.ean && offer.cnk && " · "}
                        {offer.cnk && `CNK ${offer.cnk}`}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[#1C58D9]">
                        {formatPrice(offer.price_ht || 0)}
                      </span>
                      <span className="text-sm text-[#8B929C] line-through">
                        {formatPrice(cataloguePrice)}
                      </span>
                      {discount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#EEFBF4] text-[#00B85C] text-xs font-bold">
                          -{discount}%
                        </span>
                      )}
                      <span className="text-xs text-[#8B929C]">HT/unité</span>
                    </div>

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 text-sm text-[#5C6470]">
                        <Box size={14} className="text-[#8B929C]" />
                        <span><b>{offer.quantity}</b> unités</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5C6470]">
                        <Clock size={14} className="text-[#8B929C]" />
                        <span>DLU {formatDate(offer.dlu)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield size={14} style={{ color: sc.text }} />
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{ backgroundColor: sc.bg, color: sc.text }}
                        >
                          {stateLabels[state] || state}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5C6470]">
                        <DeliveryIcon size={14} className="text-[#8B929C]" />
                        <span>{delivery.label}</span>
                      </div>
                    </div>

                    {/* Partial sale info */}
                    {offer.allow_partial && (
                      <div className="flex items-center gap-2 text-xs text-[#1C58D9] bg-[#F0F4FF] rounded-lg px-3 py-1.5">
                        <Package size={12} />
                        <span>Achat partiel possible — min. {offer.moq} unités{offer.lot_size > 1 ? `, par ${offer.lot_size}` : ""}</span>
                      </div>
                    )}

                    {offer.delivery_condition !== "pickup" && (
                      <p className="text-xs text-[#8B929C]">
                        Forfait livraison MediKong : {formatPrice(shippingFee)}
                      </p>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="border-t border-[#D0D5DC] p-4 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-lg gap-2 border-[#D0D5DC] text-[#5C6470] hover:border-[#1C58D9] hover:text-[#1C58D9]"
                      onClick={() => {
                        setCounterOfferTarget(offer);
                        setCounterForm({ price: "", quantity: String(offer.allow_partial ? offer.moq : offer.quantity) });
                      }}
                    >
                      <MessageSquare size={15} /> Contre-offre
                    </Button>
                    <Button
                      className="flex-1 rounded-lg gap-2 bg-[#00B85C] hover:bg-[#00A050] text-white"
                      onClick={() => {
                        setConfirmTarget(offer);
                        setBuyQuantity(offer.allow_partial ? offer.moq : offer.quantity);
                      }}
                    >
                      <ShoppingCart size={15} /> Je prends
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Counter-offer dialog */}
      <Dialog open={!!counterOfferTarget} onOpenChange={(o) => !o && setCounterOfferTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Faire une contre-offre</DialogTitle>
          </DialogHeader>
          {counterOfferTarget && (
            <div className="space-y-4">
              <p className="text-sm text-[#5C6470]">
                <b>{counterOfferTarget.designation}</b> — Prix actuel : {formatPrice(counterOfferTarget.price_ht || 0)} HT
              </p>
              <div>
                <Label>Prix proposé (€ HT/unité) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={counterForm.price}
                  onChange={(e) => setCounterForm((f) => ({ ...f, price: e.target.value }))}
                  className="rounded-lg"
                  placeholder="Ex: 8.50"
                />
              </div>
              <div>
                <Label>Quantité souhaitée</Label>
                <Input
                  type="number"
                  min="1"
                  value={counterForm.quantity}
                  onChange={(e) => setCounterForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="rounded-lg"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterOfferTarget(null)} className="rounded-lg">Annuler</Button>
            <Button
              onClick={() => counterMutation.mutate()}
              disabled={!counterForm.price || parseFloat(counterForm.price) <= 0 || counterMutation.isPending}
              className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg"
            >
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm "Je prends" dialog */}
      <Dialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) { setConfirmTarget(null); setBuyQuantity(0); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'achat</DialogTitle>
          </DialogHeader>
          {confirmTarget && (() => {
            const isPartial = confirmTarget.allow_partial;
            const moq = confirmTarget.moq || 1;
            const lotSz = confirmTarget.lot_size || 1;
            const maxQty = confirmTarget.quantity;
            const isValidQty = buyQuantity >= moq && buyQuantity <= maxQty && (lotSz <= 1 || buyQuantity % lotSz === 0);

            return (
              <div className="space-y-4">
                <p className="text-sm text-[#5C6470]">
                  Vous confirmez vouloir acheter :
                </p>
                <div className="bg-[#F7F8FA] rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-[#1E252F]">{confirmTarget.designation}</p>
                  
                  {isPartial ? (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-[#5C6470]">
                          Quantité (min. {moq}{lotSz > 1 ? `, par multiple de ${lotSz}` : ""}, max. {maxQty})
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 border-[#D0D5DC]"
                            disabled={buyQuantity - lotSz < moq}
                            onClick={() => setBuyQuantity(Math.max(moq, buyQuantity - lotSz))}
                          >−</Button>
                          <Input
                            type="number"
                            min={moq}
                            max={maxQty}
                            step={lotSz}
                            value={buyQuantity}
                            onChange={(e) => setBuyQuantity(Math.min(maxQty, Math.max(moq, Number(e.target.value) || moq)))}
                            className="w-24 text-center border-[#D0D5DC]"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 p-0 border-[#D0D5DC]"
                            disabled={buyQuantity + lotSz > maxQty}
                            onClick={() => setBuyQuantity(Math.min(maxQty, buyQuantity + lotSz))}
                          >+</Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-[#1C58D9]"
                            onClick={() => setBuyQuantity(maxQty)}
                          >Tout prendre</Button>
                        </div>
                        {!isValidQty && buyQuantity > 0 && (
                          <p className="text-xs text-[#E54545] mt-1">
                            {buyQuantity < moq ? `Minimum ${moq} unités` : 
                             lotSz > 1 && buyQuantity % lotSz !== 0 ? `Doit être un multiple de ${lotSz}` :
                             `Maximum ${maxQty} unités`}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-[#5C6470]">{buyQuantity} unités × {formatPrice(confirmTarget.price_ht || 0)} HT</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#5C6470]">{maxQty} unités × {formatPrice(confirmTarget.price_ht || 0)} HT</p>
                  )}
                  
                  <p className="text-sm font-bold text-[#1C58D9]">
                    Total : {formatPrice((confirmTarget.price_ht || 0) * buyQuantity)} HT
                  </p>
                </div>
                <p className="text-xs text-[#8B929C]">
                  Le vendeur sera notifié et vous recevrez les instructions de retrait/livraison.
                </p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmTarget(null); setBuyQuantity(0); }} className="rounded-lg">Annuler</Button>
            <Button
              onClick={() => takeMutation.mutate({ offer: confirmTarget, qty: buyQuantity })}
              disabled={takeMutation.isPending || !confirmTarget || buyQuantity < (confirmTarget?.moq || 1) || (confirmTarget?.lot_size > 1 && buyQuantity % confirmTarget.lot_size !== 0)}
              className="bg-[#00B85C] hover:bg-[#00A050] text-white rounded-lg"
            >
              Confirmer l'achat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
