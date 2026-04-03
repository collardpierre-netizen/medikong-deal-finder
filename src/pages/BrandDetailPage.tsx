import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { Star, ExternalLink, Heart, Download, Upload, Users, Grid, List, Columns, Factory, Store, MapPin, ShoppingCart, Award, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function BrandDetailPage() {
  const { slug } = useParams();
  const { data: products = [] } = useFeaturedProducts(30, { brandSlug: slug });
  const [view, setView] = useState<"grid" | "list" | "trivago">("grid");
  const [showFilters, setShowFilters] = useState(false);

  const { data: brandData } = useQuery({
    queryKey: ["brand-detail", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, website_url, product_count, manufacturer_id, manufacturers(name, slug)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: brandSellers = [] } = useQuery({
    queryKey: ["brand-sellers", brandData?.id],
    enabled: !!brandData?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("vendor_id, vendors(id, name, slug, is_verified, rating, total_sales, country_code), products!inner(brand_id)")
        .eq("is_active", true)
        .eq("products.brand_id", brandData!.id)
        .limit(300);
      if (error) throw error;

      const dedup = new Map<string, {
        id: string;
        name: string;
        slug: string;
        verified: boolean;
        topRated: boolean;
        location: string;
        rating: number;
        orders: number;
      }>();

      for (const row of data || []) {
        const v = row.vendors as any;
        if (!v?.id || dedup.has(v.id)) continue;
        dedup.set(v.id, {
          id: v.id,
          name: v.name || "Vendeur",
          slug: v.slug || "",
          verified: !!v.is_verified,
          topRated: (Number(v.rating) || 0) >= 4.5,
          location: v.country_code || "BE",
          rating: Number(v.rating) || 0,
          orders: Number(v.total_sales) || 0,
        });
      }

      return [...dedup.values()];
    },
  });

  const { data: siblingBrands = [] } = useQuery({
    queryKey: ["brand-siblings", brandData?.manufacturer_id, brandData?.slug],
    enabled: !!brandData?.manufacturer_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("name, slug, product_count")
        .eq("is_active", true)
        .eq("manufacturer_id", brandData!.manufacturer_id)
        .neq("slug", brandData!.slug)
        .order("product_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: catChips = [] } = useQuery({
    queryKey: ["brand-category-chips", brandData?.id],
    enabled: !!brandData?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category_name")
        .eq("brand_id", brandData!.id)
        .eq("is_active", true)
        .gt("offer_count", 0)
        .limit(2000);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        const name = row.category_name || "Autres";
        counts.set(name, (counts.get(name) || 0) + 1);
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({ name, count }));
    },
  });

  const brand = {
    name: brandData?.name || slug || "Marque",
    slug: brandData?.slug || slug || "marque",
    count: Number(brandData?.product_count) || products.length,
    manufacturer: (brandData?.manufacturers as any)?.name || "Fabricant non renseigné",
    manufacturerSlug: (brandData?.manufacturers as any)?.slug || "",
    description: brandData?.description || "Marque partenaire disponible sur MediKong pour les professionnels de santé.",
    logoUrl: brandData?.logo_url || null,
    websiteUrl: brandData?.website_url || null,
  };

  return (
    <Layout>
      {/* Hero */}
      <div className="py-8 md:py-10" style={{ background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)" }}>
        <div className="mk-container">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg flex items-center justify-center text-xs text-mk-ter shrink-0 overflow-hidden">
              {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-2" /> : "Logo"}
            </div>
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
                {brand.manufacturerSlug ? (
                  <Link to={`/fabricant/${brand.manufacturerSlug}`} className="text-sm font-semibold text-mk-blue hover:underline">
                    {brand.manufacturer}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-mk-navy">{brand.manufacturer}</span>
                )}
              </div>
              <p className="text-sm text-mk-sec max-w-[700px] mb-4">{brand.description}</p>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={brand.websiteUrl || undefined}
                  target={brand.websiteUrl ? "_blank" : undefined}
                  rel={brand.websiteUrl ? "noreferrer" : undefined}
                  className={`border border-mk-line text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5 ${brand.websiteUrl ? "text-mk-sec hover:border-mk-blue" : "text-mk-ter cursor-not-allowed"}`}
                >
                  <ExternalLink size={13} /> Site officiel
                </a>
                <Link to={`/catalogue?brand=${brand.slug}`} className="bg-mk-blue text-white text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5">
                  <Download size={13} /> Catalogue
                </Link>
                <button className="border border-mk-line text-sm px-3 md:px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec"><Heart size={13} /> Suivre</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-mk-alt border-y border-mk-line py-4 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-12 min-w-max">
          {[
            [brand.count.toLocaleString("fr-BE"), "Produits"],
            [String(catChips.length || 0), "Catégories"],
            [products.length > 0 ? `${Math.round(products.reduce((s, p) => s + (p.pct || 0), 0) / products.length)}%` : "0%", "Économie moy."],
            [brandSellers.length > 0 ? `${(brandSellers.reduce((s, v) => s + (v.rating || 0), 0) / brandSellers.length).toFixed(1)}/5` : "-", "Note"],
            [String(brandSellers.length), "Vendeurs"],
          ].map(([v, l]) => (
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
                <Link key={s.id} to={`/vendeur/${s.slug}`} className="border border-mk-line rounded-lg p-4 flex items-center gap-3 hover:shadow-sm hover:border-mk-blue transition-all">
                  <div className="w-10 h-10 rounded-full bg-mk-alt flex items-center justify-center text-sm font-bold text-mk-navy shrink-0">
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-mk-navy">{s.name}</span>
                      {s.verified && <span className="text-[10px] bg-mk-deal text-mk-green px-1.5 py-0.5 rounded font-medium">Vérifié</span>}
                      {s.topRated && <span className="text-[10px] bg-mk-deal text-mk-green px-1.5 py-0.5 rounded font-medium">Top</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-mk-sec mt-0.5">
                      <span className="flex items-center gap-1"><MapPin size={10} />{s.location}</span>
                      <span className="flex items-center gap-1"><Star size={10} fill="currentColor" className="text-mk-amber" />{s.rating || "-"}</span>
                      <span className="flex items-center gap-1"><ShoppingCart size={10} />{s.orders.toLocaleString("fr-BE")}</span>
                    </div>
                  </div>
                </Link>
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
                  {b.name} ({b.product_count || 0})
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Import CTA */}
        <div className="bg-mk-alt border border-mk-line rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-mk-blue shrink-0" />
            <span className="text-sm text-mk-navy">Importez votre liste de produits pour des prix personnalisés</span>
          </div>
          <button className="bg-mk-blue text-white text-sm font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 whitespace-nowrap">
            <Upload size={13} /> Importer
          </button>
        </div>

        {/* Category chips */}
        {catChips.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {catChips.map((c, i) => (
              <button key={c.name} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${i === 0 ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}>
                {c.name} ({c.count})
              </button>
            ))}
          </div>
        )}

        {/* Group buy CTA */}
        <div className="rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)" }}>
          <div className="flex items-center gap-3">
            <Users size={18} className="text-mk-amber shrink-0" />
            <div>
              <span className="text-sm font-bold text-mk-navy">Achat groupe {brand.name}</span>
              <p className="text-xs text-mk-sec">Regroupez vos commandes avec d'autres pharmacies</p>
            </div>
          </div>
          <Link to={`/sourcing?brand=${encodeURIComponent(brand.name)}`} className="bg-mk-amber text-white text-sm font-semibold px-4 py-2 rounded-md whitespace-nowrap">
            Rejoindre le groupe
          </Link>
        </div>

        <div className="flex gap-7">
          {/* Sidebar */}
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-[220px] shrink-0 lg:sticky lg:top-20 lg:self-start ${showFilters ? 'mb-4' : ''}`}>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Préférences</h4>
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
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Disponibilité</h4>
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
              <span className="text-sm text-mk-sec">{brand.count.toLocaleString("fr-BE")} produits</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowFilters(!showFilters)} className="lg:hidden border border-mk-line text-sm px-3 py-1.5 rounded-md text-mk-sec">Filtres</button>
                <div className="flex border border-mk-line rounded-md overflow-hidden">
                  {([ ["grid", Grid], ["list", List], ["trivago", Columns] ] as const).map(([v, Icon]) => (
                    <button key={v} onClick={() => setView(v)} className={`p-2 ${view === v ? "bg-mk-navy text-white" : "text-mk-sec"}`}><Icon size={16} /></button>
                  ))}
                </div>
              </div>
            </div>
            {view === "trivago" ? (
              <div className="space-y-3">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 border border-mk-line rounded-lg p-3 hover:shadow-sm transition-shadow bg-white">
                    <div className="w-16 h-16 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                      <img src={p.imageUrl || "/medikong-placeholder.png"} alt={p.name} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).src = '/medikong-placeholder.png'; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/produit/${p.slug}`} className="text-sm font-semibold text-mk-navy hover:text-mk-blue line-clamp-1">{p.name}</Link>
                      <p className="text-xs text-muted-foreground">{p.brand} · {p.gtin}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-mk-green">{p.price.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} €</p>
                      {p.sellers > 0 && <p className="text-[11px] text-muted-foreground">{p.sellers} offre{p.sellers > 1 ? "s" : ""}</p>}
                    </div>
                    {p.pct > 0 && <span className="text-xs font-semibold bg-mk-red text-white px-2 py-0.5 rounded shrink-0">{p.pct}%</span>}
                  </div>
                ))}
              </div>
            ) : view === "list" ? (
              <div className="space-y-3">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 border border-mk-line rounded-lg p-4 hover:shadow-sm transition-shadow bg-white">
                    <div className="w-20 h-20 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                      <img src={p.imageUrl || "/medikong-placeholder.png"} alt={p.name} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).src = '/medikong-placeholder.png'; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/produit/${p.slug}`} className="text-sm font-semibold text-mk-navy hover:text-mk-blue line-clamp-2">{p.name}</Link>
                      <p className="text-xs text-muted-foreground mt-1">{p.brand} · EAN {p.gtin}</p>
                      {p.descriptionShort && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.descriptionShort}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-base font-bold text-mk-green">{p.price.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} €</p>
                      {p.pub > 0 && p.pct > 0 && <p className="text-xs text-muted-foreground line-through">{p.pub.toLocaleString("fr-BE", { minimumFractionDigits: 2 })} €</p>}
                      {p.sellers > 0 && <p className="text-xs text-muted-foreground">{p.sellers} offre{p.sellers > 1 ? "s" : ""}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
