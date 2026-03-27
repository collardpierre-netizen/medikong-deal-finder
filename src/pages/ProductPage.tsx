import { Layout } from "@/components/layout/Layout";
import { ProductImage } from "@/components/shared/ProductCard";
import { competitors, formatPrice, sellers, productColors, productIconMap } from "@/data/mock";
import { useProducts, useProduct } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, Link } from "react-router-dom";
import { Copy, Sliders, ShoppingCart, ExternalLink, Eye, Shield, Check, Truck, Globe, ChevronDown, Minus, Plus, Bell } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition, AnimatedSection } from "@/components/shared/PageTransition";

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

export default function ProductPage() {
  const { slug } = useParams();
  const { data: product, isLoading } = useProduct(slug);
  const { data: products = [] } = useProducts();
  const [tab, setTab] = useState<"mk" | "ext" | "market">("mk");
  const [qty, setQty] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");

  const effectiveBuyPrice = buyPrice || (product ? product.price.toString() : "0");
  const effectiveSellPrice = sellPrice || (product ? (product.price * 1.7).toFixed(2) : "0");
  const margin = effectiveSellPrice && effectiveBuyPrice ? (((parseFloat(effectiveSellPrice) - parseFloat(effectiveBuyPrice)) / parseFloat(effectiveSellPrice)) * 100).toFixed(1) : "0";

  const handleCopy = () => {
    if (!product) return;
    navigator.clipboard.writeText(product.ean);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tabs = [
    { key: "mk" as const, label: "Marketplace", fullLabel: "Marketplace MediKong", icon: ShoppingCart, count: 2 },
    { key: "ext" as const, label: "Externes", fullLabel: "Offres externes", icon: ExternalLink, count: 3 },
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
        <div className="mk-container py-6 md:py-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Image */}
            <motion.div
              className="w-full md:w-[400px] shrink-0 md:sticky md:top-20 self-start"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProductImage product={product} className="border border-mk-line mb-3" />
              <div className="flex gap-2">
                {[0, 1, 2, 3].map(i => {
                  const colorKey = product.color || "blue";
                  const colors = productColors[colorKey] || productColors.blue;
                  const IconComp = product.iconName ? productIconMap[product.iconName] : null;
                  return (
                    <motion.div
                      key={i}
                      className={`w-[52px] h-[52px] border rounded-md flex items-center justify-center cursor-pointer ${i === 0 ? "border-mk-navy border-2" : "border-mk-line"}`}
                      style={{ backgroundColor: colors.bg }}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      {IconComp ? <IconComp size={16} style={{ color: colors.fg }} /> : <span className="text-[8px] text-mk-ter">IMG</span>}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Details */}
            <motion.div
              className="flex-1 min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-sm text-mk-sec mb-1">{product.brand}</p>
              <h1 className="text-xl md:text-2xl font-bold text-mk-navy mb-3">{product.name}</h1>
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
              <p className="text-xs text-mk-ter mb-4">CNK: {product.cnk} · {product.unit} · Belgique</p>

              <div className="border-t border-mk-line my-4" />

              {/* Filter offers */}
              <AnimatedSection delay={0.1}>
                <div className="bg-mk-alt border border-mk-line rounded-lg p-4 md:p-5 mb-6">
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
                    </div>
                    <div>
                      <label className="text-xs text-mk-sec mb-1 block">Delai livraison max</label>
                      <select className="w-full border border-mk-line rounded-md px-3 py-2 text-sm">
                        <option>24h</option><option>48h</option><option>3-5 jours</option><option>7+ jours</option>
                      </select>
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
                    className="space-y-4"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-sm text-mk-sec">Meilleure offre · 2 disponibles</p>
                    {sellers.slice(0, 2).map((s, i) => (
                      <motion.div
                        key={s.name}
                        className="border border-mk-line rounded-lg p-4 md:p-5"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.35 }}
                        whileHover={{ borderColor: "hsl(var(--mk-blue))", boxShadow: "0 4px 16px -4px rgba(0,0,0,0.08)" }}
                      >
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">En stock</span>
                            {s.topRated && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-medium">Top rated</span>}
                            <span className="font-semibold text-mk-navy">{s.name}</span>
                            {s.name === product.best && <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">Meilleur prix</span>}
                          </div>
                          <span className="text-xs text-mk-sec">48h</span>
                        </div>
                        <div className="bg-mk-mov-bg border border-mk-mov-border rounded-md p-3 mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-mk-amber font-medium">Minimum: 500 EUR</span>
                            <span className="text-mk-sec">Encore 367,10 EUR</span>
                          </div>
                          <div className="h-1.5 bg-mk-mov-border rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-mk-amber rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: "27%" }}
                              transition={{ duration: 0.8, delay: 0.3 }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-mk-sec mb-3">500 EUR | 1 500 EUR | 5 000 EUR</div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
                          <div>
                            <p className="text-2xl font-bold text-mk-navy">{formatPrice(product.price)} EUR</p>
                            <p className="text-xs text-mk-ter">{product.unit}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-mk-line rounded-md">
                              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2 py-1.5"><Minus size={14} /></button>
                              <span className="px-3 text-sm font-medium">{qty}</span>
                              <button onClick={() => setQty(qty + 1)} className="px-2 py-1.5"><Plus size={14} /></button>
                            </div>
                            <motion.button
                              className="bg-mk-navy text-white text-sm font-semibold px-4 md:px-5 py-2 rounded-md flex items-center gap-2"
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                if (!user) { navigate("/connexion"); return; }
                                addToCart.mutate({ productId: product.id, quantity: qty });
                              }}
                            >
                              <ShoppingCart size={14} /> Ajouter
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
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
                    <p className="text-sm text-mk-sec mb-4">Vous serez redirige vers le site du fournisseur.</p>
                    <div className="border border-mk-line rounded-lg overflow-x-auto">
                      <div className="grid grid-cols-5 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[500px]">
                        <span>Fournisseur</span><span>Prix unit.</span><span>MOV</span><span>Delai</span><span>Action</span>
                      </div>
                      {[
                        { name: "Pharma-Grossiste", price: 11.50, mov: "1 000 EUR", delay: "48h" },
                        { name: "MedSupply BE", price: 13.20, mov: "500 EUR", delay: "72h" },
                        { name: "Distri-Med NL", price: 10.80, mov: "2 000 EUR", delay: "5j" },
                      ].map((f, i) => (
                        <motion.div
                          key={f.name}
                          className="grid grid-cols-5 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center min-w-[500px]"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                        >
                          <span className="font-medium text-mk-navy">{f.name}</span>
                          <span className="font-bold text-mk-navy">{formatPrice(f.price)} EUR</span>
                          <span className="text-mk-sec">{f.mov}</span>
                          <span className="text-mk-sec">{f.delay}</span>
                          <motion.button
                            className="border border-mk-navy text-mk-navy text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Voir <ExternalLink size={11} />
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
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
                    <div className="border border-mk-line rounded-lg overflow-x-auto">
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
                    </div>
                    <p className="text-xs text-mk-ter italic mt-3">Prix releves le 25/03/2026. MediKong n'est pas responsable des prix tiers.</p>
                  </motion.div>
                )}
              </AnimatePresence>

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
                <h2 className="text-lg font-bold text-mk-navy mb-4">Calculateur de marge</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-mk-sec mb-1 block">Prix d'achat HT</label>
                    <input value={buyPrice || product.price.toString()} onChange={e => setBuyPrice(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-mk-sec mb-1 block">Prix de vente TTC</label>
                    <input value={sellPrice || (product.price * 1.7).toFixed(2)} onChange={e => setSellPrice(e.target.value)} className="w-full border border-mk-line rounded-md px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-mk-sec mb-1 block">Marge brute</label>
                    <motion.div
                      className="text-2xl font-bold text-mk-green mt-1"
                      key={margin}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      +{margin}%
                    </motion.div>
                  </div>
                </div>
              </AnimatedSection>

              {/* Seller CTA */}
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
    </Layout>
  );
}
