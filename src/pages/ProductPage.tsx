import { Layout } from "@/components/layout/Layout";
import { useProduct, useProductOffers, type Offer } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Copy, Sliders, ShoppingCart, Shield, Check, Truck, Minus, Plus,
  Heart, Tag, Package, ChevronRight, Home, Star, Info, Award, Globe, BarChart3, Calculator, TrendingDown
} from "lucide-react";
import { useFavorites, useRecentActivity } from "@/hooks/useFavorites";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountry } from "@/contexts/CountryContext";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Helmet } from "react-helmet-async";

function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Offer Row ─────────────────────────────────────────── */
function OfferRow({
  offer, productId, productName, productSlug, user, navigate, addToCart, isBest, delay = 0, isTVAC = false,
}: {
  offer: Offer; productId: string; productName: string; productSlug: string;
  user: any; navigate: any; addToCart: any; isBest?: boolean; delay?: number; isTVAC?: boolean;
}) {
  const [qty, setQty] = useState(offer.bundleSize > 1 ? offer.bundleSize : 1);
  const tiers = (offer.priceTiers && offer.priceTiers.length > 0) ? offer.priceTiers : [];
  const hasTiers = tiers.length > 1;
  const displayCode = offer.displayCode || offer.sellerId.slice(0, 6).toUpperCase();
  const displayPrice = isTVAC ? offer.unitPriceInclVat : offer.unitPriceEur;
  const priceLabel = isTVAC ? "TVAC" : "HTVA";

  const handleAdd = () => {
    if (!user) { navigate("/connexion"); return; }
    addToCart.mutate({
      offerId: offer.id,
      productId,
      quantity: qty,
      vendorId: offer.sellerId,
      priceExclVat: offer.unitPriceEur,
      productData: { id: productId, name: productName, brand: "", slug: productSlug, price: offer.unitPriceEur },
    });
  };

  return (
    <motion.div
      className="border-b border-border last:border-b-0 py-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {/* Status badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {offer.stockQuantity > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <Package size={12} /> En stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            Rupture
          </span>
        )}
        {offer.isVerified && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            <Check size={12} /> Fournisseur verifie
          </span>
        )}
      </div>

      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.5fr] gap-3 items-start">
        <span className="font-bold text-sm text-foreground">{displayCode}</span>

        {/* Price tiers */}
        <div>
          {hasTiers ? (
            <div className="relative pl-4">
              <div className="absolute left-[3px] top-[7px] w-px border-l border-dashed border-muted-foreground/40" style={{ height: `calc(100% - 14px)` }} />
              {tiers.map((tier: any, i: number) => (
                <div key={i} className="flex items-center gap-2 relative" style={{ marginTop: i > 0 ? 6 : 0 }}>
                  <div className="absolute left-[-14px] w-[7px] h-[7px] rounded-full bg-primary" />
                  <span className={`text-sm ${i === 0 ? "font-bold text-green-700" : "text-muted-foreground"}`}>
                    {formatEur(tier.price || tier.minAmount)} €
                  </span>
                  {tier.minAmount && (
                    <span className="text-xs text-muted-foreground">MOV {formatEur(tier.minAmount)} €</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm font-bold text-green-700">{formatEur(displayPrice)} € <span className="text-[10px] font-normal text-muted-foreground">{priceLabel}</span></span>
          )}
        </div>

        <span className="text-sm text-foreground">{offer.movEur > 0 ? `${formatEur(offer.movEur)} €` : "—"}</span>
        <span className="text-sm text-foreground">{offer.stockQuantity.toLocaleString("fr-FR")}</span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center border border-border rounded-md">
            <button onClick={() => setQty(Math.max(1, qty - (offer.bundleSize > 1 ? offer.bundleSize : 1)))} className="px-2.5 py-2 text-muted-foreground hover:text-foreground"><Minus size={14} /></button>
            <span className="px-3 py-2 text-sm font-medium min-w-[40px] text-center">{qty}</span>
            <button onClick={() => setQty(qty + (offer.bundleSize > 1 ? offer.bundleSize : 1))} className="px-2.5 py-2 text-muted-foreground hover:text-foreground"><Plus size={14} /></button>
          </div>
          <motion.button className="bg-primary text-primary-foreground p-2.5 rounded-md" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAdd}>
            <ShoppingCart size={16} />
          </motion.button>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">{displayCode}</span>
          <span className="text-base font-bold text-green-700">{formatEur(displayPrice)} € <span className="text-[10px] font-normal text-muted-foreground">{priceLabel}</span></span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {offer.movEur > 0 && <span>MOV {formatEur(offer.movEur)} €</span>}
          <span>Stock {offer.stockQuantity.toLocaleString("fr-FR")}</span>
          <span>Livraison ~{offer.deliveryDays}j</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md flex-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2.5 py-2 text-muted-foreground"><Minus size={14} /></button>
            <span className="px-3 py-2 text-sm font-medium text-center flex-1">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="px-2.5 py-2 text-muted-foreground"><Plus size={14} /></button>
          </div>
          <motion.button className="bg-primary text-primary-foreground px-4 py-2.5 rounded-md text-sm font-medium flex items-center gap-2" whileTap={{ scale: 0.95 }} onClick={handleAdd}>
            <ShoppingCart size={14} /> Ajouter
          </motion.button>
        </div>
      </div>

      {/* Delivery estimate */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <Truck size={13} />
        <span>Livraison estimee : {offer.deliveryDays <= 7 ? `${offer.deliveryDays} jours` : `${Math.ceil(offer.deliveryDays / 7)} semaines`}</span>
      </div>
    </motion.div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */
export default function ProductPage() {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [movFilter, setMovFilter] = useState<number | null>(null);
  const [delayFilter, setDelayFilter] = useState<number | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [stickyQty, setStickyQty] = useState(1);
  const offerSectionRef = useRef<HTMLDivElement>(null);

  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { country } = useCountry();
  const { isTVAC } = usePriceDisplay();
  const { data: product, isLoading } = useProduct(slug);
  const { addToCart } = useCart();
  const { data: realOffers = [] } = useProductOffers(product?.id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { trackActivity } = useRecentActivity();

  // Fetch brand
  const { data: brandData } = useQuery({
    queryKey: ["brand-detail", product?.brandId],
    queryFn: async () => {
      if (!product?.brandId) return null;
      const { data } = await supabase.from("brands").select("id, name, slug").eq("id", product.brandId).single();
      return data;
    },
    enabled: !!product?.brandId,
  });

  // Fetch category tree for breadcrumb
  const { data: categoryData } = useQuery({
    queryKey: ["product-category", product?.id],
    queryFn: async () => {
      const { data: prod } = await supabase.from("products").select("category_id, category_name").eq("id", product!.id).single();
      if (!prod?.category_id) return null;
      const { data: cat } = await supabase.from("categories").select("id, name, slug, parent_id").eq("id", prod.category_id).single();
      if (!cat) return null;
      let parent = null;
      if (cat.parent_id) {
        const { data: p } = await supabase.from("categories").select("id, name, slug").eq("id", cat.parent_id).single();
        parent = p;
      }
      return { category: cat, parent };
    },
    enabled: !!product?.id,
  });

  // Similar products
  const { data: similarProducts = [] } = useQuery({
    queryKey: ["similar-products", product?.id],
    queryFn: async () => {
      const filters: string[] = [];
      if (product!.brandId) filters.push(`brand_id.eq.${product!.brandId}`);
      const catId = categoryData?.category?.id;
      if (catId) filters.push(`category_id.eq.${catId}`);
      const orFilter = filters.length > 0 ? filters.join(",") : "id.neq.impossible";
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, best_price_excl_vat, image_urls, brand_name")
        .or(orFilter)
        .neq("id", product!.id)
        .eq("is_active", true)
        .gt("best_price_excl_vat", 0)
        .limit(12);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Product details from DB
  const { data: productDetails } = useQuery({
    queryKey: ["product-details-full", product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, brands(name, slug), categories(name, slug), manufacturers:manufacturer_id(name)")
        .eq("id", product!.id)
        .single();
      return data;
    },
    enabled: !!product?.id,
  });

  // Track view
  useEffect(() => {
    if (product?.id && user) {
      trackActivity.mutate({ activityType: "view_product", productId: product.id });
    }
  }, [product?.id, user?.id]);

  // Sticky bar observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    if (offerSectionRef.current) observer.observe(offerSectionRef.current);
    return () => observer.disconnect();
  }, [product]);

  const handleCopy = () => {
    if (!product) return;
    navigator.clipboard.writeText(product.ean || product.gtin);
    setCopied(true);
    toast.success("GTIN copie !");
    setTimeout(() => setCopied(false), 1500);
  };

  // Filter offers
  const filteredOffers = realOffers.filter((o) => {
    if (movFilter && o.movEur > movFilter) return false;
    if (delayFilter && o.deliveryDays > delayFilter) return false;
    return true;
  });

  const bestOffer = filteredOffers[0];
  const otherOffers = filteredOffers.slice(1);
  const totalStock = filteredOffers.reduce((s, o) => s + o.stockQuantity, 0);

  // Price history query (must be before early returns)
  const { data: priceHistoryData = [] } = useQuery({
    queryKey: ["price-history", product?.id, country],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_history")
        .select("price_excl_vat, price_incl_vat, recorded_at")
        .eq("product_id", product!.id)
        .eq("country_code", country)
        .order("recorded_at", { ascending: true })
        .limit(180);
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Margin calculator state (must be before early returns)
  const [userPrice, setUserPrice] = useState<string>("");

  if (isLoading) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center text-muted-foreground">Chargement du produit...</div>
      </Layout>
    );
  }
  if (!product) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center text-muted-foreground">Produit introuvable</div>
      </Layout>
    );
  }

  // Build images from real data only — no fallbacks
  const productImageUrls = product.imageUrls?.filter((u: string) => u && u.startsWith("http")) || [];
  const images: string[] = productImageUrls.length > 0
    ? productImageUrls
    : (product.imageUrl && product.imageUrl.startsWith("http")) ? [product.imageUrl] : [];
  const hasImages = images.length > 0;
  const description = productDetails?.description || (productDetails as any)?.label || product.descriptionShort || "";

  const clientPrice = bestOffer ? (isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur) : 0;
  const userPriceNum = parseFloat(userPrice.replace(",", ".")) || 0;
  const savingsAbs = userPriceNum > 0 ? userPriceNum - clientPrice : 0;
  const savingsPct = userPriceNum > 0 ? ((savingsAbs / userPriceNum) * 100) : 0;

  // Specs table — only show rows with real data
  const specsRaw: [string, string | undefined | null][] = [
    ["Marque", brandData?.name || product.brand],
    ["Fabricant", productDetails?.manufacturers ? (productDetails.manufacturers as any)?.name : undefined],
    ["Categorie", categoryData?.category?.name || productDetails?.category_name],
    ["GTIN/EAN", product.gtin || product.ean],
    ["CNK", product.cnk],
    ["SKU", productDetails?.sku],
    ["Conditionnement", productDetails?.unit_quantity && productDetails.unit_quantity > 1 ? `${productDetails.unit_quantity} unites` : undefined],
    ["Dimensions", productDetails?.dimensions ? JSON.stringify(productDetails.dimensions) : undefined],
    ["Pays d'origine", productDetails?.origin_country],
  ];
  const specs = specsRaw.filter(([, val]) => val && val !== "—" && val !== "null") as [string, string][];

  return (
    <Layout>
      <Helmet>
        <title>{product.name} | MediKong</title>
        <meta name="description" content={`Achetez ${product.name} au meilleur prix B2B sur MediKong. GTIN: ${product.gtin || product.ean}`} />
      </Helmet>

      <PageTransition>
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mk-container py-3">
          <ol className="flex items-center gap-1.5 text-xs flex-wrap text-muted-foreground">
            <li className="inline-flex items-center">
              <Link to="/" className="inline-flex items-center gap-1 hover:text-primary transition-colors"><Home size={13} /> Accueil</Link>
            </li>
            {categoryData?.parent && (
              <li className="inline-flex items-center gap-1.5">
                <ChevronRight size={12} />
                <Link to={`/catalogue?category=${categoryData.parent.slug}`} className="hover:text-primary transition-colors">{categoryData.parent.name}</Link>
              </li>
            )}
            {categoryData?.category && (
              <li className="inline-flex items-center gap-1.5">
                <ChevronRight size={12} />
                <Link to={`/catalogue?category=${categoryData.category.slug}`} className="hover:text-primary transition-colors">{categoryData.category.name}</Link>
              </li>
            )}
            <li className="inline-flex items-center gap-1.5">
              <ChevronRight size={12} />
              <span className="font-semibold text-foreground truncate max-w-[200px]">{product.name}</span>
            </li>
          </ol>
        </nav>

        <div className="mk-container pb-24 md:pb-12">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">

            {/* ═══ LEFT COLUMN — Gallery ═══ */}
            <motion.div
              className="w-full md:w-1/2 md:sticky md:top-20 self-start"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex gap-3">
                {/* Thumbnail column */}
                {images.length > 1 && (
                  <div className="hidden md:flex flex-col gap-2 w-[60px] shrink-0">
                    {images.slice(0, 6).map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImageIdx(i)}
                        className={`w-[60px] h-[60px] border-2 rounded-lg overflow-hidden transition-all ${i === selectedImageIdx ? "border-primary shadow-sm" : "border-border hover:border-primary/50"}`}
                      >
                        <img src={img} alt={`Vue ${i + 1}`} className="w-full h-full object-contain bg-muted" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Main image */}
                <div className="flex-1">
                  <div className="aspect-square rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                    {hasImages ? (
                      <img
                        src={images[selectedImageIdx] || images[0]}
                        alt={product.name}
                        className="w-full h-full object-contain p-4"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.style.display = 'none';
                          target.parentElement?.classList.add('no-image-fallback');
                        }}
                      />
                    ) : (
                      <Package size={48} className="text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Mobile thumbnails */}
                  {hasImages && images.length > 1 && (
                    <div className="flex md:hidden gap-2 mt-3 overflow-x-auto">
                      {images.slice(0, 6).map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImageIdx(i)}
                          className={`w-[48px] h-[48px] shrink-0 border-2 rounded-md overflow-hidden ${i === selectedImageIdx ? "border-primary" : "border-border"}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain bg-muted" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Image disclaimer */}
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <Info size={12} />
                Les photos sont a titre indicatif. Fiez-vous au GTIN.
              </p>

              {/* Favorite button */}
              {user && (
                <button
                  onClick={() => toggleFavorite.mutate(product.id)}
                  className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Heart size={16} className={isFavorite(product.id) ? "text-red-500 fill-current" : ""} />
                  {isFavorite(product.id) ? "Dans mes favoris" : "Ajouter a ma liste de suivi"}
                </button>
              )}
            </motion.div>

            {/* ═══ RIGHT COLUMN — Product info + Offers ═══ */}
            <motion.div
              className="w-full md:w-1/2 min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Brand */}
              {brandData ? (
                <Link to={`/marque/${brandData.slug}`} className="text-sm font-semibold text-primary hover:underline mb-1 inline-flex items-center gap-1">
                  <Tag size={13} /> {brandData.name}
                </Link>
              ) : product.brand ? (
                <p className="text-sm font-semibold text-muted-foreground mb-1">{product.brand}</p>
              ) : null}

              {/* Name */}
              <h1 className="text-xl md:text-2xl font-bold text-foreground mb-3 leading-tight">{product.name}</h1>

              {/* GTIN + Copy */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-xs text-muted-foreground">GTIN : {product.gtin || product.ean}</span>
                <button onClick={handleCopy} className="text-primary text-xs flex items-center gap-1 hover:underline">
                  <Copy size={12} /> {copied ? "Copie !" : "Copier"}
                </button>
              </div>

              {/* Tax note */}
              <p className="text-xs text-muted-foreground mb-4">Prix soumis a TVA selon votre pays.</p>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
                  <Truck size={13} /> Livraison gratuite
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                  <Shield size={13} /> Authenticite 100% garantie
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200">
                  <Check size={13} /> Fournisseur verifie
                </span>
              </div>

              <div className="border-t border-border mb-6" />

              {/* ── Offers Tabs ── */}
              <div ref={offerSectionRef}>
                <Tabs defaultValue="marketplace" className="mb-6">
                  <TabsList className="w-full grid grid-cols-3 mb-4">
                    <TabsTrigger value="marketplace" className="text-xs sm:text-sm gap-1.5">
                      <ShoppingCart size={14} className="hidden sm:inline" /> Marketplace MediKong <span className="ml-1 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{filteredOffers.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="external" className="text-xs sm:text-sm gap-1.5">
                      <Globe size={14} className="hidden sm:inline" /> Offres externes <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">0</span>
                    </TabsTrigger>
                    <TabsTrigger value="market" className="text-xs sm:text-sm gap-1.5">
                      <BarChart3 size={14} className="hidden sm:inline" /> Prix du marche <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">0</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Tab: Marketplace MediKong ── */}
                  <TabsContent value="marketplace">
                    {/* Filters */}
                    <div className="bg-muted/50 border border-border rounded-xl p-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders size={14} className="text-foreground" />
                        <span className="text-sm font-bold text-foreground">Filtrer les offres</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">MOV maximum</label>
                          <select
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                            value={movFilter || ""}
                            onChange={(e) => setMovFilter(e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Tous</option>
                            <option value="250">250 €</option>
                            <option value="500">500 €</option>
                            <option value="1000">1 000 €</option>
                            <option value="2500">2 500 €</option>
                            <option value="5000">5 000 €</option>
                            <option value="10000">10 000 €</option>
                          </select>
                          <p className="text-[11px] text-muted-foreground mt-1">Afficher uniquement les offres avec un MOV jusqu'a ce montant</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Delai de livraison max</label>
                          <select
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                            value={delayFilter || ""}
                            onChange={(e) => setDelayFilter(e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Tous</option>
                            <option value="7">1 semaine</option>
                            <option value="14">2 semaines</option>
                            <option value="21">3 semaines</option>
                            <option value="30">1 mois</option>
                          </select>
                          <p className="text-[11px] text-muted-foreground mt-1">Afficher uniquement les offres livrees dans ce delai</p>
                        </div>
                      </div>
                    </div>

                    {/* Best Offer */}
                    {bestOffer ? (
                      <div className="border-2 border-primary/20 bg-primary/[0.02] rounded-xl p-4 md:p-6 mb-4">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Award size={18} className="text-primary" />
                            <h3 className="text-base md:text-lg font-bold text-foreground">Meilleure offre</h3>
                          </div>
                          <span className="text-sm text-primary font-medium">{totalStock.toLocaleString("fr-FR")} disponibles</span>
                        </div>

                        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.5fr] gap-3 px-1 pb-3 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span>Fournisseur</span>
                          <span>Prix unitaire</span>
                          <span>MOV</span>
                          <span>Stock</span>
                          <span className="text-right">Commander</span>
                        </div>

                        <OfferRow
                          offer={bestOffer}
                          productId={product.id}
                          productName={product.name}
                          productSlug={product.slug}
                          user={user}
                          navigate={navigate}
                          addToCart={addToCart}
                          isBest
                          isTVAC={isTVAC}
                        />
                      </div>
                    ) : (
                      <div className="border border-border rounded-xl p-6 text-center text-muted-foreground mb-4">
                        <Package size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Aucune offre disponible pour ce produit dans votre pays.</p>
                      </div>
                    )}

                    {/* Other Offers */}
                    {otherOffers.length > 0 && (
                      <div className="border border-border rounded-xl p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">
                              {otherOffers.length} autre{otherOffers.length > 1 ? "s" : ""} offre{otherOffers.length > 1 ? "s" : ""}
                            </h3>
                            <span className="text-xs text-muted-foreground">Trie par prix</span>
                          </div>
                          <span className="text-sm text-primary font-medium">
                            {otherOffers.reduce((s, o) => s + o.stockQuantity, 0).toLocaleString("fr-FR")} disponibles
                          </span>
                        </div>

                        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.5fr] gap-3 px-1 pb-3 text-xs font-semibold text-muted-foreground border-b border-border">
                          <span>Fournisseur</span>
                          <span>Prix unitaire</span>
                          <span>MOV</span>
                          <span>Stock</span>
                          <span className="text-right">Actions</span>
                        </div>

                        {otherOffers.map((offer, i) => (
                          <OfferRow
                            key={offer.id}
                            offer={offer}
                            productId={product.id}
                            productName={product.name}
                            productSlug={product.slug}
                            user={user}
                            navigate={navigate}
                            addToCart={addToCart}
                            delay={i * 0.06}
                            isTVAC={isTVAC}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Tab: Offres externes ── */}
                  <TabsContent value="external">
                    <div className="border border-border rounded-xl p-8 text-center">
                      <Globe size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                      <h3 className="text-base font-bold text-foreground mb-2">Offres externes</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                        Aucune offre externe disponible pour le moment. Vous etes fournisseur ? Proposez votre prix.
                      </p>
                      <Link to="/devenir-vendeur" className="inline-block bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                        Devenir fournisseur
                      </Link>
                    </div>
                  </TabsContent>

                  {/* ── Tab: Prix du marché ── */}
                  <TabsContent value="market">
                    <div className="border border-border rounded-xl p-8 text-center">
                      <BarChart3 size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                      <h3 className="text-base font-bold text-foreground mb-2">Prix du marche</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Veille de prix en cours de configuration. Les comparaisons de prix avec les principaux distributeurs seront bientot disponibles.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Description ── */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-foreground mb-3">Description du produit</h2>
                {description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Description non disponible pour ce produit.</p>
                )}
              </div>

              {/* ── Product Details ── */}
              <div className="mb-8">
                <h2 className="text-lg font-bold text-foreground mb-3">Details du produit</h2>
                <div className="border border-border rounded-xl overflow-hidden">
                  {specs.map(([key, val], i) => (
                    <div key={key} className={`flex justify-between py-3 px-4 text-sm ${i % 2 === 0 ? "bg-muted/50" : ""}`}>
                      <span className="text-muted-foreground">{key}</span>
                      <span className="text-foreground font-medium text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Guarantee Accordion ── */}
              <div className="mb-8">
                <Accordion type="single" collapsible>
                  <AccordionItem value="guarantee" className="border border-border rounded-xl px-4">
                    <AccordionTrigger className="text-sm font-bold text-foreground hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-primary" />
                        Garantie satisfaction et remboursement
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
                      <p>Tous les produits vendus sur MediKong sont couverts par notre garantie satisfaction :</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Produits 100% authentiques et conformes</li>
                        <li>Remboursement integral si le produit ne correspond pas a la description</li>
                        <li>Retour gratuit sous 14 jours pour tout defaut de conformite</li>
                        <li>Service client disponible pour toute reclamation</li>
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* ── Margin Calculator ── */}
              <div className="mb-8">
                <div className="border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator size={18} className="text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Calculateur de marge</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Votre prix d'achat actuel ({isTVAC ? "TVAC" : "HTVA"})</label>
                      <div className="flex items-center border border-border rounded-lg overflow-hidden">
                        <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">€</span>
                        <input
                          type="text"
                          value={userPrice}
                          onChange={(e) => setUserPrice(e.target.value)}
                          placeholder={clientPrice > 0 ? formatEur(clientPrice * 1.3) : "0,00"}
                          className="flex-1 px-3 py-2.5 text-sm bg-background outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prix MediKong ({isTVAC ? "TVAC" : "HTVA"})</label>
                      <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted">
                        <span className="px-3 py-2.5 bg-muted text-sm text-muted-foreground">€</span>
                        <span className="flex-1 px-3 py-2.5 text-sm font-bold text-green-700">{formatEur(clientPrice)}</span>
                      </div>
                    </div>
                  </div>
                  {userPriceNum > 0 && savingsAbs > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3"
                    >
                      <TrendingDown size={20} className="text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-green-700">
                          Economie estimee : {formatEur(savingsAbs)} € ({savingsPct.toFixed(1)}%)
                        </p>
                        <p className="text-xs text-green-600">par unite en passant par MediKong</p>
                      </div>
                    </motion.div>
                  )}
                  {userPriceNum > 0 && savingsAbs <= 0 && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                      Votre prix actuel est deja competitif ! MediKong vous offre neanmoins la garantie d'authenticite et la simplification logistique.
                    </div>
                  )}
                </div>
              </div>

              {/* ── Price History ── */}
              <div className="mb-8">
                <div className="border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Historique des prix</h2>
                  </div>
                  {priceHistoryData.length > 0 ? (
                    <div className="space-y-3">
                      {(() => {
                        const prices = priceHistoryData.map((h: any) => isTVAC ? Number(h.price_incl_vat || h.price_excl_vat * 1.21) : Number(h.price_excl_vat));
                        const min = Math.min(...prices);
                        const max = Math.max(...prices);
                        const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
                        const sorted = [...prices].sort((a, b) => a - b);
                        const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[["Min", min], ["Max", max], ["Median", median], ["Moyen", avg]].map(([label, value]) => (
                              <div key={label as string} className="bg-muted/50 rounded-lg p-3 text-center">
                                <p className="text-[11px] text-muted-foreground">{label as string}</p>
                                <p className="text-sm font-bold text-foreground">{formatEur(value as number)} €</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {/* Simple bar chart */}
                      <div className="flex items-end gap-1 h-24 mt-2">
                        {priceHistoryData.slice(-30).map((h: any, i: number) => {
                          const price = isTVAC ? Number(h.price_incl_vat || h.price_excl_vat * 1.21) : Number(h.price_excl_vat);
                          const allPrices = priceHistoryData.map((p: any) => Number(p.price_excl_vat));
                          const maxP = Math.max(...allPrices);
                          const minP = Math.min(...allPrices);
                          const range = maxP - minP || 1;
                          const heightPct = ((price - minP) / range) * 80 + 20;
                          return (
                            <div key={i} className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors" style={{ height: `${heightPct}%` }} title={`${formatEur(price)} € - ${new Date(h.recorded_at).toLocaleDateString("fr-FR")}`} />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <BarChart3 size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">
                        Historique des prix en cours de collecte. Disponible apres quelques synchronisations.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center mb-8">
                <h3 className="font-bold text-foreground mb-1">Vous proposez un meilleur prix ?</h3>
                <p className="text-sm text-muted-foreground mb-4">Vendez via MediKong et touchez 500+ pharmacies</p>
                <Link to="/inscription" className="inline-block bg-primary text-primary-foreground font-bold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                  Devenir vendeur
                </Link>
              </div>
            </motion.div>
          </div>

          {/* ── Similar Products ── */}
          {similarProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-lg font-bold text-foreground mb-4">Produits similaires</h2>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {similarProducts.map((p: any, i: number) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    whileHover={{ y: -4, boxShadow: "0 6px 20px -6px rgba(0,0,0,0.1)" }}
                  >
                    <Link to={`/produit/${p.slug}`} className="w-40 shrink-0 border border-border rounded-xl p-3 block bg-card hover:border-primary/30 transition-colors">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                        {p.image_urls?.[0] ? (
                          <img src={p.image_urls[0]} alt={p.name} className="w-full h-full object-contain p-2" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-muted-foreground/40" /></div>
                        )}
                      </div>
                      <p className="text-xs text-foreground truncate font-medium">{p.name}</p>
                      {p.brand_name && <p className="text-[11px] text-muted-foreground truncate">{p.brand_name}</p>}
                      {p.best_price_excl_vat > 0 && (
                        <p className="text-sm font-bold text-green-700 mt-1">{formatEur(Number(p.best_price_excl_vat))} €</p>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageTransition>

      {/* ── Sticky Bottom Bar ── */}
      <AnimatePresence>
        {showStickyBar && bestOffer && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg"
          >
            <div className="mk-container py-2.5 sm:py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{brandData?.name || product.brand || ""} · Meilleure offre</p>
                  </div>
                </div>
                <div className="sm:hidden min-w-0">
                  <p className="text-base font-bold text-green-700">{formatEur(isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur)} €</p>
                  <p className="text-[10px] text-muted-foreground truncate">{isTVAC ? "TVAC" : "HTVA"} · {brandData?.name || product.brand || ""}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-green-700">{formatEur(isTVAC ? bestOffer.unitPriceInclVat : bestOffer.unitPriceEur)} €</p>
                    <p className="text-[11px] text-muted-foreground">{isTVAC ? "TVAC" : "HTVA"}</p>
                  </div>
                  <div className="flex items-center border border-border rounded-md bg-background">
                    <button onClick={() => setStickyQty(Math.max(1, stickyQty - 1))} className="px-2 py-1.5 text-muted-foreground"><Minus size={14} /></button>
                    <span className="px-2 text-sm font-medium">{stickyQty}</span>
                    <button onClick={() => setStickyQty(stickyQty + 1)} className="px-2 py-1.5 text-muted-foreground"><Plus size={14} /></button>
                  </div>
                  <button
                    className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg hover:opacity-90 transition-opacity"
                    onClick={() => {
                      if (!user) { navigate("/connexion"); return; }
                      addToCart.mutate({
                        offerId: bestOffer.id,
                        productId: product.id,
                        quantity: stickyQty,
                        vendorId: bestOffer.sellerId,
                        priceExclVat: bestOffer.unitPriceEur,
                        productData: { id: product.id, name: product.name, brand: product.brand || "", slug: product.slug, price: bestOffer.unitPriceEur },
                      });
                    }}
                  >
                    <ShoppingCart size={14} />
                    <span className="hidden sm:inline">Ajouter au panier</span>
                    <span className="sm:hidden">Ajouter</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
