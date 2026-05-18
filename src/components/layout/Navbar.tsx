import { Bell, ShoppingCart, Users, Menu, X, LogOut, Shield, Store, Tag } from "lucide-react";
import { usePriceDisplay } from "@/contexts/PriceDisplayContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { InstantSearchBar } from "@/components/search/InstantSearchBar";
import { LanguageSelector } from "@/components/LanguageSelector";
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
  const { isTVAC, toggleTVAC } = usePriceDisplay();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileMenuOpen]);

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
          <img src={logoHorizontal} alt="MediKong" className="h-[67px]" />
        </Link>

        {/* Search bar — hidden on homepage, visible from md+ on others (mobile uses burger menu) */}
        {!isHomePage && (
          <div className="flex-1 max-w-[520px] mx-auto hidden md:block">
            <InstantSearchBar />
          </div>
        )}

        {/* Right icons — desktop */}
        <div className="hidden md:flex items-center gap-3 shrink-0 ml-auto">
          <button
            onClick={toggleTVAC}
            className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1.5 border border-border hover:bg-muted transition-colors"
            title="Basculer entre prix HTVA et TTC"
          >
            <span className={isTVAC ? "text-muted-foreground" : "text-primary font-bold"}>HTVA</span>
            <span className="text-muted-foreground">/</span>
            <span className={isTVAC ? "text-primary font-bold" : "text-muted-foreground"}>TTC</span>
          </button>
          <button
            type="button"
            aria-label={t("common.notifications", "Notifications")}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <Bell className="text-foreground" size={20} aria-hidden="true" />
          </button>
          <Link
            to="/panier"
            aria-label={t("common.cart", "Panier")}
            className="relative p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ShoppingCart className="text-foreground" size={20} aria-hidden="true" />
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
                <div className="flex items-center bg-muted/60 rounded-full p-0.5" role="group" aria-label="Bascule Acheteur / Vendeur">
                  <Link
                    to="/compte"
                    aria-pressed={!location.pathname.startsWith("/vendor")}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      !location.pathname.startsWith("/vendor")
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users size={12} />
                    <span>Acheteur</span>
                  </Link>
                  <Link
                    to="/vendor"
                    aria-pressed={location.pathname.startsWith("/vendor")}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      location.pathname.startsWith("/vendor")
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Store size={12} />
                    <span>Vendeur</span>
                  </Link>
                </div>
              )}
              <Link to="/mes-prix" className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full hover:bg-emerald-100 transition-colors">
                <Tag size={13} />
                <span>{t("nav.myPrices", "Mes Prix")}</span>
              </Link>
              <Link
                to="/compte"
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold hover:opacity-90 transition-opacity"
              >
                {userInitials}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label={t("common.signOut", "Se déconnecter")}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut size={16} aria-hidden="true" />
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
          <LanguageSelector variant="light" />
        </div>

        {/* Mobile icons */}
        <div className="flex md:hidden items-center gap-2 shrink-0 ml-auto">
          <Link to="/panier" aria-label={t("common.cart", "Panier")} className="relative p-2">
            <ShoppingCart className="text-foreground" size={20} aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center">{cartCount}</span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t("common.closeMenu", "Fermer le menu") : t("common.openMenu", "Ouvrir le menu")}
            aria-expanded={mobileMenuOpen}
            className="p-2 text-foreground"
          >
            {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 top-16 bg-black/40 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="absolute top-16 left-0 right-0 bg-white border-b border-border p-4 flex flex-col gap-3 md:hidden z-50 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <InstantSearchBar />
              <button
                onClick={toggleTVAC}
                className="flex items-center justify-center gap-1 text-xs font-semibold rounded-full px-3 py-2 border border-border self-start"
              >
                <span className={isTVAC ? "text-muted-foreground" : "text-primary font-bold"}>HTVA</span>
                <span className="text-muted-foreground">/</span>
                <span className={isTVAC ? "text-primary font-bold" : "text-muted-foreground"}>TTC</span>
              </button>
              {user ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-primary text-sm font-semibold py-1">
                      <Shield size={16} /> {t("common.administration")}
                    </Link>
                  )}
                  {isVendor && (
                    <Link to="/vendor" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-primary text-sm font-semibold py-1">
                      <Store size={16} /> {t("common.vendorSpace")}
                    </Link>
                  )}
                  <Link to="/mes-prix" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-emerald-600 text-sm font-semibold py-1">
                    <Tag size={16} /> {t("nav.myPrices", "Mes Prix")}
                  </Link>
                  <Link to="/compte" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-foreground text-sm py-1">
                    <Users size={16} /> {t("common.account")}
                  </Link>
                  <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                    <LogOut size={16} /> {t("common.signOut")}
                  </button>
                </>
              ) : (
                <Link to="/connexion" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-foreground text-sm py-1">
                  <Users size={16} /> {t("common.login")}
                </Link>
              )}
              <div className="pt-2 border-t border-border">
                <LanguageSelector variant="light" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
