import { Link, useLocation } from "react-router-dom";
import { PackagePlus, List, MessageSquare, CheckCircle, HelpCircle, LayoutGrid, Users, Mail, Shield, Settings, Zap, Gift, Database, Wallet } from "lucide-react";
import logoHorizontal from "@/assets/logo-medikong.png";

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

export function RestockSubNav() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/restock/admin");
  const isSellerOrAdmin = isAdmin || pathname.startsWith("/restock/seller");

  // Only show sub-nav on seller/admin pages, not on landing or public pages
  if (!isSellerOrAdmin) return null;

  const nav = isAdmin ? adminNav : sellerNav;

  return (
    <div className="sticky top-[52px] z-[99] bg-[#1C58D9] border-b border-[#1549B8]">
      <div className="mk-container overflow-x-auto">
        <nav className="flex gap-0 whitespace-nowrap min-w-max items-center">
          {/* ReStock branding pill */}
          <div className="flex items-center gap-1.5 mr-4 pr-4 border-r border-white/20 py-2">
            <img src={logoHorizontal} alt="MediKong" className="h-6 brightness-0 invert" />
            <span className="text-[#00B85C] font-bold text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              ReStock
            </span>
            {isAdmin && (
              <span className="ml-1 text-[9px] uppercase tracking-wider bg-white/15 text-white/80 rounded px-1.5 py-0.5 font-semibold">
                Admin
              </span>
            )}
          </div>

          {nav.map((item) => {
            const isActive = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                  isActive
                    ? "text-white border-[#00B85C]"
                    : "text-white/60 border-transparent hover:text-white/90"
                }`}
              >
                <item.icon size={15} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
