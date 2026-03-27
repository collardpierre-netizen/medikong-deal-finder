import { Layout } from "@/components/layout/Layout";
import { UniversePills } from "@/components/layout/UniversePills";
import { brands } from "@/data/mock";
import { Link } from "react-router-dom";
import { useState } from "react";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function BrandsPage() {
  const [activeLetter, setActiveLetter] = useState("A");
  const grouped = brands.reduce((acc, b) => {
    (acc[b.letter] = acc[b.letter] || []).push(b);
    return acc;
  }, {} as Record<string, typeof brands>);

  return (
    <Layout>
      <UniversePills />
      <div className="mk-container py-8">
        <h1 className="text-[28px] font-bold text-mk-navy mb-1">Toutes nos marques</h1>
        <p className="text-sm text-mk-sec mb-6">350+ marques referencees · 12 500+ produits</p>

        <div className="flex gap-1.5 mb-8 flex-wrap">
          {letters.map(l => (
            <button
              key={l}
              onClick={() => setActiveLetter(l)}
              className={`w-8 h-8 rounded-full text-sm font-medium flex items-center justify-center ${
                l === activeLetter ? "bg-mk-navy text-white" : grouped[l] ? "border border-mk-line text-mk-sec hover:border-mk-navy" : "text-mk-ter/40 cursor-default"
              }`}
              disabled={!grouped[l]}
            >
              {l}
            </button>
          ))}
        </div>

        {Object.entries(grouped).sort().map(([letter, list]) => (
          <div key={letter} className="mb-8">
            <h2 className="text-xl font-bold text-mk-navy pb-2 border-b border-mk-line mb-4">{letter}</h2>
            <div className="grid grid-cols-4 gap-3">
              {list.map(b => (
                <Link key={b.slug} to={`/marque/${b.slug}`} className="text-sm font-medium text-mk-navy hover:text-mk-blue">
                  {b.name} <span className="text-mk-ter font-normal">({b.count})</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
