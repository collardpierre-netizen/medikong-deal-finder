import { Layout } from "@/components/layout/Layout";
import { UniversePills } from "@/components/layout/UniversePills";
import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function BrandsPage() {
  const [activeLetter, setActiveLetter] = useState("A");

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, product_count")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []).map(b => ({
        ...b,
        letter: (b.name?.[0] || "?").toUpperCase(),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const grouped = brands.reduce((acc, b) => {
    (acc[b.letter] = acc[b.letter] || []).push(b);
    return acc;
  }, {} as Record<string, typeof brands>);

  const totalProducts = brands.reduce((s, b) => s + (b.product_count || 0), 0);

  return (
    <Layout>
      <PageTransition>
        <UniversePills />
        <div className="mk-container py-6 md:py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy mb-1">Toutes nos marques</h1>
            <p className="text-sm text-mk-sec mb-6">
              {brands.length}+ marques référencées · {totalProducts.toLocaleString("fr-FR")}+ produits
            </p>
          </motion.div>

          <motion.div
            className="flex gap-1.5 mb-8 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {letters.map((l, i) => (
              <motion.button
                key={l}
                onClick={() => setActiveLetter(l)}
                className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${
                  l === activeLetter ? "bg-mk-navy text-white" : grouped[l] ? "border border-mk-line text-mk-sec hover:border-mk-navy" : "text-mk-ter/40 cursor-default"
                }`}
                disabled={!grouped[l]}
                whileHover={grouped[l] ? { scale: 1.15 } : {}}
                whileTap={grouped[l] ? { scale: 0.9 } : {}}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.015 }}
              >
                {l}
              </motion.button>
            ))}
          </motion.div>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <Skeleton className="h-8 w-12 mb-4" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(j => <Skeleton key={j} className="h-5 w-40" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            Object.entries(grouped).sort().map(([letter, list], gi) => (
              <motion.div
                key={letter}
                className="mb-8"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + gi * 0.05 }}
              >
                <h2 className="text-xl font-bold text-mk-navy pb-2 border-b border-mk-line mb-4">{letter}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {list.map((b, i) => (
                    <motion.div
                      key={b.slug}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 + gi * 0.05 + i * 0.03 }}
                    >
                      <Link to={`/marque/${b.slug}`} className="text-sm font-medium text-mk-navy hover:text-mk-blue transition-colors">
                        {b.name} <span className="text-mk-ter font-normal">({b.product_count || 0})</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}
