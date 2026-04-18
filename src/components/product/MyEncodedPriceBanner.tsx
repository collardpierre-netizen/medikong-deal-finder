import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tag, TrendingDown, TrendingUp, ShoppingCart, Pencil, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface MyEncodedPriceBannerProps {
  productId: string;
  /** Best MediKong price HTVA (excl. VAT) */
  bestPriceExclVat: number;
  /** Best MediKong price TVAC (incl. VAT) */
  bestPriceInclVat: number;
  /** Whether prices are displayed TVAC or HTVA */
  isTVAC: boolean;
  /** Optional: triggered when user clicks the CTA — should add best offer to cart */
  onAddToCart?: () => void;
  /** Whether an active offer exists to allow ordering */
  canOrder: boolean;
}

export function MyEncodedPriceBanner({
  productId,
  bestPriceExclVat,
  bestPriceInclVat,
  isTVAC,
  onAddToCart,
  canOrder,
}: MyEncodedPriceBannerProps) {
  const { user } = useAuth();

  const { data: userPrice } = useQuery({
    queryKey: ["user-price", user?.id, productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_prices")
        .select("id, my_purchase_price, supplier_name, updated_at")
        .eq("user_id", user!.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!productId,
  });

  if (!user || !userPrice) return null;

  // Compare always HTVA vs HTVA (user prices are stored HTVA)
  const myPrice = Number(userPrice.my_purchase_price) || 0;
  const mkPriceForCompare = bestPriceExclVat;
  const mkPriceForDisplay = isTVAC ? bestPriceInclVat : bestPriceExclVat;

  if (myPrice <= 0 || mkPriceForCompare <= 0) return null;

  const delta = mkPriceForCompare - myPrice; // negative = MediKong is cheaper
  const isMkCheaper = delta < 0;
  const absDelta = Math.abs(delta);
  const pct = myPrice > 0 ? (absDelta / myPrice) * 100 : 0;

  const Icon = isMkCheaper ? TrendingDown : TrendingUp;
  const tone = isMkCheaper
    ? "border-emerald-300 bg-emerald-50/60"
    : "border-amber-300 bg-amber-50/60";
  const iconTone = isMkCheaper ? "text-emerald-700" : "text-amber-700";
  const titleTone = isMkCheaper ? "text-emerald-900" : "text-amber-900";
  const deltaTone = isMkCheaper ? "text-emerald-700" : "text-amber-700";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-2 ${tone} rounded-xl p-4 md:p-5 mb-4`}
    >
      <div className="flex items-start gap-3 mb-3 flex-wrap">
        <div className={`shrink-0 w-9 h-9 rounded-full bg-white border ${tone.split(" ")[0]} flex items-center justify-center`}>
          <Tag size={16} className={iconTone} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm md:text-base font-bold ${titleTone}`}>
            {isMkCheaper
              ? "Vous économisez avec MediKong"
              : "Votre prix actuel est meilleur"}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comparaison basée sur le prix d'achat encodé dans{" "}
            <Link to="/compte/mes-prix" className="underline hover:text-foreground inline-flex items-center gap-1">
              Mes Prix <LinkIcon size={10} />
            </Link>
            {userPrice.supplier_name ? ` · Fournisseur actuel : ${userPrice.supplier_name}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white/70 rounded-lg p-3 border border-border/60">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Mon prix encodé</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{formatEur(myPrice)} €</p>
          <p className="text-[11px] text-muted-foreground">HTVA</p>
        </div>
        <div className="bg-white/70 rounded-lg p-3 border border-border/60">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Meilleur prix MediKong</p>
          <p className="text-lg font-bold text-primary mt-0.5">{formatEur(mkPriceForDisplay)} €</p>
          <p className="text-[11px] text-muted-foreground">{isTVAC ? "TVAC" : "HTVA"}</p>
        </div>
        <div className={`bg-white/70 rounded-lg p-3 border border-border/60 col-span-2 md:col-span-1`}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Delta</p>
          <p className={`text-lg font-bold mt-0.5 inline-flex items-center gap-1 ${deltaTone}`}>
            <Icon size={16} />
            {isMkCheaper ? "−" : "+"}{formatEur(absDelta)} €
          </p>
          <p className={`text-[11px] font-medium ${deltaTone}`}>
            {isMkCheaper ? "−" : "+"}{pct.toFixed(1)}% vs mon prix
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isMkCheaper && canOrder && onAddToCart && (
          <button
            onClick={onAddToCart}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <ShoppingCart size={16} />
            Commander au meilleur prix
          </button>
        )}
        <Link
          to="/compte/mes-prix"
          className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-white rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Pencil size={14} />
          Modifier mon prix
        </Link>
      </div>
    </motion.div>
  );
}
