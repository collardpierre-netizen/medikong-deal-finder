import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Tag, ShoppingCart, Lightbulb, Bell, FileText, BarChart3,
  DollarSign, Truck, HeartPulse, MessageSquare, GraduationCap, Settings, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-horizontal.png";

const sidebarSections = [
  {
    label: null,
    items: [{ key: "dashboard", icon: LayoutDashboard, path: "/vendor" }],
  },
  {
    label: "VENTES",
    items: [
      { key: "catalog", icon: Package, path: "/vendor/catalog" },
      { key: "myOffers", icon: Tag, path: "/vendor/offers" },
      { key: "orders", icon: ShoppingCart, path: "/vendor/orders" },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { key: "opportunities", icon: Lightbulb, path: "/vendor/opportunities", comingSoon: true },
      { key: "alerts", icon: Bell, path: "/vendor/alerts", comingSoon: true },
      { key: "tenders", icon: FileText, path: "/vendor/tenders", comingSoon: true },
      { key: "analytics", icon: BarChart3, path: "/vendor/analytics", comingSoon: true },
    ],
  },
  {
    label: "COMPTE",
    items: [
      { key: "finances", icon: DollarSign, path: "/vendor/finance", comingSoon: true },
      { key: "logistics", icon: Truck, path: "/vendor/logistics", comingSoon: true },
      { key: "health", icon: HeartPulse, path: "/vendor/health" },
      { key: "messages", icon: MessageSquare, path: "/vendor/messages", comingSoon: true },
    ],
  },
  {
    label: "RESSOURCES",
    items: [
      { key: "academy", icon: GraduationCap, path: "/vendor/academy", comingSoon: true },
      { key: "settings", icon: Settings, path: "/vendor/settings" },
    ],
  },
];

interface VendorSidebarProps {
  onNavigate?: () => void;
}

export function VendorSidebar({ onNavigate }: VendorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();
  const location = useLocation();

  return (
    <aside
      className={cn(
        "h-screen flex flex-col shrink-0 transition-all duration-200 overflow-hidden",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "#1E293B" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: "#1B5BDA" }}>M</div>
        ) : (
          <div className="overflow-hidden">
            <img src={logoLight} alt="MediKong.pro" className="h-16" />
            <p className="text-white/40 text-[10px] font-medium mt-0.5">Espace Vendeur</p>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {sidebarSections.map((section, si) => (
          <div key={si}>
            {section.label && !collapsed && (
              <p className="text-[10px] font-semibold text-white/30 tracking-widest px-2 mb-1.5">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== "/vendor" && location.pathname.startsWith(item.path));
                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md text-[13px] font-medium transition-colors relative",
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/55 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: "#E70866" }} />}
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                    {!collapsed && item.badge && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1.5" style={{ backgroundColor: "#E70866" }}>
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: "#E70866" }} />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 text-white/40 hover:text-white/70 transition-colors shrink-0 border-t border-white/10"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
