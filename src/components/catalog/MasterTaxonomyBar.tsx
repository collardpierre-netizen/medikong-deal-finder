import { useCategories, useFeaturedTopCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

interface Props {
  selectedSlug?: string;
  onSelect: (slug: string | undefined) => void;
  /** Si true, n'affiche que les catégories marquées is_featured_top. */
  featuredOnly?: boolean;
}

/**
 * Bandeau horizontal des univers (taxonomie maîtresse N1, localisée via useCategories).
 * Remplace l'ancien UniversePills en lisant la taxonomie + traductions FR/NL/EN.
 */
export function MasterTaxonomyBar({ selectedSlug, onSelect, featuredOnly = false }: Props) {
  const featured = useFeaturedTopCategories();
  const all = useCategories(1);
  const query = featuredOnly ? featured : all;
  const categories = query.data || [];

  if (query.isLoading || categories.length === 0) return null;

  return (
    <nav
      aria-label="Univers du catalogue"
      className="-mx-2 mb-3 flex gap-1.5 overflow-x-auto px-2 pb-1.5 scrollbar-thin"
    >
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          !selectedSlug
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground hover:bg-muted"
        )}
      >
        Tous les univers
      </button>
      {categories.map((c) => {
        const active = selectedSlug === c.slug;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.slug)}
            title={c.description || c.name}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {c.name}
          </button>
        );
      })}
    </nav>
  );
}
