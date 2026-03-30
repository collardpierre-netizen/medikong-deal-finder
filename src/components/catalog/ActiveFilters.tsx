import { X } from "lucide-react";
import type { CatalogFilters } from "@/hooks/useCatalog";

interface Props {
  filters: CatalogFilters;
  setFilter: (key: string, value: any) => void;
}

export function ActiveFilters({ filters, setFilter }: Props) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.category) {
    chips.push({ label: `Catégorie: ${filters.category}`, onRemove: () => setFilter("category", undefined) });
  }
  filters.brands?.forEach(b => {
    chips.push({ label: `Marque: ${b}`, onRemove: () => setFilter("brand", (filters.brands || []).filter(x => x !== b)) });
  });
  filters.manufacturers?.forEach(m => {
    chips.push({ label: `Fabricant: ${m}`, onRemove: () => setFilter("manufacturer", (filters.manufacturers || []).filter(x => x !== m)) });
  });
  if (filters.priceMin !== undefined) {
    chips.push({ label: `Prix min: ${filters.priceMin}€`, onRemove: () => setFilter("price_min", undefined) });
  }
  if (filters.priceMax !== undefined) {
    chips.push({ label: `Prix max: ${filters.priceMax}€`, onRemove: () => setFilter("price_max", undefined) });
  }
  if (filters.inStock) {
    chips.push({ label: "En stock", onRemove: () => setFilter("stock", undefined) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
          {chip.label}
          <button onClick={chip.onRemove} className="hover:bg-primary/20 rounded-full p-0.5">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
