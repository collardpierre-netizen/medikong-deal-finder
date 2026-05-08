import { useState } from "react";
import SearchTrivagoCard from "./SearchTrivagoCard";
import type { Product } from "@/hooks/useProducts";

interface Props {
  products: Product[];
}

type SortMode = "best" | "cheapest" | "fastest";

const tabs: { id: SortMode; label: string; sub: string }[] = [
  { id: "best", label: "Le meilleur", sub: "qualité-prix" },
  { id: "cheapest", label: "Le moins cher", sub: "parmi tous" },
  { id: "fastest", label: "Le plus rapide", sub: "livraison" },
];

export default function SearchTrivagoView({ products }: Props) {
  // Tri par défaut : "Le moins cher" — aligné avec l'ordre prix croissant attendu sur les pages d'intention transactionnelle.
  const [sort, setSort] = useState<SortMode>("cheapest");

  // Toujours pousser les produits sans offre en bas de liste, quel que soit le tri.
  // (Sinon "Le moins cher" trie par prix=0 en tête → faux best-deals à 0,00 €.)
  const hasOffer = (p: Product) => (p.sellers || 0) > 0 && (p.price || 0) > 0;
  const sorted = [...products].sort((a, b) => {
    const aHas = hasOffer(a);
    const bHas = hasOffer(b);
    if (aHas !== bHas) return aHas ? -1 : 1;
    switch (sort) {
      case "cheapest": return a.price - b.price;
      case "fastest": return 0; // no delivery data at product level
      case "best":
      default: return (b.sellers - a.sellers) || (a.price - b.price);
    }
  });

  return (
    <div className="space-y-4">
      {/* Sort tabs — scroll horizontal natif sur mobile (snap CSS) */}
      <div
        role="tablist"
        aria-label="Trier la comparaison"
        className="flex border-b border-border bg-card rounded-t-xl overflow-x-auto sm:overflow-visible snap-x snap-mandatory"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={sort === tab.id}
            onClick={() => setSort(tab.id)}
            className={`shrink-0 sm:flex-1 min-w-[60%] sm:min-w-0 snap-start px-4 py-3 text-center border-b-2 transition-colors
              ${sort === tab.id
                ? "border-primary bg-muted/50"
                : "border-transparent hover:bg-muted/30"
              }`}
          >
            <p className={`text-sm font-bold ${sort === tab.id ? "text-foreground" : "text-muted-foreground"}`}>
              {tab.label}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{tab.sub}</p>
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {sorted.map((p) => (
          <SearchTrivagoCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
