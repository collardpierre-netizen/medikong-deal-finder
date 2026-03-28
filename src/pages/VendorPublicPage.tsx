import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { motion } from "framer-motion";
import {
  Store, MapPin, Globe, Phone, Mail, Shield, Award, Clock,
  Star, Package, Truck, ShoppingCart, Grid, List, ExternalLink,
  CheckCircle2, Building2, Calendar, ChevronRight,
} from "lucide-react";
import { useState } from "react";

export default function VendorPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [view, setView] = useState<"grid" | "list">("grid");

  // Fetch vendor by slug
  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-public", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch vendor's offers with product info
  const { data: offers = [] } = useQuery({
    queryKey: ["vendor-offers-public", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("offers_direct")
        .select("*, products(*)")
        .eq("vendor_id", vendor!.id)
        .eq("status", "active")
        .limit(50);
      return data || [];
    },
    enabled: !!vendor?.id,
  });

  // Fetch vendor's brands
  const { data: vendorBrands = [] } = useQuery({
    queryKey: ["vendor-brands", vendor?.id],
    queryFn: async () => {
      const productIds = offers.map((o: any) => o.product_id);
      if (productIds.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("brand, brand_id")
        .in("id", productIds);
      const uniqueBrands = [...new Set((data || []).map((p: any) => p.brand))];
      return uniqueBrands;
    },
    enabled: offers.length > 0,
  });

  // Also get all products for display via useProducts (fallback for catalog display)
  const { data: allProducts = [] } = useProducts();

  // Map offers to product display
  const vendorProducts = offers
    .filter((o: any) => o.products)
    .map((o: any) => {
      const p = o.products;
      return {
        id: p.id,
        slug: p.product_name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        name: p.product_name,
        brand: p.brand,
        price: o.price_ht,
        originalPrice: p.rrp_eur || undefined,
        image: p.primary_image_url,
        gtin: p.gtin,
        unit: `${p.weight_g}g`,
        stock: o.stock > 0,
        category: p.category_l1,
      };
    });

  // Tier badge colors
  const tierColors: Record<string, string> = {
    Bronze: "bg-orange-100 text-orange-700 border-orange-200",
    Silver: "bg-gray-100 text-gray-700 border-gray-200",
    Gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
    Platinum: "bg-purple-100 text-purple-700 border-purple-200",
    Strategic: "bg-blue-100 text-blue-700 border-blue-200",
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-accent rounded mx-auto" />
            <div className="h-4 w-64 bg-accent rounded mx-auto" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!vendor) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <Store size={48} className="mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Vendeur introuvable</h1>
          <p className="text-muted-foreground mb-6">Ce profil vendeur n'existe pas ou n'est pas public.</p>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </div>
      </Layout>
    );
  }

  const stats = [
    { icon: Package, label: "Produits", value: vendorProducts.length || "–" },
    { icon: Star, label: "Note", value: vendor.internal_score ? `${(vendor.internal_score / 20).toFixed(1)}/5` : "–" },
    { icon: Truck, label: "Livraison", value: vendor.delivery_days ? `${vendor.delivery_days}j` : "–" },
    { icon: ShoppingCart, label: "MOQ", value: vendor.min_order_ht ? `${vendor.min_order_ht} €` : "–" },
    { icon: Clock, label: "Membre depuis", value: vendor.activation_date ? new Date(vendor.activation_date).getFullYear().toString() : new Date(vendor.created_at).getFullYear().toString() },
  ];

  return (
    <Layout>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden"
      >
        {/* Cover image or gradient */}
        <div
          className="h-32 md:h-44"
          style={{
            background: vendor.cover_image_url
              ? `url(${vendor.cover_image_url}) center/cover`
              : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
          }}
        />

        <div className="mk-container relative -mt-12 md:-mt-14 pb-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            {/* Logo */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl border-4 border-background bg-background shadow-lg flex items-center justify-center shrink-0 overflow-hidden">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.company_name} className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-2xl font-bold text-primary">{vendor.company_name[0]}</span>
              )}
            </div>

            <div className="flex-1 pt-2 sm:pt-6">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold text-foreground">
                  {vendor.display_name || vendor.company_name}
                </h1>
                {vendor.status === "active" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> Vérifié
                  </span>
                )}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tierColors[vendor.tier] || tierColors.Bronze}`}>
                  {vendor.tier}
                </span>
              </div>

              {vendor.tagline && (
                <p className="text-sm text-muted-foreground mb-2">{vendor.tagline}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {vendor.city && vendor.country && (
                  <span className="flex items-center gap-1"><MapPin size={12} /> {vendor.city}, {vendor.country}</span>
                )}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <Globe size={12} /> Site web
                  </a>
                )}
                {(vendor.languages || []).length > 0 && (
                  <span className="flex items-center gap-1">🗣 {(vendor.languages || []).join(", ").toUpperCase()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats bar */}
      <div className="bg-accent/50 border-y border-border py-3 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-10 min-w-max">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Icon size={14} className="text-primary" />
                <span className="text-base font-bold text-foreground">{value}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        <div className="flex gap-7">
          {/* Sidebar */}
          <aside className="hidden lg:block w-[240px] shrink-0 space-y-5">
            {/* About */}
            {vendor.about_text && (
              <div className="border border-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <Building2 size={14} /> À propos
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{vendor.about_text}</p>
              </div>
            )}

            {/* Contact */}
            <div className="border border-border rounded-xl p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Mail size={14} /> Contact
              </h3>
              {vendor.email && (
                <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Mail size={12} /> {vendor.email}
                </a>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone size={12} /> {vendor.phone}
                </div>
              )}
              {vendor.address && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  <span>{vendor.address}{vendor.postal_code && `, ${vendor.postal_code}`}{vendor.city && ` ${vendor.city}`}</span>
                </div>
              )}
            </div>

            {/* Certifications / trust */}
            <div className="border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Shield size={14} /> Garanties
              </h3>
              {vendor.vat_verified && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 size={12} /> TVA vérifiée
                </div>
              )}
              {vendor.wholesale_license && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 size={12} /> Licence grossiste
                </div>
              )}
              {vendor.afmps_number && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 size={12} /> AFMPS enregistré
                </div>
              )}
              {vendor.insurance_provider && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle2 size={12} /> Assuré ({vendor.insurance_provider})
                </div>
              )}
              {vendor.payment_terms && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar size={12} /> Paiement : {vendor.payment_terms}
                </div>
              )}
            </div>

            {/* Brands carried */}
            {vendorBrands.length > 0 && (
              <div className="border border-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  <Award size={14} /> Marques
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(vendorBrands as string[]).slice(0, 12).map((b) => (
                    <span key={b} className="text-[11px] bg-accent text-foreground px-2 py-1 rounded-full border border-border">
                      {b}
                    </span>
                  ))}
                  {vendorBrands.length > 12 && (
                    <span className="text-[11px] text-muted-foreground px-2 py-1">+{vendorBrands.length - 12}</span>
                  )}
                </div>
              </div>
            )}

            {/* Shipping */}
            <div className="border border-border rounded-xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Truck size={14} /> Livraison
              </h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {vendor.delivery_days && <p>Délai standard : {vendor.delivery_days} jour{vendor.delivery_days > 1 ? "s" : ""}</p>}
                {vendor.franco_ht != null && vendor.franco_ht > 0 && <p>Franco : {vendor.franco_ht} € HT</p>}
                {vendor.min_order_ht != null && vendor.min_order_ht > 0 && <p>Commande min. : {vendor.min_order_ht} € HT</p>}
              </div>
            </div>
          </aside>

          {/* Main content — catalog */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5 gap-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Package size={18} /> Catalogue ({vendorProducts.length})
              </h2>
              <div className="flex border border-border rounded-lg overflow-hidden">
                {([["grid", Grid], ["list", List]] as const).map(([v, Icon]) => (
                  <button key={v} onClick={() => setView(v)} className={`p-2 transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            {vendorProducts.length > 0 ? (
              <div className={view === "grid" ? "grid grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-3"}>
                {vendorProducts.map((p: any, i: number) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-border rounded-xl">
                <Package size={40} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucun produit disponible pour le moment</p>
              </div>
            )}

            {/* Mobile sidebar info */}
            <div className="lg:hidden mt-8 space-y-4">
              {vendor.about_text && (
                <div className="border border-border rounded-xl p-4">
                  <h3 className="text-sm font-bold text-foreground mb-2">À propos</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{vendor.about_text}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-xl p-3">
                  <h4 className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1"><Shield size={12} /> Garanties</h4>
                  <div className="space-y-1">
                    {vendor.vat_verified && <p className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> TVA vérifiée</p>}
                    {vendor.wholesale_license && <p className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Licence grossiste</p>}
                    {vendor.afmps_number && <p className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> AFMPS</p>}
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3">
                  <h4 className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1"><Truck size={12} /> Livraison</h4>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    {vendor.delivery_days && <p>Délai : {vendor.delivery_days}j</p>}
                    {vendor.franco_ht != null && vendor.franco_ht > 0 && <p>Franco : {vendor.franco_ht} €</p>}
                  </div>
                </div>
              </div>

              {vendorBrands.length > 0 && (
                <div className="border border-border rounded-xl p-4">
                  <h3 className="text-sm font-bold text-foreground mb-2">Marques</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(vendorBrands as string[]).slice(0, 8).map((b) => (
                      <span key={b} className="text-[11px] bg-accent text-foreground px-2 py-1 rounded-full border border-border">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}