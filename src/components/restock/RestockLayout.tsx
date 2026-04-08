import { Outlet, NavLink, useLocation } from "react-router-dom";
import { PackagePlus, List, MessageSquare, CheckCircle, HelpCircle, LayoutGrid, Users, Mail, Shield } from "lucide-react";
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
  { to: "/restock/admin/rules", label: "Règles de filtrage", icon: Shield },
];

export default function RestockLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/restock/admin");
  const nav = isAdmin ? adminNav : sellerNav;

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[240px] z-50 overflow-y-auto flex flex-col bg-white border-r border-[#D0D5DC]">
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
      <main className="ml-[240px] flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
