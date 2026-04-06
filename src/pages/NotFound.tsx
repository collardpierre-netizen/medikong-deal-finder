import { Layout } from "@/components/layout/Layout";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Search, Home, Tag, ShoppingCart, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const suggestions = [
  { label: "Catalogue", href: "/catalogue", icon: ShoppingCart },
  { label: "Marques", href: "/marques", icon: Tag },
  { label: "Accueil", href: "/", icon: Home },
  { label: "Centre d'aide", href: "/aide", icon: HelpCircle },
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/recherche?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <Layout>
      <div className="mk-container py-16 md:py-24 text-center max-w-2xl mx-auto">
        <div className="text-7xl font-bold text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page introuvable</h1>
        <p className="text-muted-foreground mb-8">
          La page <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{location.pathname}</code> n'existe pas ou a été déplacée.
        </p>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mb-10">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un produit, une marque..."
              className="pl-9"
            />
          </div>
          <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
            Rechercher
          </button>
        </form>

        {/* Suggestions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {suggestions.map(s => (
            <Link
              key={s.href}
              to={s.href}
              className="border border-border rounded-lg p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors text-center"
            >
              <s.icon size={24} className="mx-auto mb-2 text-primary/60" />
              <span className="text-sm font-medium text-foreground">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
