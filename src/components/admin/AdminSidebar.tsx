import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import logoLight from "@/assets/logo-horizontal.png";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useActionCenter } from "@/hooks/useActionCenter";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  LayoutDashboard, Store, UserPlus, Package, Layers, Tag, SlidersHorizontal,
  ShoppingCart, AlertCircle, DollarSign, Eye, Link, BarChart3,
  Shield, Upload, MessageSquare, Layout, Truck, ShieldCheck, Settings, FileText,
  LogOut, Users, ClipboardList, Percent, RefreshCw, Key, Book, Factory, Globe, Hash, ExternalLink,
  CreditCard, TrendingUp, TrendingDown, AlertTriangle, Zap, Recycle, LayoutGrid, Users2, Mail, ShieldCheck as ShieldCheckAlt, ShieldAlert,
  Search, Image as ImageIcon, Activity, Bell, Plus, EyeOff, Send, QrCode,
} from "lucide-react";

interface NavItem {
  labelKey?: string;
  label?: string;
  path: string;
  icon: React.ElementType;
}

interface NavSection {
  labelKey: string;
  label?: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    labelKey: "management",
    items: [
      { labelKey: "sellers", path: "/admin/vendeurs", icon: Store },
      { label: "Anonymisation vendeurs", path: "/admin/vendor-visibility", icon: EyeOff },
      { label: "Vendors Stripe", path: "/admin/vendors-stripe", icon: CreditCard },
      { labelKey: "externalVendors", path: "/admin/vendeurs-externes", icon: ExternalLink },
      { labelKey: "onboarding", path: "/admin/onboarding", icon: UserPlus },
      { label: "Emails onboarding vendeur", path: "/admin/vendor-onboarding-emails", icon: Mail },
      { label: "Exclusivités vendeurs", path: "/admin/exclusivites", icon: ShieldCheck },
      { label: "Demandes d'exclusivité", path: "/admin/vendor-exclusivity-requests", icon: ShieldCheck },
      { label: "Autorisations marques", path: "/admin/vendor-brand-authorizations", icon: ShieldCheck },
      { label: "Offres bloquées", path: "/admin/offers", icon: ShieldAlert },
      { labelKey: "products", path: "/admin/produits", icon: Package },
      { labelKey: "productSubmissions", path: "/admin/produits-soumis", icon: ClipboardList },
      { labelKey: "categories", path: "/admin/categories", icon: Layers },
      { label: "Anomalies catégorie", path: "/admin/categories/anomalies", icon: Layers },
      { labelKey: "brands", path: "/admin/marques", icon: Tag },
      { labelKey: "manufacturers", path: "/admin/fabricants", icon: Factory },
      { labelKey: "delegates", path: "/admin/delegues", icon: Users2 },
      { labelKey: "pimSchemas", path: "/admin/schemas-pim", icon: SlidersHorizontal },
      // Entrée "productPrices" supprimée — édition prix par offre via /vendor/offers (offer_buyer_profile_prices)
      { labelKey: "orders", path: "/admin/commandes", icon: ShoppingCart },
      { label: "Commissions & Revenus", path: "/admin/commissions-revenus", icon: DollarSign },
      { label: "Nouvelle commande manuelle", path: "/admin/commandes/nouvelle", icon: Plus },
      { label: "Devis", path: "/admin/devis", icon: FileText },
      { label: "Commandes en retard", path: "/admin/commandes-en-retard", icon: AlertTriangle },
      { label: "Fan-out vendeurs", path: "/admin/vendor-fanout", icon: Send },
      { label: "Falco / Peppol", path: "/admin/falco-status", icon: Zap },
      { label: "Customers", path: "/admin/customers", icon: Users },
      { labelKey: "disputes", path: "/admin/litiges", icon: AlertCircle },
      { labelKey: "finances", path: "/admin/finances", icon: DollarSign },
      { labelKey: "commissions", path: "/admin/commissions", icon: Percent },
      { label: "Commissions personnalisées", path: "/admin/commission-overrides", icon: Percent },
      { labelKey: "stripeConnect", path: "/admin/stripe-commissions", icon: CreditCard },
      { labelKey: "stripeRevenue", path: "/admin/stripe-revenue", icon: TrendingUp },
      { labelKey: "syncQogita", path: "/admin/sync", icon: RefreshCw },
      { label: "Statut sync Qogita", path: "/admin/qogita-status", icon: Activity },
      { label: "Connexion Qogita", path: "/admin/qogita-connection", icon: Key },
      { labelKey: "marketCodes", path: "/admin/market-codes", icon: Hash },
    ],
  },
  {
    labelKey: "intelligenceModules",
    label: "MODULES INTELLIGENCE",
    items: [
      { label: "Aperçu vendeurs", path: "/admin/intelligence-apercu", icon: Activity },
      { label: "Paywall + paliers + onglets", path: "/admin/modules-intelligence", icon: ShieldCheck },
    ],
  },
  {
    labelKey: "intelligence",
    items: [
      { labelKey: "priceCockpit", path: "/admin/prix-cockpit", icon: TrendingDown },
      { label: "Veille marché vendeurs", path: "/admin/vendor-market-intel", icon: Activity },
      { label: "Écarts prix anormaux", path: "/admin/market-delta-anomalies", icon: AlertTriangle },
      { label: "Seuils écarts prix", path: "/admin/market-delta-thresholds", icon: SlidersHorizontal },
      { label: "Audit conditionnements", path: "/admin/pack-audit", icon: Package },
      { label: "Panier Tendances (Qogita)", path: "/admin/tendances-index-basket", icon: TrendingDown },
      { labelKey: "priceWatch", path: "/admin/veille-prix", icon: Eye },
      { labelKey: "priceAlerts", path: "/admin/price-alerts", icon: AlertTriangle },
      { labelKey: "leads", path: "/admin/leads", icon: Link },
      { label: "Liens & QR tracés", path: "/admin/tracking-campaigns", icon: QrCode },
      { labelKey: "analytics", path: "/admin/analytics", icon: BarChart3 },
      { label: "Analytics clients", path: "/admin/analytics-clients", icon: Users },
      { label: "Recherches utilisateurs", path: "/admin/recherches", icon: Search },
      { labelKey: "catalogDiagnostics", path: "/admin/catalog-diagnostics", icon: ShieldCheckAlt },
      { label: "OCR — Calcul d'économies", path: "/admin/savings-ocr", icon: Search },
      { labelKey: "offerDataQuality", path: "/admin/offer-data-quality", icon: AlertTriangle },
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
      { label: "Home — Marques", path: "/admin/cms/home/marques", icon: Tag },
      { label: "Médias marques/fabricants", path: "/admin/media", icon: ImageIcon },
      { label: "Home — Produits", path: "/admin/cms/home/produits", icon: Package },
      { label: "Home — Comparaison live", path: "/admin/cms/home/comparaison", icon: TrendingDown },
      { labelKey: "onboardingCms", path: "/admin/onboarding-cms", icon: ClipboardList },
      { labelKey: "flashDeals", path: "/admin/flash-deals", icon: Zap },
      { labelKey: "investPipeline", path: "/admin/invest-pipeline", icon: DollarSign },
      { labelKey: "translations", path: "/admin/translations", icon: Globe },
    ],
  },
  {
    labelKey: "restock",
    items: [
      { labelKey: "restockOffers", path: "/admin/restock/offers", icon: LayoutGrid },
      { labelKey: "restockBuyers", path: "/admin/restock/buyers", icon: Users2 },
      { labelKey: "restockCampaigns", path: "/admin/restock/campaigns", icon: Mail },
      { labelKey: "restockRules", path: "/admin/restock/rules", icon: Shield },
    ],
  },
  {
    labelKey: "rfq",
    items: [
      { label: "Console RFQ", path: "/admin/rfq", icon: MessageSquare },
      { label: "Crédits & plans", path: "/admin/rfq-credits", icon: CreditCard },
      { label: "Historique crédits", path: "/admin/rfq-ledger", icon: ClipboardList },
      { label: "Plans (config)", path: "/admin/rfq-plans", icon: Settings },
      { label: "Templates de relance", path: "/admin/rfq-reminders", icon: Mail },
      { label: "Audit du routage", path: "/admin/rfq-routing-audit", icon: ShieldCheck },
      { label: "Test du routage", path: "/admin/rfq-routing-test", icon: ShieldCheckAlt },
      { label: "Ventes privées P2P", path: "/admin/ventes-privees", icon: Users },
    ],
  },
  {
    labelKey: "operations",
    items: [
      { labelKey: "users", path: "/admin/users", icon: Users },
      { label: "Invitations en attente", path: "/admin/account-invitations", icon: Mail },
      { label: "Alignement Owner vendeurs", path: "/admin/vendor-owner-alignment", icon: ShieldCheck },
      { labelKey: "profils", path: "/admin/profils", icon: Shield },
      { labelKey: "logistics", path: "/admin/logistique", icon: Truck },
      { labelKey: "shipments", path: "/admin/shipments", icon: Package },
      { labelKey: "reconciliation", path: "/admin/reconciliation", icon: Recycle },
      { labelKey: "shippingOptions", path: "/admin/shipping-options", icon: Package },
      { labelKey: "team", path: "/admin/equipe", icon: ShieldCheck },
      { labelKey: "apiKeys", path: "/admin/api-keys", icon: Key },
      { labelKey: "apiDocs", path: "/admin/api-docs", icon: Book },
      { labelKey: "countries", path: "/admin/pays", icon: Globe },
      { labelKey: "settings", path: "/admin/parametres", icon: Settings },
      { label: "Modules du site", path: "/admin/modules", icon: Settings },
      { labelKey: "logs", path: "/admin/logs", icon: FileText },
      { labelKey: "auditLog", path: "/admin/audit-log", icon: ClipboardList },
      { labelKey: "contractAudit", path: "/admin/contract-audit", icon: ShieldCheckAlt },
      { label: "Contrat vendeur (template)", path: "/admin/contract-template", icon: FileText },
      { label: "Email templates", path: "/admin/email-templates", icon: Mail },
    ],
  },
];

