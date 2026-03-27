import { Layout } from "@/components/layout/Layout";
import { UniversePills } from "@/components/layout/UniversePills";
import { ProductCard } from "@/components/shared/ProductCard";
import { SkeletonList } from "@/components/shared/SkeletonCard";
import { products, formatPrice } from "@/data/mock";
import { Sliders, Grid, List, Columns, Bell, Plus, Minus, TrendingDown, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const filterPills = ["En stock", "MediKong uniquement", "Livraison 48h", "Note >= 4.0"];
const sidebarSellers = ["MedDistri", "Pharmamed", "Brussels Med", "Valerco"];
const sidebarBrands = ["Aurelia", "Ecolab", "Kolmi", "Hartmann", "TENA"];

type ViewMode = "grid" | "list" | "trivago";

export default function ResultsPage() {
  const [view, setView] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);
  const [activePill, setActivePill] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Layout>
      <UniversePills />
      <div className="mk-container py-6">
        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 border border-mk-line rounded-md text-sm text-mk-sec whitespace-nowrap lg:hidden">
            <Sliders size={14} /> Filtres
          </button>
          <button className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 border border-mk-line rounded-md text-sm text-mk-sec">
            <Sliders size={14} /> Filtres
          </button>
          {filterPills.map((p, i) => (
            <button
              key={p}
              onClick={() => setActivePill(i)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${i === activePill ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Results bar */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <span className="text-sm text-mk-sec">248 produits trouves sur 12 fournisseurs</span>
          <div className="flex items-center gap-3">
            <div className="flex border border-mk-line rounded-md overflow-hidden">
              {([["grid", Grid], ["list", List], ["trivago", Columns]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} className={`p-2 ${view === v ? "bg-mk-navy text-white" : "text-mk-sec hover:bg-mk-alt"}`}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <select className="border border-mk-line rounded-md px-3 py-1.5 text-sm text-mk-sec">
              <option>Pertinence</option>
              <option>Prix croissant</option>
              <option>Prix decroissant</option>
              <option>Meilleures notes</option>
            </select>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar - hidden on mobile, toggleable */}
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-60 shrink-0 ${showFilters ? 'absolute left-0 right-0 z-40 bg-white p-4 border-b border-mk-line lg:static lg:p-0 lg:border-0' : ''}`}>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Prix</h4>
              <div className="flex gap-2 h-10 items-end mb-2">
                {[12, 28, 45, 38, 22, 55, 15, 30].map((h, i) => (
                  <div key={i} className={`w-full rounded-t ${i === 5 ? "bg-mk-navy" : "bg-mk-alt"}`} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-mk-ter">
                <span>0 EUR</span><span>100 EUR</span>
              </div>
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Vendeur</h4>
              {sidebarSellers.map(s => (
                <label key={s} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                  <input type="checkbox" className="rounded border-mk-line" /> {s}
                </label>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Marque</h4>
              {sidebarBrands.map(b => (
                <label key={b} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                  <input type="checkbox" className="rounded border-mk-line" /> {b}
                </label>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Disponibilite</h4>
              {["En stock", "Stock limite", "Sur commande"].map(d => (
                <label key={d} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                  <input type="checkbox" className="rounded border-mk-line" /> {d}
                </label>
              ))}
            </div>
            {showFilters && (
              <button onClick={() => setShowFilters(false)} className="mt-4 w-full bg-mk-navy text-white text-sm py-2 rounded-md lg:hidden">
                Appliquer les filtres
              </button>
            )}
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <SkeletonList />
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
              </div>
            ) : view === "list" ? (
              <div className="border border-mk-line rounded-lg overflow-x-auto">
                <div className="grid grid-cols-[60px_1fr_80px_100px_80px_80px_100px] gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[700px]">
                  <span></span><span>Produit</span><span>CNK</span><span>Marque</span><span>Prix</span><span>Offres</span><span>Action</span>
                </div>
                {products.map(p => (
                  <Link key={p.id} to={`/produit/${p.slug}`} className="grid grid-cols-[60px_1fr_80px_100px_80px_80px_100px] gap-3 px-4 py-3 items-center border-t border-mk-line hover:bg-mk-alt text-sm min-w-[700px]">
                    <div className="w-12 h-12 bg-mk-alt rounded flex items-center justify-center text-[8px] text-mk-ter">IMG</div>
                    <span className="text-mk-text font-medium truncate">{p.name}</span>
                    <span className="text-mk-sec">{p.cnk}</span>
                    <span className="text-mk-sec">{p.brand}</span>
                    <span className="font-bold text-mk-navy">{formatPrice(p.price)} EUR</span>
                    <span className="text-mk-sec">{p.sellers}</span>
                    <button className="bg-mk-navy text-white text-xs font-semibold py-1.5 px-3 rounded-md">Ajouter</button>
                  </Link>
                ))}
              </div>
            ) : (
              /* Trivago view */
              <div className="space-y-4">
                <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
                  {[
                    { label: "Le meilleur", price: "12,90 EUR", sub: "qualite-prix", active: true },
                    { label: "Le moins cher", price: "4,03 EUR", sub: "", active: false },
                    { label: "Le plus rapide", price: "18,50 EUR", sub: "24h", active: false },
                  ].map(t => (
                    <button key={t.label} className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap ${t.active ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}>
                      {t.label} · {t.price} {t.sub && <span className="text-xs opacity-70">({t.sub})</span>}
                    </button>
                  ))}
                </div>
                {products.map((p, i) => (
                  <div key={p.id} className="border border-mk-line rounded-lg flex flex-col md:flex-row overflow-hidden animate-fadeInUp" style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="w-full md:w-[200px] shrink-0 relative p-4">
                      <span className="absolute top-3 left-3 bg-mk-red text-white text-[11px] font-bold px-2 py-0.5 rounded">{p.pct}%</span>
                      <div className="aspect-square bg-mk-alt rounded-lg flex items-center justify-center text-xs text-mk-ter">IMG</div>
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
                      <button className={`w-full py-2 rounded-md text-sm font-semibold ${p.mk ? "bg-mk-navy text-white" : "border border-mk-navy text-mk-navy"}`}>
                        {p.mk ? "Ajouter au panier" : "Voir l'offre"}
                        {!p.mk && <ExternalLink size={12} className="inline ml-1" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
