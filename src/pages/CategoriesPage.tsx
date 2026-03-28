import { Layout } from "@/components/layout/Layout";
import { Link } from "react-router-dom";
import { categories } from "@/data/mock";
import { Shield, Droplets, Wrench, Heart, Activity, Droplet, Armchair, Package } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem, HoverCard } from "@/components/shared/PageTransition";

const iconComponents: Record<string, React.ReactNode> = {
  Shield: <Shield size={28} className="text-mk-blue" />,
  Droplets: <Droplets size={28} className="text-mk-blue" />,
  Wrench: <Wrench size={28} className="text-mk-blue" />,
  Heart: <Heart size={28} className="text-mk-blue" />,
  Activity: <Activity size={28} className="text-mk-blue" />,
  Droplet: <Droplet size={28} className="text-mk-blue" />,
  Armchair: <Armchair size={28} className="text-mk-blue" />,
  Package: <Package size={28} className="text-mk-blue" />,
};

export default function CategoriesPage() {
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
            className="text-base text-gray-600 mb-10 max-w-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Parcourez notre catalogue de fournitures médicales professionnelles.
          </motion.p>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map(cat => (
              <StaggerItem key={cat.slug}>
                <HoverCard className="border border-mk-line rounded-xl bg-white">
                  <Link to={`/categorie/${cat.slug}`} className="flex flex-col items-center text-center p-8 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-mk-alt flex items-center justify-center">
                      {iconComponents[cat.icon]}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-mk-navy mb-1">{cat.name}</h2>
                      <p className="text-sm text-gray-500">{cat.count} produits</p>
                    </div>
                  </Link>
                </HoverCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>
    </Layout>
  );
}
