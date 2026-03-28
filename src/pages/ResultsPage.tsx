import { Layout } from "@/components/layout/Layout";
import { UniversePills } from "@/components/layout/UniversePills";
import { ProductCard, ProductImage, ProductImageSmall } from "@/components/shared/ProductCard";
import { SkeletonList } from "@/components/shared/SkeletonCard";
import { formatPrice } from "@/data/mock";
import { useSearchProducts, type SortOption } from "@/hooks/useSearchProducts";
import { Sliders, Grid, List, Columns, Bell, Plus, Minus, TrendingDown, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition, AnimatedSection } from "@/components/shared/PageTransition";

const filterPills = ["En stock", "MediKong uniquement", "Livraison 48h", "Note >= 4.0"];
const sidebarSellers = ["MedDistri", "Pharmamed", "Brussels Med", "Valerco"];
const sidebarBrands = ["Aurelia", "Ecolab", "Kolmi", "Hartmann", "TENA"];

type ViewMode = "grid" | "list" | "trivago";

export default function ResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [view, setView] = useState<ViewMode>("grid");
  const { data: products = [], isLoading: dbLoading } = useSearchProducts(searchQuery, sort);
  const [activePill, setActivePill] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const loading = dbLoading;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(localQuery.trim() ? { q: localQuery.trim() } : {});
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as SortOption);
  };


  return (
    <Layout>
      <PageTransition>
        <UniversePills />
        <div className="mk-container py-6">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex border border-mk-line rounded-md overflow-hidden max-w-xl">
              <div className="flex items-center pl-3">
                <Search size={16} className="text-mk-sec" />
              </div>
              <input
                value={localQuery}
                onChange={e => setLocalQuery(e.target.value)}
                placeholder="Rechercher par nom, marque, GTIN ou CNK..."
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none min-w-0"
              />
              <button type="submit" className="bg-mk-blue text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 whitespace-nowrap">
                Rechercher
              </button>
            </div>
            {searchQuery && (
              <p className="text-sm text-mk-sec mt-2">
                Résultats pour « <span className="font-semibold text-mk-navy">{searchQuery}</span> »
                <button onClick={() => { setLocalQuery(""); setSearchParams({}); }} className="text-mk-blue ml-2 hover:underline">Effacer</button>
              </p>
            )}
          </form>
          {/* Filter pills */}
          <motion.div
            className="flex items-center gap-2 mb-4 overflow-x-auto pb-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 border border-mk-line rounded-md text-sm text-mk-sec whitespace-nowrap lg:hidden">
              <Sliders size={14} /> Filtres
            </button>
            <button className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 border border-mk-line rounded-md text-sm text-mk-sec">
              <Sliders size={14} /> Filtres
            </button>
            {filterPills.map((p, i) => (
              <motion.button
                key={p}
                onClick={() => setActivePill(i)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${i === activePill ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {p}
              </motion.button>
            ))}
          </motion.div>

          {/* Results bar */}
          <motion.div
            className="flex items-center justify-between mb-5 flex-wrap gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <span className="text-sm text-mk-sec">{products.length} produit{products.length !== 1 ? 's' : ''} trouvé{products.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-3">
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
              <select value={sort} onChange={handleSortChange} className="border border-mk-line rounded-md px-3 py-1.5 text-sm text-mk-sec">
                <option value="relevance">Pertinence</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="offers">Nombre d'offres</option>
              </select>
            </div>
          </motion.div>

          <div className="flex gap-6">
            {/* Sidebar */}
            <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-60 shrink-0 ${showFilters ? 'absolute left-0 right-0 z-40 bg-white p-4 border-b border-mk-line lg:static lg:p-0 lg:border-0' : ''}`}>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-mk-navy mb-3">Prix</h4>
                  <div className="flex gap-2 h-10 items-end mb-2">
                    {[12, 28, 45, 38, 22, 55, 15, 30].map((h, i) => (
                      <motion.div
                        key={i}
                        className={`w-full rounded-t ${i === 5 ? "bg-mk-navy" : "bg-mk-lb"}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs font-medium text-mk-sec">
                    <span>0 EUR</span><span>100 EUR</span>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-mk-navy mb-3">Vendeur</h4>
                  {sidebarSellers.map((s, i) => (
                    <motion.label
                      key={s}
                      className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      <input type="checkbox" className="rounded border-mk-line" /> {s}
                    </motion.label>
                  ))}
                </div>
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-mk-navy mb-3">Marque</h4>
                  {sidebarBrands.map((b, i) => (
                    <motion.label
                      key={b}
                      className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                    >
                      <input type="checkbox" className="rounded border-mk-line" /> {b}
                    </motion.label>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-mk-navy mb-3">Disponibilite</h4>
                  {["En stock", "Stock limite", "Sur commande"].map((d, i) => (
                    <motion.label
                      key={d}
                      className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    >
                      <input type="checkbox" className="rounded border-mk-line" /> {d}
                    </motion.label>
                  ))}
                </div>
                {showFilters && (
                  <button onClick={() => setShowFilters(false)} className="mt-4 w-full bg-mk-navy text-white text-sm py-2 rounded-md lg:hidden">
                    Appliquer les filtres
                  </button>
                )}
              </motion.div>
            </aside>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SkeletonList />
                  </motion.div>
                ) : view === "grid" ? (
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
                  /* Trivago view */
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
      </PageTransition>
    </Layout>
  );
}
