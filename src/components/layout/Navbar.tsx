import { Bell, ShoppingCart, Users, Menu, X, LogOut, Shield, Store, Tag } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { InstantSearchBar } from "@/components/search/InstantSearchBar";
import logoHorizontal from "@/assets/logo-medikong.png";

export function Navbar() {
  const { t } = useTranslation();
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "";

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50">
      <div className="mk-container flex items-center h-16 gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center shrink-0">
          <img src={logoHorizontal} alt="MediKong" className="h-10" />
        </Link>

        {/* Search bar — hidden on homepage */}
        {!isHomePage && (
          <div className="flex-1 max-w-[520px] mx-auto hidden sm:block">
            <InstantSearchBar />
          </div>
        )}

        {/* Right icons — desktop */}
        <div className="hidden md:flex items-center gap-3 shrink-0 ml-auto">
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <Bell className="text-foreground" size={20} />
          </button>
          <Link to="/panier" className="relative p-2 rounded-full hover:bg-muted transition-colors">
            <ShoppingCart className="text-foreground" size={20} />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px] h-[18px]">{cartCount}</span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/15 transition-colors">
                  <Shield size={13} />
                  <span>{t("common.admin")}</span>
                </Link>
              )}
              {isVendor && (
                <Link to="/vendor" className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full hover:bg-primary/15 transition-colors">
                  <Store size={13} />
                  <span>{t("common.vendor")}</span>
                </Link>
              )}
              <Link to="/mes-prix" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
                <Tag size={13} />
                <span>Mes Prix</span>
              </Link>
              <Link
                to="/compte"
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold hover:opacity-90 transition-opacity"
              >
                {userInitials}
              </Link>
              <button onClick={handleSignOut} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/connexion"
              className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <Users size={16} />
            </Link>
          )}
        </div>

        {/* Mobile icons */}
        <div className="flex md:hidden items-center gap-2 shrink-0 ml-auto">
          <Link to="/panier" className="relative p-2">
            <ShoppingCart className="text-foreground" size={20} />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center">{cartCount}</span>
            )}
          </Link>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-foreground">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="absolute top-16 left-0 right-0 bg-white border-b border-border p-4 flex flex-col gap-3 md:hidden z-50 shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <InstantSearchBar className="sm:hidden" />
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-primary text-sm font-semibold">
                    <Shield size={16} /> {t("common.administration")}
                  </Link>
                )}
                {isVendor && (
                  <Link to="/vendor" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-primary text-sm font-semibold">
                    <Store size={16} /> {t("common.vendorSpace")}
                  </Link>
                )}
                <Link to="/mes-prix" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                  <Tag size={16} /> Mes Prix
                </Link>
                <Link to="/compte" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-foreground text-sm">
                  <Users size={16} /> {t("common.account")}
                </Link>
                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="flex items-center gap-2 text-muted-foreground text-sm">
                  <LogOut size={16} /> {t("common.signOut")}
                </button>
              </>
            ) : (
              <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-foreground text-sm">
                <Users size={16} /> {t("common.login")}
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
