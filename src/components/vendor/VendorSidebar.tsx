import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Tag, ShoppingCart, Lightbulb, Bell, FileText, BarChart3, Trophy,
  DollarSign, Truck, HeartPulse, MessageSquare, GraduationCap, Settings, ChevronLeft, ChevronRight, Receipt,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-horizontal.png";

type ShippingMode = "no_shipping" | "own_sendcloud" | "medikong_whitelabel";

interface SidebarItem {
  key: string;
  icon: typeof LayoutDashboard;
  path: string;
  comingSoon?: boolean;
  /** Show only for these shipping modes. undefined = always show */
  modes?: ShippingMode[];
}

const sidebarSections: { label: string | null; items: SidebarItem[] }[] = [
  {
    label: null,
    items: [{ key: "dashboard", icon: LayoutDashboard, path: "/vendor" }],
  },
  {
    label: "VENTES",
    items: [
      { key: "myOffers", icon: Tag, path: "/vendor/offers" },
      { key: "orders", icon: ShoppingCart, path: "/vendor/orders" },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { key: "positioning", icon: Trophy, path: "/vendor/positioning" },
      { key: "opportunities", icon: Lightbulb, path: "/vendor/opportunities", comingSoon: true },
      { key: "alerts", icon: Bell, path: "/vendor/alerts" },
      { key: "tenders", icon: FileText, path: "/vendor/tenders", comingSoon: true },
      { key: "analytics", icon: BarChart3, path: "/vendor/analytics", comingSoon: true },
    ],
  },
  {
    label: "COMPTE",
    items: [
      { key: "finances", icon: DollarSign, path: "/vendor/finance", comingSoon: true },
      { key: "billing", icon: Receipt, path: "/vendor/billing", modes: ["medikong_whitelabel"] },
      { key: "shipments", icon: Truck, path: "/vendor/shipments" },
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
  const preservedSearch = location.search;
  const { data: vendor } = useCurrentVendor();
  const shippingMode = ((vendor as any)?.vendor_shipping_mode ?? "no_shipping") as ShippingMode;

  return (
    <aside
      className={cn(
        "h-screen flex flex-col shrink-0 transition-all duration-200 overflow-hidden",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "#1E293B" }}
    >
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

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {sidebarSections.map((section, si) => {
          const visibleItems = section.items.filter(
            (item) => !item.modes || item.modes.includes(shippingMode)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={si}>
              {section.label && !collapsed && (
                <p className="text-[10px] font-semibold text-white/30 tracking-widest px-2 mb-1.5">{section.label}</p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path || (item.path !== "/vendor" && location.pathname.startsWith(item.path));
                  const isDisabled = item.comingSoon;

                  if (isDisabled) {
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "flex items-center gap-3 rounded-md text-[13px] font-medium cursor-not-allowed select-none",
                          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                          "text-white/25"
                        )}
                      >
                        <item.icon size={18} className="shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                        {!collapsed && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-white/20 bg-white/5 rounded px-1.5 py-0.5 shrink-0">
                            Bientôt
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <NavLink
                      key={item.key}
                      to={{ pathname: item.path, search: preservedSearch }}
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
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 text-white/40 hover:text-white/70 transition-colors shrink-0 border-t border-white/10"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
