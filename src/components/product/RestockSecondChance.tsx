import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Clock, MapPin, ArrowRight, RefreshCw, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const GRADE_CONFIG: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  A: { label: "A — Neuf", desc: "Emballage intact, DLU longue", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  B: { label: "B — Bon état", desc: "Emballage légèrement abîmé", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  C: { label: "C — Abîmé", desc: "Emballage visiblement abîmé", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  D: { label: "D — DLU courte", desc: "Date limite d'utilisation proche", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function formatEur(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function pushGtm(event: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...payload });
}

interface Props {
  ean?: string;
  cnk?: string;
  productName: string;
  productId?: string;
  /** Prix HTVA de référence MediKong neuf (meilleure offre) pour calculer l'économie */
  newPriceHtva?: number;
  /** Le bloc n'est rendu que pour les acheteurs vérifiés */
  isVerifiedBuyer?: boolean;
}

export function RestockSecondChance({ ean, cnk, productName, productId, newPriceHtva, isVerifiedBuyer }: Props) {
  const { data: restockOffers = [] } = useQuery({
    queryKey: ["restock-second-chance", ean, cnk],
    queryFn: async () => {
      let query = supabase
        .from("restock_offers" as any)
        .select("id, designation, quantity, price_ht, dlu, grade, seller_city, product_image_url, status, moq, lot_size, allow_partial")
        .eq("status", "published")
        .order("price_ht", { ascending: true })
        .limit(5);

      if (ean && ean.length > 0) {
        query = query.eq("ean", ean);
      } else if (cnk && cnk.length > 0) {
        query = query.eq("cnk", cnk);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) return [];
      return (data || []) as any[];
    },
    enabled: !!(ean || cnk) && !!isVerifiedBuyer,
    staleTime: 5 * 60 * 1000,
  });

  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    if (!isVerifiedBuyer) return;
    if (restockOffers.length === 0) return;
    viewedRef.current = true;
    const cheapest = restockOffers[0];
    const deltaVal = newPriceHtva && cheapest ? newPriceHtva - Number(cheapest.price_ht) : null;
    const deltaPct = newPriceHtva && cheapest && newPriceHtva > 0 ? ((newPriceHtva - Number(cheapest.price_ht)) / newPriceHtva) * 100 : null;
    pushGtm("restock_cross_sell_viewed", {
      product_id: productId,
      product_name: productName,
      offers_count: restockOffers.length,
      cheapest_offer_id: cheapest?.id,
      cheapest_price_htva: cheapest?.price_ht,
      new_price_htva: newPriceHtva ?? null,
      economy_value_htva: deltaVal,
      economy_pct: deltaPct,
    });
  }, [restockOffers, isVerifiedBuyer, newPriceHtva, productId, productName]);

  if (!isVerifiedBuyer) return null;
  if (restockOffers.length === 0) return null;

  const handleOfferClick = (offerId: string, priceHt: number) => {
    const deltaVal = newPriceHtva ? newPriceHtva - priceHt : null;
    const deltaPct = newPriceHtva && newPriceHtva > 0 ? ((newPriceHtva - priceHt) / newPriceHtva) * 100 : null;
    pushGtm("restock_cross_sell_clicked", {
      product_id: productId,
      product_name: productName,
      offer_id: offerId,
      offer_price_htva: priceHt,
      new_price_htva: newPriceHtva ?? null,
      economy_value_htva: deltaVal,
      economy_pct: deltaPct,
    });
  };

  return (
    <div className="mb-8">
      <div className="border border-amber-200 bg-gradient-to-r from-amber-50/50 to-orange-50/30 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-amber-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <RefreshCw size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Deuxième Chance</h3>
              <p className="text-[11px] text-muted-foreground">Offres de déstockage pour ce produit</p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[10px]">
            ReStock
          </Badge>
        </div>

        {/* Offers */}
        <div className="divide-y divide-amber-100">
          {restockOffers.map((offer: any) => {
            const grade = GRADE_CONFIG[offer.grade] || GRADE_CONFIG.B;
            const dlu = offer.dlu ? daysUntil(offer.dlu) : null;
            const priceHt = Number(offer.price_ht) || 0;
            const hasDelta = !!newPriceHtva && newPriceHtva > priceHt;
            const deltaVal = hasDelta ? newPriceHtva! - priceHt : 0;
            const deltaPct = hasDelta ? (deltaVal / newPriceHtva!) * 100 : 0;

            return (
              <div key={offer.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-amber-50/50 transition-colors">
                {/* Grade badge */}
                <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold ${grade.bg} ${grade.color}`}>
                  {offer.grade || "B"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {formatEur(priceHt)} € <span className="text-[10px] font-normal text-muted-foreground">HTVA</span>
                    </span>
                    <span className="text-xs text-muted-foreground">×{offer.quantity} unités</span>
                    {offer.allow_partial && offer.moq && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        min. {offer.moq}
                      </span>
                    )}
                    {hasDelta && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                        <TrendingDown size={10} />
                        −{deltaPct.toFixed(0)}% · −{formatEur(deltaVal)} €
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    {dlu !== null && (
                      <span className={`inline-flex items-center gap-1 ${dlu < 90 ? "text-red-600" : dlu < 180 ? "text-amber-600" : "text-muted-foreground"}`}>
                        <Clock size={10} /> DLU {dlu}j
                      </span>
                    )}
                    {offer.seller_city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={10} /> {offer.seller_city}
                      </span>
                    )}
                    <span className={`${grade.color} font-medium`} title={grade.desc}>{grade.label}</span>
                  </div>
                </div>

                {/* CTA — deep-link sur l'offre */}
                <Link
                  to={`/restock/opportunities?offer=${offer.id}`}
                  onClick={() => handleOfferClick(offer.id, priceHt)}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                >
                  Voir <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-amber-50/40 border-t border-amber-200/60">
          <Link
            to="/restock/opportunities"
            className="text-xs font-medium text-amber-700 hover:text-amber-800 inline-flex items-center gap-1.5 transition-colors"
          >
            Voir toutes les offres ReStock <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
