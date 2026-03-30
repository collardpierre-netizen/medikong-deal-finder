import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useFeaturedProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { Tag, TrendingDown, Truck, Calendar } from "lucide-react";
import { useState, useEffect } from "react";

export default function PromotionsPage() {
  const { data: products = [] } = useProducts();
  const [activeFilter, setActiveFilter] = useState(0);
  const filters = ["Toutes", "-20% et plus", "-40% et plus", "Flash (< 24h)"];

  const [countdown, setCountdown] = useState({ d: 6, h: 14, m: 32 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        let { d, h, m } = prev;
        m--;
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; d--; }
        if (d < 0) d = 0;
        return { d, h, m };
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const promos = [
    { title: "Black friday medical 2026", date: "02 avril 2026" },
    { title: "Promo fournisseurs Ecolab", date: "15 avril 2026" },
    { title: "Nettoyage de printemps", date: "30 avril 2026" },
  ];

  return (
    <Layout>
      {/* Hero */}
      <div className="py-8 md:py-10" style={{ background: "linear-gradient(135deg, #1E293B, #1B5BDA)" }}>
        <div className="mk-container text-center">
          <h1 className="text-2xl md:text-[32px] font-bold text-white mb-2">Promotions en cours</h1>
          <p className="text-sm text-white/70 mb-6">Profitez des meilleures offres sur les fournitures medicales</p>
          <div className="flex justify-center gap-3">
            {[
              [countdown.d, "jours"],
              [countdown.h, "heures"],
              [countdown.m, "minutes"],
            ].map(([v, l]) => (
              <div key={l as string} className="px-4 md:px-5 py-3 rounded-lg text-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <div className="text-xl md:text-2xl font-bold text-white">{String(v).padStart(2, "0")}</div>
                <div className="text-xs text-white/60">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Tag, value: "847 produits en promo", color: "text-mk-navy" },
            { icon: TrendingDown, value: "Jusqu'a -65%", color: "text-mk-red" },
            { icon: Truck, value: "Livraison incluse", color: "text-mk-green" },
          ].map(s => (
            <div key={s.value} className="border border-mk-line rounded-lg p-4 flex items-center gap-3">
              <s.icon size={20} className={s.color} />
              <span className="text-sm font-semibold text-mk-navy">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filters.map((f, i) => (
            <button key={f} onClick={() => setActiveFilter(i)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${i === activeFilter ? "bg-mk-navy text-white" : "border border-mk-line text-mk-sec"}`}>{f}</button>
          ))}
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>

        {/* Upcoming */}
        <div className="rounded-lg p-5 md:p-6" style={{ background: "#FEF3C7" }}>
          <h2 className="text-lg font-bold text-mk-navy mb-4">Prochaines promotions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {promos.map(p => (
              <div key={p.title} className="bg-white rounded-lg p-4 border border-mk-mov-border">
                <h3 className="text-sm font-bold text-mk-navy mb-1">{p.title}</h3>
                <div className="flex items-center gap-1 text-xs text-mk-sec">
                  <Calendar size={12} /> {p.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
