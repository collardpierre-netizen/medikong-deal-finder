import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { Shield, Check, Package, ExternalLink, Award, Globe } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";

const brandsList = [
  { name: "TENA", count: 234, desc: "Solutions d'incontinence et d'hygiene", slug: "tena" },
  { name: "Leukoplast", count: 89, desc: "Pansements et soins des plaies", slug: "leukoplast" },
  { name: "MoliCare", count: 67, desc: "Protections pour l'incontinence", slug: "molicare" },
  { name: "Cutimed", count: 45, desc: "Solutions de gestion des plaies", slug: "cutimed" },
];

export default function ManufacturerPage() {
  const { slug } = useParams();
  const name = slug === "essity" ? "Essity" : "Essity";

  return (
    <Layout>
      <div className="bg-mk-alt py-8 md:py-10">
        <div className="mk-container">
          <div className="text-xs text-mk-sec mb-4">
            <Link to="/" className="hover:text-mk-blue">Accueil</Link> &gt; Fabricants &gt; {name}
          </div>
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] border border-mk-line bg-white rounded-lg flex items-center justify-center text-xs text-mk-ter shrink-0">Logo</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">{name}</h1>
                <span className="text-xs bg-mk-deal text-mk-green px-2 py-0.5 rounded font-medium">Verifie</span>
              </div>
              <p className="text-xs text-mk-sec mb-2">Suede · Fonde en 1929 · 46 000+ employes</p>
              <p className="text-sm text-mk-sec max-w-[600px] mb-4">Leader mondial en hygiene et sante. Fabricant de TENA, Leukoplast, et d'autres marques medicales de reference.</p>
              <div className="flex gap-2 flex-wrap">
                <button className="border border-mk-line text-sm px-4 py-2 rounded-md flex items-center gap-1.5 text-mk-sec"><ExternalLink size={13} /> Site officiel</button>
                <button className="bg-mk-blue text-white text-sm px-4 py-2 rounded-md">Contact fournisseur</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-mk-line py-4 overflow-x-auto">
        <div className="mk-container flex justify-center gap-6 md:gap-12 min-w-max">
          {[["4", "Marques"], ["524+", "Produits"], ["12", "Categories"], ["150+", "Pays"], ["Tier 1", "Niveau"]].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-lg font-bold text-mk-navy">{v}</div>
              <div className="text-xs text-mk-sec">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mk-container py-6 md:py-8">
        {/* 3 Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="border border-mk-line rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={18} className="text-mk-blue" />
              <span className="text-sm font-bold text-mk-navy">Trust Score</span>
            </div>
            <div className="text-3xl font-bold text-mk-green mb-2">92/100</div>
            <div className="h-2 bg-mk-alt rounded-full overflow-hidden mb-3">
              <div className="h-full bg-mk-green rounded-full" style={{ width: "92%" }} />
            </div>
            {[["Livraison", 95], ["Qualite", 90], ["SAV", 91]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between text-xs text-mk-sec mb-1">
                <span>{k}</span><span className="font-medium text-mk-navy">{v}%</span>
              </div>
            ))}
          </div>
          <div className="border border-mk-line rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Check size={18} className="text-mk-green" />
              <span className="text-sm font-bold text-mk-navy">Conformite GPSR</span>
            </div>
            <div className="space-y-2">
              {["Personne responsable UE", "Documentation technique", "Signalement incidents", "Traceabilite produits"].map(c => (
                <div key={c} className="flex items-center gap-2 text-xs text-mk-green">
                  <Check size={12} /> {c}
                </div>
              ))}
            </div>
          </div>
          <div className="border border-mk-line rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-mk-amber" />
              <span className="text-sm font-bold text-mk-navy">Stock temps reel</span>
            </div>
            {[["Disponible", "89%", "text-mk-green"], ["Faible stock", "8%", "text-mk-amber"], ["Rupture", "3%", "text-mk-red"]].map(([l, v, c]) => (
              <div key={l} className="flex justify-between text-sm mb-2">
                <span className="text-mk-sec">{l}</span><span className={`font-bold ${c}`}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Brands */}
        <h2 className="text-xl font-bold text-mk-navy mb-4">Marques du fabricant</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {brandsList.map(b => (
            <Link key={b.slug} to={`/marque/${b.slug}`} className="border border-mk-line rounded-lg p-5 hover:shadow-sm transition-shadow">
              <h3 className="text-base font-bold text-mk-navy mb-1">{b.name}</h3>
              <p className="text-xs text-mk-sec mb-1">{b.count} produits</p>
              <p className="text-sm text-mk-sec mb-2">{b.desc}</p>
              <span className="text-xs text-mk-blue">Voir les produits</span>
            </Link>
          ))}
        </div>

        {/* Certifications */}
        <h2 className="text-xl font-bold text-mk-navy mb-4">Certifications</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Shield, name: "Marquage CE" },
            { icon: Check, name: "ISO 13485" },
            { icon: Award, name: "FAGG/AFMPS" },
            { icon: Globe, name: "MDR 2017/745" },
          ].map(c => (
            <div key={c.name} className="border border-mk-line rounded-lg p-5 text-center">
              <c.icon size={24} className="mx-auto text-mk-navy mb-2" />
              <span className="text-sm font-medium text-mk-navy">{c.name}</span>
            </div>
          ))}
        </div>

        {/* Products */}
        <h2 className="text-xl font-bold text-mk-navy mb-4">Tous les produits</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </div>
    </Layout>
  );
}
