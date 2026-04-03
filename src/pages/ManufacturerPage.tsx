import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Check, Package, ExternalLink, Award, Globe, Factory, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";


const FLAG: Record<string, string> = { BE: "🇧🇪", FR: "🇫🇷", DE: "🇩🇪", NL: "🇳🇱", SE: "🇸🇪", DK: "🇩🇰", GB: "🇬🇧", US: "🇺🇸", CH: "🇨🇭", JP: "🇯🇵" };

const useManufacturer = (slug: string) =>
  useQuery({
    queryKey: ["manufacturer", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("manufacturers").select("*").eq("slug", slug).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

const useManufacturerBrands = (id: string | null) =>
  useQuery({
    queryKey: ["manufacturer-brands", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase.from("brands").select("*").eq("manufacturer_id", id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

const useManufacturerProducts = (id: string | null) =>
  useQuery({
    queryKey: ["manufacturer-products", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase.from("products").select("*").eq("manufacturer_id", id).eq("is_active", true).order("offer_count", { ascending: false }).limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

export default function ManufacturerPage() {
  const { slug } = useParams();
  const { data: manufacturer, isLoading } = useManufacturer(slug || "");
  const { data: brands = [] } = useManufacturerBrands(manufacturer?.id || null);
  const { data: products = [] } = useManufacturerProducts(manufacturer?.id || null);

  if (isLoading) {
    return <Layout><div className="mk-container py-12 text-center text-mk-sec">Chargement...</div></Layout>;
  }

  if (!manufacturer) {
    return <Layout><div className="mk-container py-12 text-center"><h1 className="text-xl font-bold text-mk-navy mb-2">Fabricant introuvable</h1><Link to="/fabricants" className="text-mk-blue text-sm">← Retour aux fabricants</Link></div></Layout>;
  }

  return (
    <Layout>
      <div className="mk-container py-3">
        <nav className="text-xs text-mk-sec flex items-center gap-1">
          <Link to="/" className="hover:text-mk-blue">Accueil</Link>
          <span>/</span>
          <Link to="/fabricants" className="hover:text-mk-blue">Fabricants</Link>
          <span>/</span>
          <span className="text-mk-navy font-medium">{manufacturer.name}</span>
        </nav>
      </div>

      <div className="bg-mk-alt py-8 md:py-10">
        <div className="mk-container">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            {manufacturer.logo_url ? (
              <img src={manufacturer.logo_url} alt={manufacturer.name} referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg object-contain p-2" />
            ) : (
              <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg flex items-center justify-center">
                <Factory size={32} className="text-mk-ter" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">{manufacturer.name}</h1>
                {manufacturer.is_active && <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">Vérifié</span>}
              </div>
              <p className="text-xs text-mk-sec mb-2">
                {manufacturer.country_of_origin && <>{FLAG[manufacturer.country_of_origin]} {manufacturer.country_of_origin}</>}
                {manufacturer.year_founded && <> · Fondé en {manufacturer.year_founded}</>}
                {manufacturer.legal_name && <> · {manufacturer.legal_name}</>}
              </p>
              {manufacturer.description && <p className="text-sm text-mk-sec max-w-[600px] mb-4">{manufacturer.description}</p>}
              <div className="flex gap-2 flex-wrap">
                {manufacturer.website_url && (
                  <a href={manufacturer.website_url} target="_blank" rel="noopener noreferrer" className="border border-mk-line text-sm px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec hover:border-mk-blue transition-colors">
                    <ExternalLink size={13} /> Site officiel
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-mk-line py-4 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-12 min-w-max">
          {[
            [String(brands.length), "Marques"],
            [String(manufacturer.product_count || 0), "Produits"],
          ].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-lg font-bold text-mk-navy">{v}</div>
              <div className="text-xs text-mk-sec">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        {/* Certifications */}
        {(manufacturer.certifications || []).length > 0 && (
          <>
            <h2 className="text-xl font-bold text-mk-navy mb-4">Certifications</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {(manufacturer.certifications as string[]).map(c => (
                <div key={c} className="border border-mk-line rounded-lg p-5 text-center">
                  <Award size={24} className="mx-auto text-mk-navy mb-2" />
                  <span className="text-sm font-medium text-mk-navy">{c}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Brands */}
        {brands.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-mk-navy mb-4 flex items-center gap-2"><Tag size={20} /> Marques de ce fabricant</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {brands.map(b => (
                <Link key={b.id} to={`/marque/${b.slug}`} className="border border-mk-line rounded-lg p-5 hover:shadow-sm transition-shadow hover:border-mk-blue">
                  <div className="flex items-center gap-3 mb-2">
                    {b.logo_url ? <img src={b.logo_url} alt={b.name} className="w-8 h-8 rounded object-contain" /> : <Tag size={16} className="text-mk-sec" />}
                    <h3 className="text-base font-bold text-mk-navy">{b.name}</h3>
                  </div>
                  <p className="text-xs text-mk-sec mb-2">{b.product_count || 0} produits</p>
                  <span className="text-xs text-mk-blue font-medium">Voir les produits →</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Products */}
        {products.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-mk-navy mb-4 flex items-center gap-2"><Package size={20} /> Produits populaires</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map(p => (
                <Link key={p.id} to={`/produit/${p.slug}`} className="border border-mk-line rounded-lg p-4 hover:shadow-sm hover:border-mk-blue transition-all group">
                  <img
                    src={p.image_urls?.[0] || "/medikong-placeholder.png"}
                    alt={p.name}
                    className="w-full h-32 object-contain mb-2 rounded"
                    onError={e => { e.currentTarget.src = "/medikong-placeholder.png"; }}
                  />
                  <h3 className="text-xs font-semibold text-mk-navy line-clamp-2 mb-1 group-hover:text-mk-blue">{p.name}</h3>
                  {p.best_price_excl_vat && <span className="text-sm font-bold text-mk-navy">€{Number(p.best_price_excl_vat).toFixed(2)}</span>}
                </Link>
              ))}
            </div>
          </>
        )}

        {products.length === 0 && brands.length === 0 && (
          <div className="text-center py-12">
            <Factory size={48} className="mx-auto text-mk-ter mb-3" />
            <p className="text-mk-sec">Aucun produit ou marque lié à ce fabricant pour le moment.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
