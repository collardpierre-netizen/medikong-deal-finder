import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { motion } from "framer-motion";
import { StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, slug, icon, image_url")
        .eq("is_active", true)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout
      title="Catégories de fournitures médicales | MediKong"
      description="Parcourez toutes les catégories de fournitures médicales : EPI, désinfection, instruments, pansements, diagnostic."
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
            Parcourez notre catalogue de fournitures médicales professionnelles.
          </motion.p>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Aucune catégorie disponible pour le moment.</p>
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {categories.map(cat => (
                <StaggerItem key={cat.slug}>
                  <HoverCard className="border border-mk-line rounded-xl bg-white">
                    <Link to={`/categorie/${cat.slug}`} className="flex flex-col items-center text-center p-8 gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-mk-alt flex items-center justify-center">
                        {cat.image_url ? (
                          <img src={cat.image_url} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <Package size={28} className="text-mk-blue" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-mk-navy mb-1">{cat.name_fr || cat.name}</h2>
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
