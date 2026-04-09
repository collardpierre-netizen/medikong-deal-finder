import { Link, useLocation } from "react-router-dom";
import {
  PackagePlus, List, MessageSquare, CheckCircle, HelpCircle, LayoutGrid,
  Users, Mail, Shield, Settings, Zap, Gift, Database, Wallet, ArrowLeft,
  Home, ShoppingCart, Store,
} from "lucide-react";

const buyerNav = [
  { to: "/restock", label: "Accueil", icon: Home },
  { to: "/opportunities/demo", label: "Opportunités", icon: ShoppingCart },
  { to: "/restock/buyer/dashboard", label: "Mon espace", icon: LayoutGrid },
  { to: "/restock/buyer/drops", label: "Drops", icon: Zap },
  { to: "/restock/faq", label: "FAQ", icon: HelpCircle },
];

const sellerNav = [
  { to: "/restock/seller/new", label: "Nouvelle offre", icon: PackagePlus },
  { to: "/restock/seller/offers", label: "Mes offres", icon: List },
  { to: "/restock/seller/counteroffers", label: "Contre-offres", icon: MessageSquare },
  { to: "/restock/seller/sales", label: "Ventes", icon: CheckCircle },
  { to: "/restock/seller/referral", label: "Parrainage", icon: Gift },
  { to: "/restock/seller/help", label: "Aide", icon: HelpCircle },
];

const adminNav = [
  { to: "/restock/admin/offers", label: "Offres", icon: LayoutGrid },
  { to: "/restock/admin/buyers", label: "Acheteurs", icon: Users },
  { to: "/restock/admin/campaigns", label: "Campagnes", icon: Mail },
  { to: "/restock/admin/drops", label: "Drops", icon: Zap },
  { to: "/restock/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/restock/admin/price-references", label: "Prix réf.", icon: Database },
  { to: "/restock/admin/faq", label: "FAQ", icon: Shield },
  { to: "/restock/admin/rules", label: "Règles", icon: Shield },
  { to: "/restock/admin/settings", label: "Paramètres", icon: Settings },
];

type Role = "buyer" | "seller" | "admin";

const roleTabs: { role: Role; label: string; icon: typeof Home; defaultTo: string }[] = [
  { role: "buyer", label: "Acheteur", icon: ShoppingCart, defaultTo: "/restock" },
  { role: "seller", label: "Vendeur", icon: Store, defaultTo: "/restock/seller/offers" },
  { role: "admin", label: "Admin", icon: Shield, defaultTo: "/restock/admin/offers" },
];

export function RestockSubNav() {
  const { pathname } = useLocation();
  const currentRole: Role = pathname.startsWith("/restock/admin")
    ? "admin"
    : pathname.startsWith("/restock/seller")
    ? "seller"
    : "buyer";

  const nav = currentRole === "admin" ? adminNav : currentRole === "seller" ? sellerNav : buyerNav;

  return (
    <header className="sticky top-0 z-[100] bg-gradient-to-r from-[#0F172A] to-[#1E293B] shadow-lg">
      {/* Row 1: Brand + Role switcher */}
      <div className="border-b border-white/[0.06]">
        <div className="mk-container">
          <div className="flex items-center justify-between h-11">
            <div className="flex items-center gap-0">
              {/* Brand + back */}
              <Link
                to="/"
                className="flex items-center gap-1.5 pr-4 mr-3 border-r border-white/10 shrink-0 group"
                title="Retour à MediKong"
              >
                <ArrowLeft size={13} className="text-white/40 group-hover:text-white/80 transition-colors" />
                <span className="text-white font-bold text-[13px] tracking-tight">
                  Medi<span className="text-[#3B82F6]">Kong</span>
                </span>
              </Link>

              {/* ReStock badge */}
              <span
                className="text-[#00D26A] font-extrabold text-[15px] tracking-tight mr-4"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                ReStock
              </span>
            </div>

            {/* Role switcher */}
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
              {roleTabs.map((tab) => (
                <Link
                  key={tab.role}
                  to={tab.defaultTo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${
                    currentRole === tab.role
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  }`}
                >
                  <tab.icon size={12} strokeWidth={currentRole === tab.role ? 2.2 : 1.5} />
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Contextual navigation */}
      <div className="mk-container">
        <nav className="flex items-center gap-0.5 h-10 -mb-px">
          {nav.map((item) => {
            const isActive =
              item.to === "/restock"
                ? pathname === "/restock"
                : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/45 hover:text-white/85 hover:bg-white/5"
                }`}
              >
                <item.icon size={13} strokeWidth={isActive ? 2.2 : 1.6} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
