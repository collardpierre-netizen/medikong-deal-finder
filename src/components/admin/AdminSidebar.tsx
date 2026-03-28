import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import logoLight from "@/assets/logo-horizontal.png";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Store, UserPlus, Package, Layers, Tag, SlidersHorizontal,
  ShoppingCart, AlertCircle, DollarSign, Eye, Link, BarChart3,
  Shield, Upload, MessageSquare, Layout, Truck, ShieldCheck, Settings, FileText,
  LogOut, Users, ClipboardList, Percent,
} from "lucide-react";

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ElementType;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    labelKey: "management",
    items: [
      { labelKey: "sellers", path: "/admin/vendeurs", icon: Store },
      { labelKey: "onboarding", path: "/admin/onboarding", icon: UserPlus },
      { labelKey: "products", path: "/admin/produits", icon: Package },
      { labelKey: "categories", path: "/admin/categories", icon: Layers },
      { labelKey: "brands", path: "/admin/marques", icon: Tag },
      { labelKey: "pimSchemas", path: "/admin/schemas-pim", icon: SlidersHorizontal },
      { labelKey: "prixReference", path: "/admin/prix-reference", icon: Eye },
      { labelKey: "orders", path: "/admin/commandes", icon: ShoppingCart },
      { labelKey: "disputes", path: "/admin/litiges", icon: AlertCircle },
      { labelKey: "finances", path: "/admin/finances", icon: DollarSign },
    ],
  },
  {
    labelKey: "intelligence",
    items: [
      { labelKey: "priceWatch", path: "/admin/veille-prix", icon: Eye },
      { labelKey: "leads", path: "/admin/leads", icon: Link },
      { labelKey: "analytics", path: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    labelKey: "compliance",
    items: [
      { labelKey: "regulatory", path: "/admin/reglementaire", icon: Shield },
      { labelKey: "importExport", path: "/admin/import-export", icon: Upload },
    ],
  },
  {
    labelKey: "engagement",
    items: [
      { labelKey: "crm", path: "/admin/crm", icon: MessageSquare },
      { labelKey: "cms", path: "/admin/cms", icon: Layout },
      { labelKey: "onboardingCms", path: "/admin/onboarding-cms", icon: ClipboardList },
      { labelKey: "investPipeline", path: "/admin/invest-pipeline", icon: DollarSign },
    ],
  },
  {
    labelKey: "operations",
    items: [
      { labelKey: "users", path: "/admin/users", icon: Users },
      { labelKey: "logistics", path: "/admin/logistique", icon: Truck },
      { labelKey: "team", path: "/admin/equipe", icon: ShieldCheck },
      { labelKey: "settings", path: "/admin/parametres", icon: Settings },
      { labelKey: "logs", path: "/admin/logs", icon: FileText },
      { labelKey: "auditLog", path: "/admin/audit-log", icon: ClipboardList },
    ],
  },
];

const AdminSidebar = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { adminName, role } = useAdminAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[240px] z-50 overflow-y-auto flex flex-col"
      style={{ backgroundColor: "#1E293B" }}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <img src={logoLight} alt="MediKong.pro" className="h-10" />
        <p className="text-[11px] mt-1" style={{ color: "#8B95A5" }}>
          {t("superadminPanel")}
        </p>
      </div>

      {/* Dashboard link */}
      <div className="px-3 pt-3 pb-1">
        <NavLink
          to="/admin"
          end
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
            isActive("/admin")
              ? "text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
          style={isActive("/admin") ? { backgroundColor: "#1B5BDA" } : {}}
        >
          <LayoutDashboard size={17} strokeWidth={1.8} />
          {t("dashboard")}
        </NavLink>
      </div>

      {/* Sections */}
      <nav className="flex-1 px-3 pb-4">
        {sections.map((section) => (
          <div key={section.labelKey} className="mt-4">
            <p
              className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider"
              style={{ color: "#8B95A5" }}
            >
              {t(section.labelKey)}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors ${
                  isActive(item.path)
                    ? "text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                style={isActive(item.path) ? { backgroundColor: "#1B5BDA" } : {}}
              >
                <item.icon size={16} strokeWidth={1.8} />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      {/* Admin info + Logout */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-3">
        {adminName && (
          <div className="flex items-center gap-2.5 px-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ backgroundColor: "#334155" }}>
              {adminName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-white truncate">{adminName}</p>
              <p className="text-[10px] capitalize" style={{ color: "#8B95A5" }}>{role?.replace("_", " ")}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors w-full"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
