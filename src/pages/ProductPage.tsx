import { Layout } from "@/components/layout/Layout";
import { ProductImage, getProductImages } from "@/components/shared/ProductCard";
import { competitors, formatPrice, productColors, productIconMap } from "@/data/mock";
import { useProducts, useProduct, useProductOffers } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Copy, Sliders, ShoppingCart, ExternalLink, Eye, Shield, Check, Truck, Globe, ChevronDown, Minus, Plus, Bell, ArrowLeft, Building2, Tag, Store, Heart } from "lucide-react";
import { useFavorites, useRecentActivity } from "@/hooks/useFavorites";
import { usePriceWatches } from "@/hooks/usePriceWatches";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition, AnimatedSection } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollableTable } from "@/components/shared/ScrollableTable";

const priceHistory = [
  { month: "Oct", price: 14.2 }, { month: "Nov", price: 13.5 }, { month: "Dec", price: 15.0 },
  { month: "Jan", price: 13.8 }, { month: "Fev", price: 12.9 }, { month: "Mar", price: 12.9 },
];

const accordeonItems = [
  { icon: Shield, title: "Garantie remboursement", desc: "Remboursement integral sous 30 jours si le produit ne correspond pas." },
  { icon: Check, title: "Reclamation facile", desc: "Processus de reclamation simplifie via votre espace client." },
  { icon: Truck, title: "Expedie sous 3 jours", desc: "Tous les produits sont expedies dans les 3 jours ouvrables." },
  { icon: Globe, title: "Pas de frais caches", desc: "Prix affiches incluant toutes les taxes applicables." },
];

const techSpecs = [
  ["Poids", "250g"], ["Dimensions", "22 x 12 x 8 cm"], ["Conditionnement", "Boite de 200"],
  ["Categorie", "EPI & Protection"], ["Marque", "Aurelia"], ["Certification", "CE, EN 455"],
  ["Code CNK", "12450"], ["Code EAN", "5412345678901"],
];
// Mock volume price tiers for demo
function generatePriceTiers(basePrice: number, movEur: number) {
  if (movEur >= 10000) {
    return [
      { minAmount: 10000, price: basePrice },
      { minAmount: 5000, price: +(basePrice * 1.02).toFixed(2) },
      { minAmount: 1500, price: +(basePrice * 1.04).toFixed(2) },
    ];
  }
  if (movEur >= 5000) {
    return [
      { minAmount: 5000, price: basePrice },
      { minAmount: 1500, price: +(basePrice * 1.01).toFixed(2) },
    ];
  }
  return [];
}

