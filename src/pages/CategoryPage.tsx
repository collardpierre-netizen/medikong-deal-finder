import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard, ProductImage, ProductImageSmall } from "@/components/shared/ProductCard";
import { formatPrice } from "@/data/mock";
import { Grid, List, Columns, Sliders, TrendingDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const subcategories = ["Gants", "Masques", "Compresses", "Desinfectants", "Bandages", "Equipement PPE"];
const sidebarBrands = ["Aurelia", "Kolmi", "Hartmann", "Ecolab", "Meda Pharma"];

type ViewMode = "grid" | "list" | "trivago";

export default function CategoryPage() {
  const { slug } = useParams();
  const { data: products = [] } = useProducts();
  const [view, setView] = useState<ViewMode>("grid");
  const [activeSub, setActiveSub] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Layout>
      <div className="mk-container py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Consommables medicaux</h1>
            <p className="text-sm text-mk-sec">847 produits</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className="lg:hidden flex items-center gap-1.5 border border-mk-line text-sm px-3 py-1.5 rounded-md text-mk-sec">
              <Sliders size={14} /> Filtres
            </button>
            <div className="flex border border-mk-line rounded-md overflow-hidden">
              {([["grid", Grid], ["list", List], ["trivago", Columns]] as const).map(([v, Icon]) => (
                <motion.button
                  key={v}
                  onClick={() => setView(v)}
                  className={`p-2 ${view === v ? "bg-mk-navy text-white" : "text-mk-sec hover:bg-mk-alt"}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon size={16} />
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-[220px] shrink-0 ${showFilters ? 'mb-4' : ''}`}>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Sous-categories</h4>
              {subcategories.map((s, i) => (
                <button key={s} onClick={() => setActiveSub(i)} className={`block w-full text-left text-sm py-1.5 ${i === activeSub ? "text-mk-blue font-medium" : "text-mk-sec hover:text-mk-text"}`}>{s}</button>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Marque</h4>
              {sidebarBrands.map(b => (
                <label key={b} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer"><input type="checkbox" /> {b}</label>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Prix</h4>
              <div className="flex gap-2">
                <input placeholder="Min" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
                <input placeholder="Max" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-mk-sec cursor-pointer"><input type="checkbox" /> En stock uniquement</label>
            {showFilters && (
              <button onClick={() => setShowFilters(false)} className="mt-4 w-full bg-mk-navy text-white text-sm py-2 rounded-md lg:hidden">
                Appliquer les filtres
              </button>
            )}
          </aside>

          <div className="flex-1 min-w-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {view === "grid" ? (
                <motion.div
                  key="grid"
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
                </motion.div>
              ) : view === "list" ? (
                <motion.div
                  key="list"
                  className="border border-mk-line rounded-lg overflow-x-auto"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="grid grid-cols-[60px_1fr_80px_100px_80px_80px_100px] gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[700px]">
                    <span></span><span>Produit</span><span>CNK</span><span>Marque</span><span>Prix</span><span>Offres</span><span>Action</span>
                  </div>
                  {products.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                    >
                      <Link to={`/produit/${p.slug}`} className="grid grid-cols-[60px_1fr_80px_100px_80px_80px_100px] gap-3 px-4 py-3 items-center border-t border-mk-line hover:bg-mk-alt text-sm min-w-[700px]">
                        <ProductImageSmall product={p} />
                        <span className="text-mk-text font-medium truncate">{p.name}</span>
                        <span className="text-mk-sec">{p.cnk}</span>
                        <span className="text-mk-sec">{p.brand}</span>
                        <span className="font-bold text-mk-navy">{formatPrice(p.price)} EUR</span>
                        <span className="text-mk-sec">{p.sellers}</span>
                        <motion.button
                          className="bg-mk-navy text-white text-xs font-semibold py-1.5 px-3 rounded-md"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Ajouter
                        </motion.button>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                /* Vue comparateur */
                <motion.div
                  key="trivago"
                  className="space-y-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
                    {[
                      { label: "Le meilleur", price: "12,90 EUR", sub: "qualite-prix", active: true },
                      { label: "Le moins cher", price: "4,03 EUR", sub: "", active: false },
                      { label: "Le plus rapide", price: "18,50 EUR", sub: "24h", active: false },
                    ].map(t => (
                      <motion.button
                        key={t.label}
                        className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${t.active ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                      >
                        {t.label} · {t.price} {t.sub && <span className="text-xs opacity-70">({t.sub})</span>}
                      </motion.button>
                    ))}
                  </div>
                  {products.map((p, i) => (
                    <motion.div
                      key={p.id}
                      className="border border-mk-line rounded-lg flex flex-col md:flex-row overflow-hidden"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      whileHover={{ y: -3, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.1)" }}
                    >
                      <div className="w-full md:w-[200px] shrink-0 relative p-4">
                        <span className="absolute top-3 left-3 bg-mk-red text-white text-[11px] font-bold px-2 py-0.5 rounded">{p.pct}%</span>
                        <ProductImage product={p} />
                      </div>
                      <div className="flex-1 p-4 border-t md:border-t-0 md:border-l border-mk-line">
                        <p className="text-xs text-mk-sec">{p.brand}</p>
                        <h3 className="text-base font-semibold text-mk-navy mb-2">{p.name}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-mk-green/10 text-mk-green text-xs font-semibold px-2 py-0.5 rounded">{p.rating} Excellent · {p.reviews} avis</span>
                        </div>
                        <p className="text-xs text-mk-ter">CNK: {p.cnk} · EAN: {p.ean}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-mk-amber">
                          <TrendingDown size={12} /> -3% vs 7 jours
                        </div>
                      </div>
                      <div className={`w-full md:w-[260px] shrink-0 p-4 border-t md:border-t-0 md:border-l border-mk-line ${p.mk ? "bg-mk-deal" : ""}`}>
                        <p className="text-xs text-mk-sec mb-1">{p.best}</p>
                        <p className="text-xs text-mk-green mb-2">Livraison 48h</p>
                        <p className="text-[22px] font-bold text-mk-navy mb-1">{formatPrice(p.price)} EUR</p>
                        <p className="text-xs text-mk-ter mb-3">{p.unit}</p>
                        <motion.button
                          className={`w-full py-2 rounded-md text-sm font-semibold ${p.mk ? "bg-mk-navy text-white" : "border border-mk-navy text-mk-navy"}`}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                        >
                          {p.mk ? "Ajouter au panier" : "Voir l'offre"}
                          {!p.mk && <ExternalLink size={12} className="inline ml-1" />}
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}
