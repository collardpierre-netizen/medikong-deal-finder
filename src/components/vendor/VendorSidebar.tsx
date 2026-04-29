import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Tag, ShoppingCart, Lightbulb, Bell, FileText, BarChart3, Trophy,
  DollarSign, Truck, HeartPulse, MessageSquare, GraduationCap, Settings, ChevronLeft, ChevronRight, Receipt,
  AlertOctagon, BookOpen, PlusSquare,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useCompetitorAlertsCount } from "@/hooks/useVendorCompetitorAlerts";
import { useVendorUnreadNotificationsCount } from "@/hooks/useVendorNotifications";
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
  /** Mark this item as a child of another route (visually indented + parent stays highlighted). */
  parentPath?: string;
  /** Extra paths that should also activate this item. */
  alsoActiveOn?: string[];
}

const sidebarSections: { label: string | null; items: SidebarItem[] }[] = [
  {
    label: null,
    items: [{ key: "dashboard", icon: LayoutDashboard, path: "/vendor" }],
  },
  {
    label: "VENTES",
    items: [
      { key: "catalog", icon: BookOpen, path: "/vendor/catalog", alsoActiveOn: ["/vendor/produits/proposer"] },
      { key: "proposeProduct", icon: PlusSquare, path: "/vendor/produits/proposer", parentPath: "/vendor/catalog" },
      { key: "myOffers", icon: Tag, path: "/vendor/offers" },
      { key: "orders", icon: ShoppingCart, path: "/vendor/orders" },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { key: "marketIntel", icon: BarChart3, path: "/vendor/market-intel" },
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
      { key: "notificationsCenter", icon: Bell, path: "/vendor/notifications" },
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
  const { data: competitorAlertsCount = 0 } = useCompetitorAlertsCount(vendor?.id);
  const { data: unreadNotifsCount = 0 } = useVendorUnreadNotificationsCount(vendor?.id);

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
                  const pathname = location.pathname;
                  const exactMatch = pathname === item.path;
                  const childMatch = item.path !== "/vendor" && pathname.startsWith(item.path + "/");
                  const alsoMatch = item.alsoActiveOn?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false;
                  // If another sibling owns this path more specifically, don't claim it
                  const isOwnedByChild = visibleItems.some(
                    (other) => other.key !== item.key && (pathname === other.path || pathname.startsWith(other.path + "/"))
                  );
                  const isActive = exactMatch || (childMatch && !isOwnedByChild);
                  const isParentActive = !isActive && alsoMatch;
                  const isDisabled = item.comingSoon;
                  const isChildItem = !!item.parentPath;

                  if (isDisabled) {
                    return (
                      <div
                        key={item.key}
                        className={cn(
                          "flex items-center gap-3 rounded-md text-[13px] font-medium cursor-not-allowed select-none",
                          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                          !collapsed && isChildItem && "ml-4",
                          "text-white/25"
                        )}
                      >
                        <item.icon size={isChildItem ? 16 : 18} className="shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                        {!collapsed && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-white/20 bg-white/5 rounded px-1.5 py-0.5 shrink-0">
                            Bientôt
                          </span>
                        )}
                      </div>
                    );
                  }

                  const badgeCount =
                    item.key === "marketIntel" ? competitorAlertsCount :
                    item.key === "notificationsCenter" ? unreadNotifsCount : 0;

                  return (
                    <NavLink
                      key={item.key}
                      to={{ pathname: item.path, search: preservedSearch }}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md text-[13px] font-medium transition-colors relative",
                        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                        !collapsed && isChildItem && "ml-4 text-[12px]",
                        isActive
                          ? "bg-white/10 text-white"
                          : isParentActive
                            ? "text-white/80 bg-white/[0.03]"
                            : "text-white/55 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: "#E70866" }} />}
                      {isParentActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white/20" />}
                      <div className="relative shrink-0">
                        <item.icon size={isChildItem ? 16 : 18} />
                        {collapsed && badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#E70866] text-white text-[9px] font-bold flex items-center justify-center px-1">
                            {badgeCount > 9 ? "9+" : badgeCount}
                          </span>
                        )}
                      </div>
                      {!collapsed && <span className="flex-1 truncate">{t(item.key)}</span>}
                      {!collapsed && badgeCount > 0 && (
                        <span className="text-[10px] font-bold bg-[#E70866] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
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
