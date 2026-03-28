import { Search, Globe, Bell, ShoppingCart, Users, Menu, X, LogOut, Shield, Store } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import logoHorizontal from "@/assets/logo-horizontal.png";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [isTVAC, setIsTVAC] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === "/" || location.pathname === "";
  const { user, signOut } = useAuth();
  const { cartCount } = useCart();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsVendor(false); return; }
    const check = async () => {
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      setIsAdmin(!!adminData);

      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      setIsVendor(!!vendorData);
    };
    check();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/recherche?q=${encodeURIComponent(query)}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="bg-mk-navy h-20 flex items-center px-4 sticky top-0 z-50">
      <div className="mk-container flex items-center w-full gap-4">
        <Link to="/" className="flex items-center shrink-0">
          <img src={logoHorizontal} alt="MediKong.pro" className="h-[72px]" />
        </Link>

        {!isHomePage && (
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
        )}

        <div className="hidden md:flex items-center gap-3 shrink-0 ml-auto">
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
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-mk-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{cartCount}</span>
              )}
            </motion.div>
          </Link>
          <div className="w-px h-5 bg-white/20 mx-1" />
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(27,91,218,0.15)" }}>
                  <Shield size={14} />
                  <span>Admin</span>
                </Link>
              )}
              {isVendor && (
                <Link to="/vendor" className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(231,8,102,0.15)" }}>
                  <Store size={14} />
                  <span>Vendeur</span>
                </Link>
              )}
              <Link to="/compte" className="flex items-center text-white text-sm max-w-[120px] truncate">
                {user.email?.split("@")[0]}
              </Link>
              <button onClick={handleSignOut} className="text-white/60 hover:text-white transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/connexion" className="flex items-center gap-1.5 text-white text-sm">
              <Users size={16} />
              <span>Connexion</span>
            </Link>
          )}
        </div>

        {/* Mobile icons */}
        <div className="flex md:hidden items-center gap-3 shrink-0 ml-auto">
          <Link to="/panier" className="relative">
            <ShoppingCart className="text-white" size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-mk-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{cartCount}</span>
            )}
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
            {!isHomePage && (
              <form onSubmit={handleSearch} className="sm:hidden">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-sec" size={16} />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 rounded-md text-sm bg-white text-mk-text" />
                </div>
              </form>
            )}
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                    <Shield size={16} /> Administration
                  </Link>
                )}
                {isVendor && (
                  <Link to="/vendor" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-pink-400 text-sm font-semibold">
                    <Store size={16} /> Espace Vendeur
                  </Link>
                )}
                <Link to="/compte" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-white text-sm">
                  <Users size={16} /> Mon compte
                </Link>
                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="flex items-center gap-2 text-white/70 text-sm">
                  <LogOut size={16} /> Déconnexion
                </button>
              </>
            ) : (
              <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-white text-sm">
                <Users size={16} /> Connexion
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
