import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import {
  Package, Scissors, Droplets, Sun, Smile, Eye, Wind, Shield, Pill,
  Home, User, PawPrint, Apple, Paintbrush, Bath, Palette, Baby
} from "lucide-react";
import { motion } from "framer-motion";
import { StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, React.ReactNode> = {
  Baby: <Baby size={28} className="text-mk-blue" />,
  Scissors: <Scissors size={28} className="text-mk-blue" />,
  Droplets: <Droplets size={28} className="text-mk-blue" />,
  Sun: <Sun size={28} className="text-mk-blue" />,
  Smile: <Smile size={28} className="text-mk-blue" />,
  Paintbrush: <Paintbrush size={28} className="text-mk-blue" />,
  Eye: <Eye size={28} className="text-mk-blue" />,
  Bath: <Bath size={28} className="text-mk-blue" />,
  Wind: <Wind size={28} className="text-mk-blue" />,
  Palette: <Palette size={28} className="text-mk-blue" />,
  Pill: <Pill size={28} className="text-mk-blue" />,
  Shield: <Shield size={28} className="text-mk-blue" />,
  Apple: <Apple size={28} className="text-mk-blue" />,
  User: <User size={28} className="text-mk-blue" />,
  PawPrint: <PawPrint size={28} className="text-mk-blue" />,
  Home: <Home size={28} className="text-mk-blue" />,
  Package: <Package size={28} className="text-mk-blue" />,
};

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories-page"],
    queryFn: async () => {
      // Get categories with product counts
      const { data: cats, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, slug, icon, image_url")
        .eq("is_active", true)
        .order("display_order")
        .order("name");
      if (error) throw error;

      // Get product counts per category
      const { data: counts } = await supabase
        .from("products")
        .select("category_id")
        .eq("is_active", true)
        .gt("offer_count", 0)
        .limit(5000);

      const countMap = new Map<string, number>();
      for (const row of counts || []) {
        if (row.category_id) {
          countMap.set(row.category_id, (countMap.get(row.category_id) || 0) + 1);
        }
      }

      return (cats || [])
        .map(c => ({ ...c, productCount: countMap.get(c.id) || 0 }))
        .sort((a, b) => b.productCount - a.productCount);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Show only categories with products
  const activeCategories = categories.filter(c => c.productCount > 0);

  return (
    <Layout
      title="Catégories de produits | MediKong"
      description="Parcourez toutes les catégories de produits disponibles sur MediKong."
    >
      <section className="py-12 md:py-20">
        <div className="mk-container">
          <motion.h1
            className="text-3xl md:text-4xl font-bold text-mk-navy mb-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Toutes les catégories
          </motion.h1>
          <motion.p
            className="text-base text-muted-foreground mb-10 max-w-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {activeCategories.length} catégories avec des produits disponibles.
          </motion.p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : activeCategories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Aucune catégorie disponible pour le moment.</p>
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {activeCategories.map(cat => (
                <StaggerItem key={cat.slug}>
                  <HoverCard className="border border-mk-line rounded-xl bg-white">
                    <Link to={`/categorie/${cat.slug}`} className="flex flex-col items-center text-center p-8 gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-mk-alt flex items-center justify-center">
                        {cat.image_url ? (
                          <img src={cat.image_url} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          iconMap[cat.icon || "Package"] || <Package size={28} className="text-mk-blue" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-mk-navy mb-1">{cat.name_fr || cat.name}</h2>
                        <p className="text-sm text-muted-foreground">{cat.productCount.toLocaleString("fr-FR")} produits</p>
                      </div>
                    </Link>
                  </HoverCard>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </div>
      </section>
    </Layout>
  );
}
