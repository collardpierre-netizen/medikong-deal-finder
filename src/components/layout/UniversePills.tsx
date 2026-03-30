import { useNavigate, useSearchParams } from "react-router-dom";
import { useCatalogCategories } from "@/hooks/useCatalog";

export function UniversePills() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "";
  const { data: categories = [] } = useCatalogCategories();

  // Show top-level (parent) categories only
  const parentCategories = categories.filter(c => !c.parent_id);

  const handleClick = (slug: string) => {
    if (activeCategory === slug) {
      // Deselect → show all
      navigate("/catalogue");
    } else {
      navigate(`/catalogue?category=${slug}`);
    }
  };

  return (
    <div className="border-b border-border py-3">
      <div className="mk-container flex items-center gap-2 overflow-x-auto">
        {parentCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleClick(cat.slug)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.slug
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {cat.name}
          </button>
        ))}
        <button
          onClick={() => navigate("/marques")}
          className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border border-border text-muted-foreground hover:border-primary"
        >
          Marques A-Z
        </button>
      </div>
    </div>
  );
}
