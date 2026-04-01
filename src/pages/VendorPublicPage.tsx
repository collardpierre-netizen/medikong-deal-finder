import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/shared/ProductCard";
import { motion } from "framer-motion";
import {
  Store, MapPin, Globe, Phone, Mail, Shield, Award, Clock,
  Star, Package, Truck, ShoppingCart, Grid, List,
  CheckCircle2, Building2,
} from "lucide-react";
import { useState } from "react";
import { getVendorPublicName } from "@/lib/vendor-display";

export default function VendorPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [view, setView] = useState<"grid" | "list">("grid");

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
        .from("offers")
        .select("*, products(*)")
        .eq("vendor_id", vendor!.id)
        .eq("is_active", true)
        .limit(50);
      return data || [];
    },
    enabled: !!vendor?.id,
  });

  const vendorProducts = offers
    .filter((o: any) => o.products)
    .map((o: any) => {
      const p = o.products;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: "",
        price: o.price_excl_vat,
        image: p.image_urls?.[0],
        stock: o.stock_quantity > 0,
      };
    });

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
    { icon: Star, label: "Note", value: vendor.rating ? `${Number(vendor.rating).toFixed(1)}/5` : "–" },
    { icon: Truck, label: "Ventes", value: vendor.total_sales || "–" },
    { icon: Clock, label: "Membre depuis", value: new Date(vendor.created_at).getFullYear().toString() },
  ];

  return (
    <Layout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden">
        <div className="h-32 md:h-44" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }} />
        <div className="mk-container relative -mt-12 md:-mt-14 pb-6">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl border-4 border-background bg-background shadow-lg flex items-center justify-center shrink-0 overflow-hidden">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.company_name || vendor.name} className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-2xl font-bold text-primary">{(vendor.company_name || vendor.name)[0]}</span>
              )}
            </div>
            <div className="flex-1 pt-2 sm:pt-6">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold text-foreground">{vendor.company_name || vendor.name}</h1>
                {vendor.is_verified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={10} /> Vérifié
                  </span>
                )}
              </div>
              {vendor.description && <p className="text-sm text-muted-foreground mb-2">{vendor.description}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {vendor.city && <span className="flex items-center gap-1"><MapPin size={12} /> {vendor.city}, {vendor.country_code}</span>}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

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
          <aside className="hidden lg:block w-[240px] shrink-0 space-y-5">
            {vendor.description && (
              <div className="border border-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Building2 size={14} /> À propos</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{vendor.description}</p>
              </div>
            )}
            <div className="border border-border rounded-xl p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Mail size={14} /> Contact</h3>
              {vendor.email && <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"><Mail size={12} /> {vendor.email}</a>}
              {vendor.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone size={12} /> {vendor.phone}</div>}
              {vendor.address_line1 && <div className="flex items-start gap-2 text-xs text-muted-foreground"><MapPin size={12} className="mt-0.5 shrink-0" /><span>{vendor.address_line1}{vendor.postal_code && `, ${vendor.postal_code}`}{vendor.city && ` ${vendor.city}`}</span></div>}
            </div>
            {vendor.is_verified && (
              <div className="border border-border rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Shield size={14} /> Garanties</h3>
                <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={12} /> Vendeur vérifié</div>
                {vendor.vat_number && <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 size={12} /> TVA enregistrée</div>}
              </div>
            )}
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5 gap-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Package size={18} /> Catalogue ({vendorProducts.length})</h2>
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
