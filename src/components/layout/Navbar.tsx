import { Search, Globe, Bell, ShoppingCart, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [isTVAC, setIsTVAC] = useState(true);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/recherche?q=${encodeURIComponent(query)}`);
  };

  return (
    <nav className="bg-mk-navy h-14 flex items-center px-4 sticky top-0 z-50">
      <div className="mk-container flex items-center w-full gap-4">
        <Link to="/" className="flex items-center shrink-0">
          <span className="text-white font-bold text-lg">MediKong</span>
          <span className="text-mk-blue font-bold text-lg">.pro</span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-[440px] mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sec" size={16} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher produits, CNK, EAN, marques..."
              className="w-full pl-9 pr-3 py-2 rounded-md text-sm bg-white text-mk-text placeholder:text-mk-ter border-0 focus:outline-none focus:ring-2 focus:ring-mk-blue"
            />
          </div>
        </form>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsTVAC(!isTVAC)}
            className="text-white text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            {isTVAC ? "TVAC" : "HTVA"}
          </button>
          <Globe className="text-white" size={18} />
          <Bell className="text-white" size={18} />
          <Link to="/panier" className="relative">
            <ShoppingCart className="text-white" size={18} />
            <span className="absolute -top-1.5 -right-2 bg-mk-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
          </Link>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <Link to="/compte" className="flex items-center gap-1.5 text-white text-sm">
            <Users size={16} />
            <span>Mon compte</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
