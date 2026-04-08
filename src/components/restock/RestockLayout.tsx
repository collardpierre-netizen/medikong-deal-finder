import { Outlet, NavLink, useLocation } from "react-router-dom";
import { PackagePlus, List, MessageSquare, CheckCircle, HelpCircle, LayoutGrid, Users, Mail, Shield, Settings, Zap, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import logoHorizontal from "@/assets/logo-medikong.png";

const sellerNav = [
  { to: "/restock/seller/new", label: "Nouvelle offre", icon: PackagePlus },
  { to: "/restock/seller/offers", label: "Mes offres", icon: List },
  { to: "/restock/seller/counteroffers", label: "Contre-offres", icon: MessageSquare },
  { to: "/restock/seller/sales", label: "Ventes conclues", icon: CheckCircle },
  { to: "/restock/seller/help", label: "Guide d'aide", icon: HelpCircle },
];

const adminNav = [
  { to: "/restock/admin/offers", label: "Toutes les offres", icon: LayoutGrid },
  { to: "/restock/admin/buyers", label: "Acheteurs", icon: Users },
  { to: "/restock/admin/campaigns", label: "Campagnes email", icon: Mail },
  { to: "/restock/admin/drops", label: "Drops", icon: Zap },
  { to: "/restock/admin/rules", label: "Règles de filtrage", icon: Shield },
  { to: "/restock/admin/settings", label: "Paramètres", icon: Settings },
];

export default function RestockLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/restock/admin");
  const nav = isAdmin ? adminNav : sellerNav;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white border-b border-[#D0D5DC] px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src={logoHorizontal} alt="MediKong" className="h-12" />
          <span className="text-[#00B85C] font-bold text-base" style={{ fontFamily: "'DM Sans', sans-serif" }}>ReStock</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg hover:bg-[#F0F4FF] transition-colors"
        >
          {mobileOpen ? <X size={22} className="text-[#1E252F]" /> : <Menu size={22} className="text-[#1E252F]" />}
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-[240px] z-50 overflow-y-auto flex flex-col bg-white border-r border-[#D0D5DC] transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="px-5 py-4 border-b border-[#D0D5DC] flex items-center gap-2">
          <img src={logoHorizontal} alt="MediKong" className="h-10" />
          <span className="text-[#00B85C] font-bold text-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>ReStock</span>
        </div>

        {isAdmin && (
          <div className="px-5 py-2 border-b border-[#D0D5DC]">
            <span className="text-[10px] uppercase tracking-wider text-[#8B929C] font-semibold">Administration</span>
          </div>
        )}

        <nav className="flex-1 px-3 pt-4 space-y-1">
          {nav.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-[#1C58D9] text-white"
                    : "text-[#5C6470] hover:bg-[#F0F4FF] hover:text-[#1E252F]"
                }`}
              >
                <item.icon size={17} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 min-h-screen md:ml-[240px] pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