function OfferRow({ offer, product, user, navigate, addToCart, isBest, delay = 0 }: {
  offer: any; product: any; user: any; navigate: any; addToCart: any; isBest?: boolean; delay?: number;
}) {
  const [qty, setQty] = useState(offer.bundleSize > 1 ? offer.bundleSize : 1);
  const tiers = offer.priceTiers && offer.priceTiers.length > 0 ? offer.priceTiers : generatePriceTiers(offer.unitPriceEur, offer.movEur);
  const hasTiers = tiers.length > 1;

  return (
    <motion.div
      className="border-b border-mk-line last:border-b-0 py-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      {/* Delivery / stock badge */}
      <div className="flex items-center gap-2 mb-3">
        {offer.stockQuantity > 0 ? (
          <>
            <Store size={18} className="text-mk-navy" />
            <span className="text-sm font-medium text-mk-navy">In stock</span>
          </>
        ) : (
          <>
            <Truck size={18} className="text-mk-blue" />
            <span className="text-sm font-medium text-mk-sec">Estimated delivery: {offer.deliveryDays > 7 ? `${Math.ceil(offer.deliveryDays / 7)} weeks` : `${offer.deliveryDays} days`}</span>
          </>
        )}
      </div>

      {/* Main row — stacked on mobile, grid on desktop */}
      <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.5fr] gap-3 items-start">
        {/* Supplier */}
        <div className="flex items-center gap-2">
          {offer.sellerSlug ? (
            <Link to={`/vendeur/${offer.sellerSlug}`} className="font-bold text-mk-navy hover:text-mk-blue transition-colors text-sm">
              {offer.sellerName}
            </Link>
          ) : (
            <span className="font-bold text-mk-navy text-sm">{offer.sellerName}</span>
          )}
          {offer.isVerified && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-mk-alt rounded border border-mk-line" title="Verified">
              <Shield size={11} className="text-mk-navy" />
            </span>
          )}
        </div>

        {/* Unit price + tiers */}
        <div>
          {hasTiers ? (
            <div className="relative pl-4">
              {/* Continuous dotted vertical line */}
              <div
                className="absolute left-[3px] top-[7px] w-px border-l border-dashed border-mk-ter"
                style={{ height: `calc(100% - 14px)` }}
              />
              {tiers.map((tier: any, i: number) => (
                <div key={i} className="flex items-center gap-2 relative" style={{ marginTop: i > 0 ? 6 : 0 }}>
                  {/* Bullet dot */}
                  <div className="absolute left-[-14px] w-[7px] h-[7px] rounded-full bg-mk-navy" />
                  <span className={`text-sm ${i === 0 ? "font-bold text-mk-navy" : "text-mk-sec"}`}>
                    €{tier.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-mk-sec">
                    €{formatPrice(tier.minAmount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm font-bold text-mk-navy">€{offer.unitPriceEur.toFixed(2)}</span>
          )}
        </div>

        {/* MOV */}
        <span className="text-sm text-mk-navy">€{formatPrice(offer.movEur)}</span>

        {/* Stock */}
        <span className="text-sm text-mk-navy">{offer.stockQuantity.toLocaleString()}</span>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center border border-mk-line rounded-md">
            <button onClick={() => setQty(Math.max(offer.bundleSize > 1 ? offer.bundleSize : 1, qty - (offer.bundleSize > 1 ? offer.bundleSize : 1)))} className="px-2.5 py-2 text-mk-sec hover:text-mk-navy transition-colors">
              <Minus size={14} />
            </button>
            <span className="px-3 py-2 text-sm font-medium text-mk-navy min-w-[40px] text-center">{qty}</span>
            <button onClick={() => setQty(qty + (offer.bundleSize > 1 ? offer.bundleSize : 1))} className="px-2.5 py-2 text-mk-sec hover:text-mk-navy transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <motion.button
            className="bg-mk-navy text-white p-2.5 rounded-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!user) { navigate("/connexion"); return; }
              addToCart.mutate({
                productId: product.id,
                quantity: qty,
                vendorId: offer.sellerId,
                priceHt: offer.unitPriceEur,
                productData: { id: product.id, name: product.name, brand: product.brand, slug: product.slug, price: offer.unitPriceEur, gtin: product.gtin, unit: product.unit, stock: offer.stockQuantity > 0 },
              });
            }}
          >
            <ShoppingCart size={16} />
          </motion.button>
        </div>
      </div>

      {/* Mobile layout — stacked */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {offer.sellerSlug ? (
              <Link to={`/vendeur/${offer.sellerSlug}`} className="font-bold text-mk-navy hover:text-mk-blue transition-colors text-sm">
                {offer.sellerName}
              </Link>
            ) : (
              <span className="font-bold text-mk-navy text-sm">{offer.sellerName}</span>
            )}
            {offer.isVerified && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-mk-alt rounded border border-mk-line" title="Verified">
                <Shield size={11} className="text-mk-navy" />
              </span>
            )}
          </div>
          <span className="text-base font-bold text-mk-navy">€{offer.unitPriceEur.toFixed(2)}</span>
        </div>

        {/* Price tiers on mobile */}
        {hasTiers && (
          <div className="relative pl-4">
            {/* Continuous dotted vertical line */}
            <div
              className="absolute left-[3px] top-[5px] w-px border-l border-dashed border-mk-ter"
              style={{ height: `calc(100% - 10px)` }}
            />
            {tiers.map((tier: any, i: number) => (
              <div key={i} className="flex items-center gap-2 relative" style={{ marginTop: i > 0 ? 4 : 0 }}>
                <div className="absolute left-[-14px] w-[5px] h-[5px] rounded-full bg-mk-navy" />
                <span className={`text-xs ${i === 0 ? "font-bold text-mk-navy" : "text-mk-sec"}`}>€{tier.price.toFixed(2)}</span>
                <span className="text-xs text-mk-sec">€{formatPrice(tier.minAmount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-mk-sec">
          <span>MOV €{formatPrice(offer.movEur)}</span>
          <span>Stock {offer.stockQuantity.toLocaleString()}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-mk-line rounded-md flex-1">
            <button onClick={() => setQty(Math.max(offer.bundleSize > 1 ? offer.bundleSize : 1, qty - (offer.bundleSize > 1 ? offer.bundleSize : 1)))} className="px-2.5 py-2 text-mk-sec hover:text-mk-navy transition-colors">
              <Minus size={14} />
            </button>
            <span className="px-3 py-2 text-sm font-medium text-mk-navy min-w-[40px] text-center flex-1">{qty}</span>
            <button onClick={() => setQty(qty + (offer.bundleSize > 1 ? offer.bundleSize : 1))} className="px-2.5 py-2 text-mk-sec hover:text-mk-navy transition-colors">
              <Plus size={14} />
            </button>
          </div>
          <motion.button
            className="bg-mk-navy text-white px-4 py-2.5 rounded-md text-sm font-medium flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!user) { navigate("/connexion"); return; }
              addToCart.mutate({
                productId: product.id,
                quantity: qty,
                vendorId: offer.sellerId,
                priceHt: offer.unitPriceEur,
                productData: { id: product.id, name: product.name, brand: product.brand, slug: product.slug, price: offer.unitPriceEur, gtin: product.gtin, unit: product.unit, stock: offer.stockQuantity > 0 },
              });
            }}
          >
            <ShoppingCart size={14} /> Ajouter
          </motion.button>
        </div>
      </div>

      {/* Bundle note */}
      {offer.bundleSize > 1 && (
        <p className="text-xs text-mk-sec mt-2 ml-0">Bundles of {offer.bundleSize}</p>
      )}
    </motion.div>
  );
}

export default function ProductPage() {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: product, isLoading } = useProduct(slug);
  const { data: products = [] } = useProducts();
  const { addToCart } = useCart();
  const { data: realOffers = [] } = useProductOffers(product?.id);

  // Fetch brand details for CTA links
  const { data: brandData } = useQuery({
    queryKey: ["brand-detail", product?.brandId, product?.brand],
    queryFn: async () => {
      if (product!.brandId) {
        const { data } = await supabase.from("brands").select("id, name, slug").eq("id", product!.brandId).single();
        if (data) return data;
      }
      const { data } = await supabase.from("brands").select("id, name, slug").ilike("name", product!.brand).single();
      return data;
    },
    enabled: !!product,
  });

  const [tab, setTab] = useState<"mk" | "ext" | "market">("mk");
  const [qty, setQty] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const offerSectionRef = useRef<HTMLDivElement>(null);
  const [stickyQty, setStickyQty] = useState(1);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { trackActivity } = useRecentActivity();
  const { getWatchForProduct, savePrice } = usePriceWatches();

  // Track product view
  useEffect(() => {
    if (product?.id && user) {
      trackActivity.mutate({ activityType: "view_product", productId: product.id });
    }
  }, [product?.id, user?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    if (offerSectionRef.current) observer.observe(offerSectionRef.current);
    return () => observer.disconnect();
  }, [product]);

  const effectiveBuyPrice = buyPrice || (product ? product.price.toString() : "0");
  const effectiveSellPrice = sellPrice || (product ? (product.price * 1.7).toFixed(2) : "0");
  const margin = effectiveSellPrice && effectiveBuyPrice ? (((parseFloat(effectiveSellPrice) - parseFloat(effectiveBuyPrice)) / parseFloat(effectiveSellPrice)) * 100).toFixed(1) : "0";

  const handleCopy = () => {
    if (!product) return;
    navigator.clipboard.writeText(product.ean);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const extMock = [
    { name: "Pharma-Grossiste", price: 11.50, mov: "1 000 EUR", delay: "48h", url: "#" },
    { name: "MedSupply BE", price: 13.20, mov: "500 EUR", delay: "72h", url: "#" },
    { name: "Distri-Med NL", price: 10.80, mov: "2 000 EUR", delay: "5j", url: "#" },
  ];
  const extOffers = extMock;

  const tabs = [
    { key: "mk" as const, label: "Marketplace", fullLabel: "Marketplace MediKong", icon: ShoppingCart, count: realOffers.length },
    { key: "ext" as const, label: "Externes", fullLabel: "Offres externes", icon: ExternalLink, count: extOffers.length },
    { key: "market" as const, label: "Marche", fullLabel: "Prix du marche", icon: Eye, count: 5 },
  ];

  if (isLoading) {
    return <Layout><div className="mk-container py-20 text-center text-mk-sec">Chargement...</div></Layout>;
  }
  if (!product) {
    return <Layout><div className="mk-container py-20 text-center text-mk-sec">Produit introuvable</div></Layout>;
  }

  return (
    <Layout>
      <PageTransition>
         <div className="mk-container py-4 md:py-8 pb-24 md:pb-8">
           {/* Back to results */}
           <button
             onClick={() => navigate(-1)}
             className="inline-flex items-center gap-1.5 text-sm text-mk-sec hover:text-mk-blue transition-colors mb-4"
           >
             <ArrowLeft size={16} />
             <span>Retour aux résultats</span>
           </button>
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Image */}
            <motion.div
              className="w-full md:w-[400px] shrink-0 md:sticky md:top-20 self-start"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {(() => {
                const images = getProductImages(product);
                return (
                  <>
                    <div className="aspect-square rounded-lg overflow-hidden border border-mk-line mb-3 bg-muted">
                      <img
                        src={images[selectedImageIdx] || images[0]}
                        alt={`${product.name} - image ${selectedImageIdx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = images[0]; }}
                      />
                    </div>
                    {images.length > 1 && (
                      <div className="hidden md:flex gap-2">
                        {images.slice(0, 6).map((img, i) => (
                          <motion.button
                            key={i}
                            onClick={() => setSelectedImageIdx(i)}
                            className={`w-[52px] h-[52px] border rounded-md overflow-hidden cursor-pointer ${i === selectedImageIdx ? "border-mk-navy border-2" : "border-mk-line"}`}
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }}
                          >
                            <img src={img} alt={`${product.name} - miniature ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                          </motion.button>
                        ))}
                      </div>
                    )}
                    {images.length <= 1 && (
                      <div className="hidden md:flex gap-2">
                        {[0, 1, 2, 3].map(i => (
                          <motion.div
                            key={i}
                            className={`w-[52px] h-[52px] border rounded-md overflow-hidden ${i === 0 ? "border-mk-navy border-2" : "border-mk-line"}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + i * 0.08 }}
                          >
                            <img src={images[0]} alt={`${product.name} - vue ${i + 1}`} className="w-full h-full object-cover opacity-60" loading="lazy" />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>

            {/* Details */}
            <motion.div
              className="flex-1 min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              {brandData ? (
                <Link to={`/marque/${brandData.slug}`} className="text-sm text-mk-blue hover:underline mb-1 inline-flex items-center gap-1">
                  <Tag size={13} /> {product.brand}
                </Link>
              ) : (
                <p className="text-sm text-mk-sec mb-1">{product.brand}</p>
              )}
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl md:text-2xl font-bold text-mk-navy mb-3">{product.name}</h1>
                {user && (
                  <motion.button
                    onClick={() => toggleFavorite.mutate(product.id)}
                    className="shrink-0 mt-1 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    whileTap={{ scale: 0.85 }}
                  >
                    <Heart size={20} className={isFavorite(product.id) ? "text-mk-red fill-current" : "text-mk-ter"} />
                  </motion.button>
                )}
              </div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span className="text-xs text-mk-ter">GTIN: {product.ean}</span>
                <motion.button
                  onClick={handleCopy}
                  className="text-mk-blue text-xs flex items-center gap-1"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Copy size={12} /> {copied ? "Copie !" : "Copier"}
                </motion.button>
              </div>
              <div className="flex items-center gap-3 text-xs text-mk-ter mb-2 flex-wrap">
                <span>CNK: {product.cnk} · {product.unit} · Belgique</span>
              </div>

              {/* Brand / Manufacturer CTA chips */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {brandData && (
                  <Link
                    to={`/marque/${brandData.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium border border-mk-line rounded-full px-3 py-1.5 text-mk-navy hover:border-mk-blue hover:text-mk-blue transition-colors"
                  >
                    <Tag size={12} /> Marque : {brandData.name}
                  </Link>
                )}
              </div>

              <div className="border-t border-mk-line my-4" />

              {/* Filter offers */}
              <div ref={offerSectionRef}>
              <AnimatedSection delay={0.1}>
                <div className="hidden md:block bg-mk-alt border border-mk-line rounded-lg p-3 md:p-5 mb-4 md:mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sliders size={14} className="text-mk-navy" />
                    <span className="text-sm font-bold text-mk-navy">Filtrer les offres</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-mk-sec mb-1 block">MOV maximum</label>
                      <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
                        <option>500 EUR</option><option>1 500 EUR</option><option>5 000 EUR</option><option>10 000 EUR</option>
                      </select>
                      <p className="text-xs text-mk-ter mt-1">Show only offers with MOV up to this amount</p>
                    </div>
                    <div>
                      <label className="text-xs text-mk-sec mb-1 block">Delai livraison max</label>
                      <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
                        <option>24h</option><option>48h</option><option>3-5 jours</option><option>7+ jours</option>
                      </select>
                      <p className="text-xs text-mk-ter mt-1">Show only offers delivered within this timeframe</p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
                {tabs.map(t => (
                  <motion.button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-md text-xs md:text-sm font-medium whitespace-nowrap ${tab === t.key ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    layout
                  >
                    <t.icon size={14} /> <span className="hidden sm:inline">{t.fullLabel}</span><span className="sm:hidden">{t.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-white/20" : "bg-mk-alt"}`}>{t.count}</span>
                  </motion.button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {tab === "mk" && (
                  <motion.div
                    key="mk"
                    className="space-y-6"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* === BEST OFFER === */}
                    {(() => {
                      const allOffers = realOffers.length > 0 ? realOffers : [{ id: "fallback", productId: product.id, sellerId: "", sellerName: "MediKong", sellerSlug: undefined, unitPriceEur: product.price, stockQuantity: 1160, movEur: 10000, bundleSize: 20, deliveryDays: 3, shipFromCountry: "BE", priceTiers: [{ minAmount: 10000, price: product.price }, { minAmount: 5000, price: product.price * 1.02 }] as any, isActive: true, isVerified: true, isTopRated: false }];
                      const bestOffer = allOffers[0];
                      const otherOffers = allOffers.slice(1);
                      const totalStock = allOffers.reduce((sum, o) => sum + o.stockQuantity, 0);

                      return (
                        <>
                          {/* Best offer card */}
                          <div className="border border-mk-line rounded-lg p-3 md:p-6">
                            <div className="flex items-center justify-between mb-3 md:mb-5 flex-wrap gap-2">
                              <h3 className="text-base md:text-lg font-bold text-mk-navy">Meilleure offre</h3>
                              <span className="text-xs md:text-sm text-mk-blue font-medium">{formatPrice(totalStock).replace('.', ',')} dispo</span>
                            </div>

                            {/* Table header */}
                            <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.5fr] gap-3 px-1 pb-3 text-xs font-semibold text-mk-sec border-b border-mk-line">
                              <span>Supplier</span>
                              <span>Unit price</span>
                              <span>MOV</span>
                              <span>Stock</span>
                              <span className="text-right">Actions</span>
                            </div>

                            {/* Offer row */}
                            <OfferRow
                              offer={bestOffer}
                              product={product}
                              user={user}
                              navigate={navigate}
                              addToCart={addToCart}
                              isBest
                            />
                          </div>

                          {/* === OTHER OFFERS === */}
                          {otherOffers.length > 0 && (
                            <div className="border border-mk-line rounded-lg p-3 md:p-6">
                              <div className="flex items-center justify-between mb-3 md:mb-5 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base md:text-lg font-bold text-mk-navy">{otherOffers.length} autre{otherOffers.length > 1 ? 's' : ''} offre{otherOffers.length > 1 ? 's' : ''}</h3>
                                  <span className="text-xs text-mk-sec">Par prix</span>
                                </div>
                                <span className="text-xs md:text-sm text-mk-blue font-medium">{formatPrice(otherOffers.reduce((s, o) => s + o.stockQuantity, 0)).replace('.', ',')} dispo</span>
                              </div>

                              {/* Table header */}
                              <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_1.5fr] gap-3 px-1 pb-3 text-xs font-semibold text-mk-sec border-b border-mk-line">
                                <span>Supplier</span>
                                <span>Unit price</span>
                                <span>MOV</span>
                                <span>Stock</span>
                                <span className="text-right">Actions</span>
                              </div>

                              {otherOffers.map((offer, i) => (
                                <OfferRow
                                  key={offer.id}
                                  offer={offer}
                                  product={product}
                                  user={user}
                                  navigate={navigate}
                                  addToCart={addToCart}
                                  delay={i * 0.06}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </motion.div>
                )}

                {tab === "ext" && (
                  <motion.div
                    key="ext"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-sm text-mk-sec mb-4">Vous serez redirigé vers le site du fournisseur dans un nouvel onglet.</p>
                    <ScrollableTable className="border border-mk-line rounded-lg">
                      <div className="grid grid-cols-5 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[500px]">
                        <span>Fournisseur</span><span>Prix unit.</span><span>MOV</span><span>Délai</span><span>Action</span>
                      </div>
                      {extOffers.map((f: any, i: number) => (
                        <motion.div
                          key={f.name + i}
                          className="grid grid-cols-5 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center min-w-[500px]"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                        >
                          <span className="font-medium text-mk-navy">{f.name}</span>
                          <span className="font-bold text-mk-navy">{f.price ? `${formatPrice(f.price)} EUR` : "–"}</span>
                          <span className="text-mk-sec">{f.mov}</span>
                          <span className="text-mk-sec">{f.delay}</span>
                          <motion.a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-mk-navy text-mk-navy text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 hover:bg-mk-navy hover:text-white transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Voir <ExternalLink size={11} />
                          </motion.a>
                        </motion.div>
                      ))}
                    </ScrollableTable>
                  </motion.div>
                )}

                {tab === "market" && (
                  <motion.div
                    key="market"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Eye size={14} className="text-mk-sec" />
                      <span className="text-sm text-mk-sec">Prix publics. Consultation uniquement.</span>
                    </div>
                    <ScrollableTable className="border border-mk-line rounded-lg">
                      <div className="grid grid-cols-4 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[400px]">
                        <span>Enseigne</span><span>Prix TTC</span><span>Statut</span><span>MAJ</span>
                      </div>
                      {competitors.map((c, i) => (
                        <motion.div
                          key={c.name}
                          className={`grid grid-cols-4 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center min-w-[400px] ${i % 2 === 1 ? "bg-mk-alt" : ""}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <span className="font-medium text-mk-navy">{c.name}</span>
                          <span className="font-bold text-mk-navy">{formatPrice(c.price)} EUR</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded inline-block w-fit ${
                            c.status === "En stock" ? "bg-mk-deal text-mk-green" :
                            c.status === "Promo" ? "bg-mk-mov-bg text-mk-amber" :
                            "bg-red-50 text-mk-red"
                          }`}>
                            {c.status}
                          </span>
                          <span className="text-mk-ter">{c.date}</span>
                        </motion.div>
                      ))}
                    </ScrollableTable>
                    <p className="text-xs text-mk-ter italic mt-3">Prix releves le 25/03/2026. MediKong n'est pas responsable des prix tiers.</p>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>{/* end offerSectionRef */}

              {/* Accordions */}
              <AnimatedSection className="mt-8 space-y-2" delay={0.1}>
                {accordeonItems.map((a, i) => (
                  <motion.div
                    key={a.title}
                    className="border border-mk-line rounded-lg overflow-hidden"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <button onClick={() => setOpenAccordion(openAccordion === i ? null : i)} className="flex items-center justify-between w-full p-4">
                      <div className="flex items-center gap-3">
                        <a.icon size={16} className="text-mk-navy" />
                        <span className="text-sm font-medium text-mk-navy">{a.title}</span>
                      </div>
                      <motion.div animate={{ rotate: openAccordion === i ? 180 : 0 }} transition={{ duration: 0.25 }}>
                        <ChevronDown size={16} className="text-mk-sec" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {openAccordion === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 text-sm text-mk-sec">{a.desc}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatedSection>

              {/* Tech specs */}
              <AnimatedSection className="mt-8" delay={0.15}>
                <h2 className="text-lg font-bold text-mk-navy mb-4">Details techniques</h2>
                {techSpecs.map(([k, v], i) => (
                  <motion.div
                    key={k}
                    className={`flex justify-between py-2.5 px-3 text-sm ${i % 2 === 0 ? "bg-mk-alt" : ""}`}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <span className="text-mk-sec">{k}</span>
                    <span className="text-mk-navy font-medium">{v}</span>
                  </motion.div>
                ))}
              </AnimatedSection>

              {/* Price history */}
              <AnimatedSection className="mt-8" delay={0.2}>
                <h2 className="text-lg font-bold text-mk-navy mb-4">Historique des prix</h2>
                <div className="grid grid-cols-2 md:flex gap-4 md:gap-6 mb-4">
                  {[["Min", "10,80"], ["Max", "15,00"], ["Median", "13,20"], ["Moyen", "13,05"]].map(([l, v], i) => (
                    <motion.div
                      key={l}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <span className="text-xs text-mk-sec">{l}</span>
                      <div className="text-[15px] font-bold text-mk-navy">{v} EUR</div>
                    </motion.div>
                  ))}
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceHistory}>
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis hide />
                      <Bar dataKey="price" fill="hsl(215, 33%, 17%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AnimatedSection>

              {/* Margin calculator */}
              <AnimatedSection className="mt-8" delay={0.1}>
                {(() => {
                  const existingWatch = product ? getWatchForProduct(product.id) : undefined;
                  const bestMkPrice = product?.price || 0;
                  const userEnteredPrice = buyPrice ? parseFloat(buyPrice) : (existingWatch?.user_price_excl_vat || 0);
                  const diff = userEnteredPrice > 0 ? bestMkPrice - userEnteredPrice : 0;
                  const diffPct = userEnteredPrice > 0 ? ((diff / userEnteredPrice) * 100) : 0;
                  const hasSaving = diff < 0; // MediKong is cheaper
                  const isMoreExpensive = diff > 0; // user pays less currently

                  return (
                    <div className="border border-mk-line rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                          <Sliders size={16} className="text-[#1B5BDA]" />
                        </div>
                        <h2 className="text-base font-bold text-mk-navy">Calculateur de marge personnalisé</h2>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-medium text-mk-sec mb-1.5 block">Votre prix d'achat HT</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={buyPrice || (existingWatch ? existingWatch.user_price_excl_vat.toString() : "")}
                              onChange={e => setBuyPrice(e.target.value)}
                              placeholder="0,00"
                              className="w-full border border-mk-line rounded-lg px-3 py-2.5 text-sm pr-8 focus:border-[#1B5BDA] focus:ring-1 focus:ring-[#1B5BDA]/20 outline-none transition-all"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mk-ter">€</span>
                          </div>
                          <p className="text-xs text-[#1B5BDA] mt-1.5">
                            Entrez votre prix d'achat pour voir votre économie potentielle et le sauvegarder 💾
                          </p>
                        </div>

                        {userEnteredPrice > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#F8FAFC] rounded-lg p-4 space-y-3"
                          >
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <p className="text-xs text-mk-sec mb-1">Votre prix</p>
                                <p className="text-base font-bold text-mk-navy">{formatPrice(userEnteredPrice)} €</p>
                              </div>
                              <div>
                                <p className="text-xs text-mk-sec mb-1">Meilleur MediKong</p>
                                <p className="text-base font-bold text-[#1B5BDA]">{formatPrice(bestMkPrice)} €</p>
                              </div>
                              <div>
                                <p className="text-xs text-mk-sec mb-1">Différence</p>
                                <p className={`text-base font-bold ${hasSaving ? "text-mk-green" : isMoreExpensive ? "text-mk-red" : "text-mk-navy"}`}>
                                  {diff > 0 ? "+" : ""}{formatPrice(Math.abs(diff))} €
                                </p>
                                <p className={`text-xs ${hasSaving ? "text-mk-green" : isMoreExpensive ? "text-mk-red" : "text-mk-ter"}`}>
                                  ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%)
                                </p>
                              </div>
                            </div>

                            <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${
                              hasSaving ? "bg-green-50 text-mk-green" : isMoreExpensive ? "bg-blue-50 text-[#1B5BDA]" : "bg-gray-50 text-mk-sec"
                            }`}>
                              {hasSaving ? (
                                <>📉 Économie possible de {formatPrice(Math.abs(diff))} € par unité</>
                              ) : isMoreExpensive ? (
                                <>✅ Vous avez déjà un meilleur prix ! MediKong cherche à négocier pour vous.</>
                              ) : (
                                <>➡️ Prix identique</>
                              )}
                            </div>

                            {user && (
                              <motion.button
                                onClick={() => {
                                  savePrice.mutate(
                                    { productId: product.id, price: userEnteredPrice },
                                    { onSuccess: () => toast.success("Prix sauvegardé ! Retrouvez-le dans Mes Prix.") }
                                  );
                                }}
                                className="w-full bg-[#1B5BDA] hover:bg-[#1549b8] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                                whileTap={{ scale: 0.97 }}
                              >
                                💾 {existingWatch ? "Mettre à jour mon prix" : "Sauvegarder et suivre"}
                              </motion.button>
                            )}
                            {!user && (
                              <Link to="/connexion" className="block w-full text-center bg-[#1B5BDA] hover:bg-[#1549b8] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors">
                                Se connecter pour sauvegarder
                              </Link>
                            )}
                          </motion.div>
                        )}

                        {existingWatch && !buyPrice && (
                          <div className="bg-blue-50 rounded-lg p-3 text-sm text-[#1B5BDA] flex items-center gap-2">
                            ✅ Prix suivi : {formatPrice(existingWatch.user_price_excl_vat)} € · Mis à jour le {new Date(existingWatch.updated_at).toLocaleDateString("fr-BE")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </AnimatedSection>
              <AnimatedSection className="mt-8" delay={0.1}>
                <motion.div
                  className="border-2 border-dashed border-mk-line rounded-lg p-6 text-center"
                  whileHover={{ borderColor: "hsl(var(--mk-navy))", scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 className="font-bold text-mk-navy mb-1">Vous proposez un meilleur prix ?</h3>
                  <p className="text-sm text-mk-sec mb-4">Vendez via MediKong et touchez 500+ pharmacies</p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Link to="/inscription" className="inline-block bg-mk-navy text-white font-bold text-sm px-5 py-2 rounded-md">Devenir vendeur</Link>
                  </motion.div>
                </motion.div>
              </AnimatedSection>

              {/* Similar products */}
              <AnimatedSection className="mt-8" delay={0.1}>
                <h2 className="text-lg font-bold text-mk-navy mb-4">Plus de produits {product.brand}</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {products.filter(p => p.id !== product.id).slice(0, 6).map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ y: -4, boxShadow: "0 6px 20px -6px rgba(0,0,0,0.1)" }}
                    >
                      <Link to={`/produit/${p.slug}`} className="w-36 shrink-0 border border-mk-line rounded-lg p-3 block">
                        <ProductImage product={p} className="mb-2" />
                        <p className="text-xs text-mk-text truncate font-medium">{p.name}</p>
                        <p className="text-sm font-bold text-mk-navy">{formatPrice(p.price)} EUR</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </AnimatedSection>
            </motion.div>
          </div>
        </div>
      </PageTransition>

      {/* Sticky bottom bar - Apple style */}
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-mk-line"
            style={{ backgroundColor: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            <div className="mk-container py-2.5 sm:py-3">
              {/* Mobile: stacked layout */}
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                {/* Product info - hidden on very small screens to save space */}
                <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg border border-mk-line overflow-hidden shrink-0 bg-mk-alt flex items-center justify-center">
                    {product.iconName && productIconMap[product.iconName] ? (
                      (() => {
                        const IconComp = productIconMap[product.iconName!];
                        const colors = productColors[product.color || "blue"] || productColors.blue;
                        return <IconComp size={18} style={{ color: colors.fg }} />;
                      })()
                    ) : (
                      <ShoppingCart size={14} className="text-mk-ter" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-mk-navy truncate">{product.name}</p>
                    <p className="text-xs text-mk-sec">{product.brand} · Meilleure offre</p>
                  </div>
                </div>

                {/* Mobile: price on left */}
                <div className="sm:hidden min-w-0">
                  <p className="text-base font-bold text-mk-navy">{formatPrice(product.price)} €</p>
                  <p className="text-[10px] text-mk-ter truncate">HT · {product.brand}</p>
                </div>

                {/* Price (desktop) + Qty + CTA */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-mk-navy">{formatPrice(product.price)} EUR</p>
                    <p className="text-[11px] text-mk-ter">HT · {product.unit}</p>
                  </div>
                  <div className="flex items-center border border-mk-line rounded-md bg-white">
                    <button onClick={() => setStickyQty(Math.max(1, stickyQty - 1))} className="px-1.5 sm:px-2 py-1.5 text-mk-sec hover:text-mk-navy"><Minus size={14} /></button>
                    <span className="px-1.5 sm:px-2 text-sm font-medium text-mk-navy">{stickyQty}</span>
                    <button onClick={() => setStickyQty(stickyQty + 1)} className="px-1.5 sm:px-2 py-1.5 text-mk-sec hover:text-mk-navy"><Plus size={14} /></button>
                  </div>
                  <motion.button
                    className="bg-mk-navy text-white text-xs sm:text-sm font-semibold px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 shadow-lg"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (!user) { navigate("/connexion"); return; }
                      const bestOffer = realOffers[0];
                      addToCart.mutate({
                        offerId: bestOffer?.id || product.id,
                        productId: product.id,
                        quantity: stickyQty,
                        vendorId: bestOffer?.sellerId,
                        priceExclVat: bestOffer?.unitPriceEur || product.price,
                        productData: { id: product.id, name: product.name, brand: product.brand, slug: product.slug, price: bestOffer?.unitPriceEur || product.price },
                      });
                    }}
                  >
                    <ShoppingCart size={14} />
                    <span className="hidden sm:inline">Ajouter au panier</span>
                    <span className="sm:hidden">Ajouter</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
