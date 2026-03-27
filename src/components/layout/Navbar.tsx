import { Search, Globe, Bell, ShoppingCart, Users, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [isTVAC, setIsTVAC] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

        <form onSubmit={handleSearch} className="flex-1 max-w-[440px] mx-auto hidden sm:block">
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

        <div className="hidden md:flex items-center gap-3 shrink-0">
          <motion.button
            onClick={() => setIsTVAC(!isTVAC)}
            className="text-white text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.15)" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isTVAC ? "TVAC" : "HTVA"}
          </motion.button>
          <motion.div whileHover={{ scale: 1.15 }} className="cursor-pointer"><Globe className="text-white" size={18} /></motion.div>
          <motion.div whileHover={{ scale: 1.15 }} className="cursor-pointer"><Bell className="text-white" size={18} /></motion.div>
          <Link to="/panier" className="relative">
            <motion.div whileHover={{ scale: 1.15 }}>
              <ShoppingCart className="text-white" size={18} />
              <span className="absolute -top-1.5 -right-2 bg-mk-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
            </motion.div>
          </Link>
          <div className="w-px h-5 bg-white/20 mx-1" />
          <Link to="/compte" className="flex items-center gap-1.5 text-white text-sm">
            <Users size={16} />
            <span>Mon compte</span>
          </Link>
        </div>

        {/* Mobile icons */}
        <div className="flex md:hidden items-center gap-3 shrink-0">
          <Link to="/panier" className="relative">
            <ShoppingCart className="text-white" size={18} />
            <span className="absolute -top-1.5 -right-2 bg-mk-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">3</span>
          </Link>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="absolute top-14 left-0 right-0 bg-mk-navy border-t border-white/10 p-4 flex flex-col gap-3 md:hidden z-50"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <form onSubmit={handleSearch} className="sm:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sec" size={16} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-9 pr-3 py-2 rounded-md text-sm bg-white text-mk-text"
                />
              </div>
            </form>
            <button
              onClick={() => setIsTVAC(!isTVAC)}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-md self-start"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              {isTVAC ? "TVAC" : "HTVA"}
            </button>
            <Link to="/compte" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-white text-sm">
              <Users size={16} /> Mon compte
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
