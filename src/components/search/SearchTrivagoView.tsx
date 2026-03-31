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
  const [sort, setSort] = useState<SortMode>("best");

  const sorted = [...products].sort((a, b) => {
    switch (sort) {
      case "cheapest": return a.price - b.price;
      case "fastest": return 0; // no delivery data at product level
      default: return (b.sellers - a.sellers) || (a.price - b.price);
    }
  });

  const cheapest = products.length > 0 ? Math.min(...products.map(p => p.price || Infinity)) : 0;
  const bestPrice = sorted[0]?.price || 0;

  return (
    <div className="space-y-4">
      {/* Sort tabs */}
      <div className="flex border-b border-border bg-card rounded-t-xl overflow-hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSort(tab.id)}
            className={`flex-1 px-4 py-3 text-center border-b-2 transition-colors
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
