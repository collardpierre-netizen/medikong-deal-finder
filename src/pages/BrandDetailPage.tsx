import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { brands, sellers, sellerPortfolios } from "@/data/mock";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { Star, ExternalLink, Heart, Download, Upload, Users, Grid, List, Columns, Factory, Store, MapPin, ShoppingCart, Award } from "lucide-react";
import { useState } from "react";

const catChips = [
  { name: "Incontinence legere", count: 89 },
  { name: "Incontinence moderee", count: 67 },
  { name: "Incontinence severe", count: 45 },
  { name: "Hygiene", count: 33 },
];

export default function BrandDetailPage() {
  const { slug } = useParams();
  const { data: products = [] } = useProducts();
  const brand = brands.find(b => b.slug === slug) || { name: slug || "TENA", count: 234, slug: slug || "tena", manufacturer: "Essity AB", manufacturerSlug: "essity" };
  const [view, setView] = useState<"grid" | "list" | "trivago">("grid");
  const [showFilters, setShowFilters] = useState(false);

  // Find sellers that carry this brand
  const brandSellers = sellers.filter(s => sellerPortfolios[s.name]?.brands.includes(brand.name));

  // Find sibling brands from same manufacturer
  const siblingBrands = brands.filter(b => b.manufacturerSlug === brand.manufacturerSlug && b.slug !== brand.slug);

  return (
    <Layout>
      {/* Hero */}
      <div className="py-8 md:py-10" style={{ background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)" }}>
        <div className="mk-container">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg flex items-center justify-center text-xs text-mk-ter shrink-0">Logo</div>
            <div>
              <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy mb-1">{brand.name}</h1>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1 text-yellow-500">
                  {[1, 2, 3, 4].map(i => <Star key={i} size={14} fill="currentColor" />)}
                  <Star size={14} />
                </div>
                <span className="text-xs text-mk-sec">Belgique</span>
              </div>
              {/* Manufacturer link */}
              <div className="flex items-center gap-2 mb-3">
                <Factory size={14} className="text-mk-sec" />
                <span className="text-sm text-mk-sec">Fabricant :</span>
                <Link to={`/fabricant/${brand.manufacturerSlug}`} className="text-sm font-semibold text-mk-blue hover:underline">
                  {brand.manufacturer}
                </Link>
              </div>
              <p className="text-sm text-mk-sec max-w-[700px] mb-4">Marque leader en solutions d'hygiene et d'incontinence pour les professionnels de sante.</p>
              <div className="flex gap-2 flex-wrap">
                <button className="border border-mk-line text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec"><ExternalLink size={13} /> Site officiel</button>
                <button className="bg-mk-blue text-white text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5"><Download size={13} /> Catalogue</button>
                <button className="border border-mk-line text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec"><Heart size={13} /> Suivre</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-mk-alt border-y border-mk-line py-4 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-12 min-w-max">
          {[["234+", "Produits"], ["4", "Categories"], ["-45%", "Economie moy."], ["4.4/5", "Note"], [String(brandSellers.length), "Vendeurs"]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-lg font-bold text-mk-navy">{v}</div>
              <div className="text-xs text-mk-sec">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        {/* Sellers for this brand */}
        {brandSellers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-mk-navy mb-3 flex items-center gap-2"><Store size={18} /> Vendeurs proposant {brand.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {brandSellers.map(s => (
                <div key={s.name} className="border border-mk-line rounded-lg p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-mk-alt flex items-center justify-center text-sm font-bold text-mk-navy shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-mk-navy">{s.name}</span>
                      {s.verified && <span className="text-[10px] bg-mk-deal text-mk-green px-1.5 py-0.5 rounded font-medium">Vérifié</span>}
                      {s.topRated && <span className="text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded font-medium">Top</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-mk-sec mt-0.5">
                      <span className="flex items-center gap-1"><MapPin size={10} />{s.location}</span>
                      <span className="flex items-center gap-1"><Star size={10} fill="currentColor" className="text-yellow-500" />{s.rating}</span>
                      <span className="flex items-center gap-1"><ShoppingCart size={10} />{s.orders.toLocaleString("fr-BE")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sibling brands from same manufacturer */}
        {siblingBrands.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-mk-navy mb-3 flex items-center gap-2"><Award size={18} /> Autres marques de {brand.manufacturer}</h2>
            <div className="flex gap-2 flex-wrap">
              {siblingBrands.map(b => (
                <Link key={b.slug} to={`/marque/${b.slug}`} className="border border-mk-line rounded-full px-4 py-1.5 text-sm text-mk-sec hover:border-mk-blue hover:text-mk-blue transition-colors">
                  {b.name} ({b.count})
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Import CTA */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-mk-blue shrink-0" />
            <span className="text-sm text-mk-navy">Importez votre liste de produits pour des prix personnalises</span>
          </div>
          <button className="bg-mk-blue text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 whitespace-nowrap">
            <Upload size={13} /> Importer
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {catChips.map((c, i) => (
            <button key={c.name} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${i === 0 ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}>
              {c.name} ({c.count})
            </button>
          ))}
        </div>

        {/* Group buy CTA */}
        <div className="rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)" }}>
          <div className="flex items-center gap-3">
            <Users size={18} className="text-mk-amber shrink-0" />
            <div>
              <span className="text-sm font-bold text-mk-navy">Achat groupe {brand.name}</span>
              <p className="text-xs text-mk-sec">Regroupez vos commandes avec d'autres pharmacies</p>
            </div>
          </div>
          <button className="bg-mk-amber text-white text-sm font-semibold px-4 py-2 rounded-md whitespace-nowrap">Rejoindre le groupe</button>
        </div>

        <div className="flex gap-7">
          {/* Sidebar */}
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-[220px] shrink-0 lg:sticky lg:top-20 lg:self-start ${showFilters ? 'mb-4' : ''}`}>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Preferences</h4>
              {["Tout afficher", "Mes favoris", "Prix cible atteint"].map((p, i) => (
                <label key={p} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                  <input type="radio" name="pref" defaultChecked={i === 0} className="text-mk-navy" /> {p}
                </label>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Prix</h4>
              <div className="flex gap-2">
                <input placeholder="Min" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
                <input placeholder="Max" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Disponibilite</h4>
              <label className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                <input type="checkbox" /> En stock
              </label>
              <label className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer">
                <input type="checkbox" /> MediKong uniquement
              </label>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-5 gap-3">
              <span className="text-sm text-mk-sec">{brand.count} produits</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowFilters(!showFilters)} className="lg:hidden border border-mk-line text-sm px-3 py-1.5 rounded-md text-mk-sec">Filtres</button>
                <div className="flex border border-mk-line rounded-md overflow-hidden">
                  {([["grid", Grid], ["list", List], ["trivago", Columns]] as const).map(([v, Icon]) => (
                    <button key={v} onClick={() => setView(v)} className={`p-2 ${view === v ? "bg-mk-navy text-white" : "text-mk-sec"}`}><Icon size={16} /></button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