const AdminSidebar = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { adminName, role } = useAdminAuth();

  const { data: pendingVendorsCount = 0 } = useQuery({
    queryKey: ["pending-vendors-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("vendors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false)
        .eq("is_verified", false);
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: adminUnreadNotifs = 0 } = useQuery({
    queryKey: ["admin-notifications-unread"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_notifications_unread_count");
      if (error) return 0;
      return (data as number) ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: actionCenter } = useActionCenter("admin");
  const sectionCounts: Record<string, number> = {};
  for (const s of actionCenter?.sections ?? []) sectionCounts[s.key] = s.count;
  const pathToSection: Record<string, string> = {
    "/admin/rfq": "rfq",
    "/admin/vendeurs": "kyc",
    "/admin/produits-soumis": "submissions",
    "/admin/categories/anomalies": "anomalies",
    "/admin/contract-audit": "security",
    "/admin/commandes": "orders",
    "/admin/commandes-en-retard": "orders_sla",
  };

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
      {/* Logo + bell */}
      <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-2">
        <div>
          <img src={logoLight} alt="MediKong.pro" className="h-16" />
          <p className="text-[11px] mt-1" style={{ color: "#8B95A5" }}>
            {t("superadminPanel")}
          </p>
        </div>
        <NotificationsBell scope="admin" variant="dark" />
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
        <NavLink
          to="/admin/notifications"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors mt-0.5 ${
            isActive("/admin/notifications")
              ? "text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
          style={isActive("/admin/notifications") ? { backgroundColor: "#1B5BDA" } : {}}
        >
          <Bell size={17} strokeWidth={1.8} />
          <span className="flex-1">Notifications</span>
          {adminUnreadNotifs > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#EF4444", minWidth: 18, textAlign: "center" }}>
              {adminUnreadNotifs > 99 ? "99+" : adminUnreadNotifs}
            </span>
          )}
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
              {section.label ?? t(section.labelKey)}
            </p>
            {section.items.map((item) => {
              const acKey = pathToSection[item.path];
              const acCount = acKey ? sectionCounts[acKey] ?? 0 : 0;
              const legacyBadge = item.path === "/admin/vendeurs" ? pendingVendorsCount : 0;
              const badgeCount = Math.max(acCount, legacyBadge);
              return (
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
                  <span className="flex-1">{item.label ?? (item.labelKey ? t(item.labelKey) : "")}</span>
                  {badgeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "#EF4444", minWidth: 18, textAlign: "center" }}>
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
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
