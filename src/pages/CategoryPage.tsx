import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { products } from "@/data/mock";
import { ProductCard } from "@/components/shared/ProductCard";
import { Grid, List } from "lucide-react";
import { useState } from "react";

const subcategories = ["Gants", "Masques", "Compresses", "Desinfectants", "Bandages", "Equipement PPE"];
const sidebarBrands = ["Aurelia", "Kolmi", "Hartmann", "Ecolab", "Meda Pharma"];

export default function CategoryPage() {
  const { slug } = useParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [activeSub, setActiveSub] = useState(0);

  return (
    <Layout>
      <div className="bg-mk-alt border-b border-mk-line py-4">
        <div className="mk-container text-xs text-mk-sec">
          <Link to="/" className="hover:text-mk-blue">Accueil</Link> &gt; Categories &gt; {slug}
        </div>
      </div>
      <div className="mk-container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-mk-navy">Consommables medicaux</h1>
            <p className="text-sm text-mk-sec">847 produits</p>
          </div>
          <div className="flex border border-mk-line rounded-md overflow-hidden">
            {([["grid", Grid], ["list", List]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} className={`p-2 ${view === v ? "bg-mk-navy text-white" : "text-mk-sec"}`}><Icon size={16} /></button>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          <aside className="w-[220px] shrink-0">
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Sous-categories</h4>
              {subcategories.map((s, i) => (
                <button key={s} onClick={() => setActiveSub(i)} className={`block w-full text-left text-sm py-1.5 ${i === activeSub ? "text-mk-blue font-medium" : "text-mk-sec hover:text-mk-text"}`}>{s}</button>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Marque</h4>
              {sidebarBrands.map(b => (
                <label key={b} className="flex items-center gap-2 mb-2 text-sm text-mk-sec cursor-pointer"><input type="checkbox" /> {b}</label>
              ))}
            </div>
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-mk-navy mb-3">Prix</h4>
              <div className="flex gap-2">
                <input placeholder="Min" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
                <input placeholder="Max" className="w-full border border-mk-line rounded-md px-2 py-1.5 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-mk-sec cursor-pointer"><input type="checkbox" /> En stock uniquement</label>
          </aside>

          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="grid grid-cols-4 gap-3">
              {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
