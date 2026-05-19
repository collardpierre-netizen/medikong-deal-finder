import { Suspense } from "react"; // v2
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { CartProvider } from "@/contexts/CartContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { CountryProvider } from "@/contexts/CountryContext";
import { PriceDisplayProvider } from "@/contexts/PriceDisplayContext";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import { EnvNoIndex } from "@/components/layout/EnvNoIndex";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { HelmetProvider } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { SafeBoundary } from "@/components/SafeBoundary";
import { LazyRouteBoundary } from "@/components/LazyRouteBoundary";

// Page loader for lazy routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-mk-blue" />
    </div>
  );
}

// Redirige l'ancienne route singulier (/marque/:slug) vers la nouvelle (/marques/:slug)
function RedirectBrandSingular() {
  const { slug } = useParams();
  return <Navigate to={`/marques/${slug ?? ""}`} replace />;
}

// Redirection /shop → /catalogue avec conservation des query params et hash
function RedirectShopToCatalogue() {
  const { search, hash } = useLocation();
  return <Navigate to={`/catalogue${search}${hash}`} replace />;
}

// Lazy load ALL pages
const HomePage = lazyWithRetry(() => import("./pages/HomePage"), "HomePage");
const SearchResultsPage = lazyWithRetry(() => import("./pages/SearchResultsPage"), "SearchResultsPage");
const ProductPage = lazyWithRetry(() => import("./pages/ProductPage"), "ProductPage");
const BrandsPage = lazyWithRetry(() => import("./pages/BrandsPage"), "BrandsPage");
const BrandDetailPage = lazyWithRetry(() => import("./pages/BrandDetailPage"), "BrandDetailPage");
const ManufacturerPage = lazyWithRetry(() => import("./pages/ManufacturerPage"), "ManufacturerPage");
const FabricantsPage = lazyWithRetry(() => import("./pages/FabricantsPage"), "FabricantsPage");
const CartPage = lazyWithRetry(() => import("./pages/CartPage"), "CartPage");
const AccountPage = lazyWithRetry(() => import("./pages/AccountPage"), "AccountPage");
const CheckoutPage = lazyWithRetry(() => import("./pages/CheckoutPage"), "CheckoutPage");
const ConfirmationPage = lazyWithRetry(() => import("./pages/ConfirmationPage"), "ConfirmationPage");
const OrderDetailPage = lazyWithRetry(() => import("./pages/OrderDetailPage"), "OrderDetailPage");
const LoginPage = lazyWithRetry(() => import("./pages/LoginPage"), "LoginPage");
const CategoryPage = lazyWithRetry(() => import("./pages/CategoryPage"), "CategoryPage");
const CataloguePage = lazyWithRetry(() => import("./pages/CataloguePage"), "CataloguePage");
const PromotionsPage = lazyWithRetry(() => import("./pages/PromotionsPage"), "PromotionsPage");
const OnboardingPage = lazyWithRetry(() => import("./pages/OnboardingPage"), "OnboardingPage");
const BuyerCompletionPage = lazyWithRetry(() => import("./pages/BuyerCompletionPage"), "BuyerCompletionPage");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");
const SellerTrustBadgeDemo = lazyWithRetry(() => import("./pages/SellerTrustBadgeDemo"), "SellerTrustBadgeDemo");
const DelegateDesignDemoPage = lazyWithRetry(() => import("./pages/DelegateDesignDemoPage"), "DelegateDesignDemoPage");
const InvestPage = lazyWithRetry(() => import("./pages/InvestPage"), "InvestPage");
const ForgotPasswordPage = lazyWithRetry(() => import("./pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyWithRetry(() => import("./pages/ResetPasswordPage"), "ResetPasswordPage");
const VendorPublicPage = lazyWithRetry(() => import("./pages/VendorPublicPage"), "VendorPublicPage");
const VendorLegacySlugGone = lazyWithRetry(() => import("./pages/VendorLegacySlugGone"), "VendorLegacySlugGone");
import { isLegacyVendorSlug } from "./pages/VendorLegacySlugGone";
import { useParams as useParamsForVendorGate } from "react-router-dom";
function VendorRouteGate() {
  const { code } = useParamsForVendorGate<{ code: string }>();
  // Ancien slug nominatif → 410 Gone (noindex,nofollow, sans redirect).
  // display_code 6 chars alphanum → page vendeur publique anonymisée.
  return isLegacyVendorSlug(code) ? <VendorLegacySlugGone /> : <VendorPublicPage />;
}
const DelegatePublicPage = lazyWithRetry(() => import("./pages/DelegatePublicPage"), "DelegatePublicPage");
const ProfessionnelsPage = lazyWithRetry(() => import("./pages/ProfessionnelsPage"), "ProfessionnelsPage");
const SourcingPage = lazyWithRetry(() => import("./pages/SourcingPage"), "SourcingPage");
const CategoriesPage = lazyWithRetry(() => import("./pages/CategoriesPage"), "CategoriesPage");
const MyPricesPage = lazyWithRetry(() => import("./pages/MyPricesPage"), "MyPricesPage");
const MyPriceAlertsPage = lazyWithRetry(() => import("./pages/MyPriceAlertsPage"), "MyPriceAlertsPage");
const MesCategoriesPage = lazyWithRetry(() => import("./pages/MesCategoriesPage"), "MesCategoriesPage");
const MesRfqPage = lazyWithRetry(() => import("./pages/MesRfqPage"), "MesRfqPage");
const RfqCreditsPage = lazyWithRetry(() => import("./pages/RfqCreditsPage"), "RfqCreditsPage");
const ImportHistoryPage = lazyWithRetry(() => import("./pages/ImportHistoryPage"), "ImportHistoryPage");
const PharmacieAbonnementPage = lazyWithRetry(() => import("./pages/PharmacieAbonnementPage"), "PharmacieAbonnementPage");
const EconomiesPage = lazyWithRetry(() => import("./pages/EconomiesPage"), "EconomiesPage");
const BonnesAffairesPage = lazyWithRetry(() => import("./pages/BonnesAffairesPage"), "BonnesAffairesPage");

// Segment landing pages
const PharmaciesPage = lazyWithRetry(() => import("./pages/segment/PharmaciesPage"), "PharmaciesPage");
const EhpadPage = lazyWithRetry(() => import("./pages/segment/EhpadPage"), "EhpadPage");
const GrossistesPage = lazyWithRetry(() => import("./pages/segment/GrossistesPage"), "GrossistesPage");
const HopitauxPage = lazyWithRetry(() => import("./pages/segment/HopitauxPage"), "HopitauxPage");
const CabinetsMedicauxPage = lazyWithRetry(() => import("./pages/segment/CabinetsMedicauxPage"), "CabinetsMedicauxPage");
const DentistesPage = lazyWithRetry(() => import("./pages/segment/DentistesPage"), "DentistesPage");
const VeterinairesPage = lazyWithRetry(() => import("./pages/segment/VeterinairesPage"), "VeterinairesPage");

// Entreprise pages
const AboutPage = lazyWithRetry(() => import("./pages/entreprise/AboutPage"), "AboutPage");
const WhyMedikongPage = lazyWithRetry(() => import("./pages/entreprise/WhyMedikongPage"), "WhyMedikongPage");
const HowItWorksPage = lazyWithRetry(() => import("./pages/entreprise/HowItWorksPage"), "HowItWorksPage");
const TeamPage = lazyWithRetry(() => import("./pages/entreprise/TeamPage"), "TeamPage");

// Trust pages
const SupplierVerificationPage = lazyWithRetry(() => import("./pages/trust/SupplierVerificationPage"), "SupplierVerificationPage");
const QualityGuaranteePage = lazyWithRetry(() => import("./pages/trust/QualityGuaranteePage"), "QualityGuaranteePage");
const HowToOrderPage = lazyWithRetry(() => import("./pages/trust/HowToOrderPage"), "HowToOrderPage");
const BuyNowPayLaterPage = lazyWithRetry(() => import("./pages/trust/BuyNowPayLaterPage"), "BuyNowPayLaterPage");
const LogisticsPage = lazyWithRetry(() => import("./pages/trust/LogisticsPage"), "LogisticsPage");
const BecomeSellerPage = lazyWithRetry(() => import("./pages/trust/BecomeSellerPage"), "BecomeSellerPage");
const TestimonialsPage = lazyWithRetry(() => import("./pages/trust/TestimonialsPage"), "TestimonialsPage");
const ContactPage = lazyWithRetry(() => import("./pages/trust/ContactPage"), "ContactPage");
const HelpCenterPage = lazyWithRetry(() => import("./pages/trust/HelpCenterPage"), "HelpCenterPage");
const HelpArticlePage = lazyWithRetry(() => import("./pages/trust/HelpArticlePage"), "HelpArticlePage");
const HelpCategoryPage = lazyWithRetry(() => import("./pages/trust/HelpCategoryPage"), "HelpCategoryPage");
const PricingBasisHelpPage = lazyWithRetry(() => import("./pages/help/PricingBasisHelpPage"), "PricingBasisHelpPage");
const UnsubscribePage = lazyWithRetry(() => import("./pages/UnsubscribePage"), "UnsubscribePage");

// Legal pages
const LegalNoticePage = lazyWithRetry(() => import("./pages/legal/LegalNoticePage"), "LegalNoticePage");
const TermsPage = lazyWithRetry(() => import("./pages/legal/TermsPage"), "TermsPage");
const PrivacyPage = lazyWithRetry(() => import("./pages/legal/PrivacyPage"), "PrivacyPage");
const CookiePolicyPage = lazyWithRetry(() => import("./pages/legal/CookiePolicyPage"), "CookiePolicyPage");

// Admin pages
const AdminLoginPage = lazyWithRetry(() => import("./pages/admin/AdminLoginPage"), "AdminLoginPage");
const AdminLayout = lazyWithRetry(() => import("./components/admin/AdminLayout"), "AdminLayout");
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"), "AdminDashboard");
const AdminVendeurs = lazyWithRetry(() => import("./pages/admin/AdminVendeurs"), "AdminVendeurs");
const AdminAbonnements = lazyWithRetry(() => import("./pages/admin/AdminAbonnements"), "AdminAbonnements");
const AdminVendors = lazyWithRetry(() => import("./pages/admin/AdminVendors"), "AdminVendors");
const AdminVendeurDetail = lazyWithRetry(() => import("./pages/admin/AdminVendeurDetail"), "AdminVendeurDetail");
const AdminOnboarding = lazyWithRetry(() => import("./pages/admin/AdminOnboarding"), "AdminOnboarding");
const AdminProduits = lazyWithRetry(() => import("./pages/admin/AdminProduits"), "AdminProduits");
const AdminProduitDetail = lazyWithRetry(() => import("./pages/admin/AdminProduitDetail"), "AdminProduitDetail");
const AdminSchemasPIM = lazyWithRetry(() => import("./pages/admin/AdminSchemasPIM"), "AdminSchemasPIM");
const AdminCommandes = lazyWithRetry(() => import("./pages/admin/AdminCommandes"), "AdminCommandes");
const AdminFinances = lazyWithRetry(() => import("./pages/admin/AdminFinances"), "AdminFinances");
const AdminLitiges = lazyWithRetry(() => import("./pages/admin/AdminLitiges"), "AdminLitiges");
const AdminCommandesEnRetard = lazyWithRetry(() => import("./pages/admin/AdminCommandesEnRetard"), "AdminCommandesEnRetard");
const AdminVeillePrix = lazyWithRetry(() => import("./pages/admin/AdminVeillePrix"), "AdminVeillePrix");
const AdminPackAnomalies = lazyWithRetry(() => import("./pages/admin/AdminPackAnomalies"), "AdminPackAnomalies");
const AdminPackSizeBackfill = lazyWithRetry(() => import("./pages/admin/AdminPackSizeBackfill"), "AdminPackSizeBackfill");
const AdminPackSizeMismatches = lazyWithRetry(() => import("./pages/admin/AdminPackSizeMismatches"), "AdminPackSizeMismatches");
const AdminLeads = lazyWithRetry(() => import("./pages/admin/AdminLeads"), "AdminLeads");
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/AdminAnalytics"), "AdminAnalytics");
const AdminRecherches = lazyWithRetry(() => import("./pages/admin/AdminRecherches"), "AdminRecherches");
const AdminReglementaire = lazyWithRetry(() => import("./pages/admin/AdminReglementaire"), "AdminReglementaire");
const AdminImportExport = lazyWithRetry(() => import("./pages/admin/AdminImportExport"), "AdminImportExport");
const AdminCategories = lazyWithRetry(() => import("./pages/admin/AdminCategories"), "AdminCategories");
const AdminMarques = lazyWithRetry(() => import("./pages/admin/AdminMarques"), "AdminMarques");
const AdminBrandTransparenceEdit = lazyWithRetry(() => import("./pages/admin/AdminBrandTransparenceEdit"), "AdminBrandTransparenceEdit");
const AdminBrandDuplicates = lazyWithRetry(() => import("./pages/admin/AdminBrandDuplicates"), "AdminBrandDuplicates");
const AdminSourceMapping = lazyWithRetry(() => import("./pages/admin/AdminSourceMapping"), "AdminSourceMapping");
const AdminCRM = lazyWithRetry(() => import("./pages/admin/AdminCRM"), "AdminCRM");
const AdminCMS = lazyWithRetry(() => import("./pages/admin/AdminCMS"), "AdminCMS");
const AdminCmsPartnerLogos = lazyWithRetry(() => import("./pages/admin/AdminCmsPartnerLogos"), "AdminCmsPartnerLogos");
const AdminCmsHomeBrands = lazyWithRetry(() => import("./pages/admin/AdminCmsHomeBrands"), "AdminCmsHomeBrands");
const AdminCmsHomeProducts = lazyWithRetry(() => import("./pages/admin/AdminCmsHomeProducts"), "AdminCmsHomeProducts");
const AdminCmsHomeShowcase = lazyWithRetry(() => import("./pages/admin/AdminCmsHomeShowcase"), "AdminCmsHomeShowcase");
const AdminUnmappedCategories = lazyWithRetry(() => import("./pages/admin/AdminUnmappedCategories"), "AdminUnmappedCategories");
const AdminSourcingPipeline = lazyWithRetry(() => import("./pages/admin/AdminSourcingPipeline"), "AdminSourcingPipeline");
const AdminCategoryAnomalies = lazyWithRetry(() => import("./pages/admin/AdminCategoryAnomalies"), "AdminCategoryAnomalies");
const AdminCategoryAnomalyDetail = lazyWithRetry(() => import("./pages/admin/AdminCategoryAnomalyDetail"), "AdminCategoryAnomalyDetail");
const AdminQogitaLlmMapping = lazyWithRetry(() => import("./pages/admin/AdminQogitaLlmMapping"), "AdminQogitaLlmMapping");
const AdminBrandProductCardPreview = lazyWithRetry(() => import("./pages/admin/AdminBrandProductCardPreview"), "AdminBrandProductCardPreview");
const AdminQogitaAmbiguousReview = lazyWithRetry(() => import("./pages/admin/AdminQogitaAmbiguousReview"), "AdminQogitaAmbiguousReview");
const AdminCategoryMappingDashboard = lazyWithRetry(() => import("./pages/admin/AdminCategoryMappingDashboard"), "AdminCategoryMappingDashboard");
// AdminProductPrices supprimé : remplacé par offer_buyer_profile_prices (édition par offre dans /vendor/offers).
const AdminInvestPipeline = lazyWithRetry(() => import("./pages/admin/AdminInvestPipeline"), "AdminInvestPipeline");
const AdminLogistique = lazyWithRetry(() => import("./pages/admin/AdminLogistique"), "AdminLogistique");
const AdminShippingOptions = lazyWithRetry(() => import("./pages/admin/AdminShippingOptions"), "AdminShippingOptions");
const AdminEquipe = lazyWithRetry(() => import("./pages/admin/AdminEquipe"), "AdminEquipe");
const AdminProfils = lazyWithRetry(() => import("./pages/admin/AdminProfils"), "AdminProfils");
const AdminParametres = lazyWithRetry(() => import("./pages/admin/AdminParametres"), "AdminParametres");
const AdminLogs = lazyWithRetry(() => import("./pages/admin/AdminLogs"), "AdminLogs");
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"), "AdminUsers");
const AdminAuditLog = lazyWithRetry(() => import("./pages/admin/AdminAuditLog"), "AdminAuditLog");
const AuditAchatsPage = lazyWithRetry(() => import("./pages/AuditAchatsPage"), "AuditAchatsPage");
const AuditAchatsConfirmationPage = lazyWithRetry(() => import("./pages/AuditAchatsConfirmationPage"), "AuditAchatsConfirmationPage");
const AuditsAdminPage = lazyWithRetry(() => import("./pages/admin/AuditsAdminPage"), "AuditsAdminPage");
const AdminContractAudit = lazyWithRetry(() => import("./pages/admin/AdminContractAudit"), "AdminContractAudit");
const AdminDbBackups = lazyWithRetry(() => import("./pages/admin/AdminDbBackups"), "AdminDbBackups");
const AdminBackupRlsAudit = lazyWithRetry(() => import("./pages/admin/AdminBackupRlsAudit"), "AdminBackupRlsAudit");
const AdminRfqCreditsPage = lazyWithRetry(() => import("./pages/admin/AdminRfqCreditsPage"), "AdminRfqCreditsPage");
const AdminRfqLedgerPage = lazyWithRetry(() => import("./pages/admin/AdminRfqLedgerPage"), "AdminRfqLedgerPage");
const AdminRfqPlansPage = lazyWithRetry(() => import("./pages/admin/AdminRfqPlansPage"), "AdminRfqPlansPage");
const AdminPriceCockpitPage = lazyWithRetry(() => import("./pages/admin/AdminPriceCockpitPage"), "AdminPriceCockpitPage");
const AdminMarketDeltaAnomaliesPage = lazyWithRetry(() => import("./pages/admin/AdminMarketDeltaAnomaliesPage"), "AdminMarketDeltaAnomaliesPage");
const AdminMarketDeltaThresholdsPage = lazyWithRetry(() => import("./pages/admin/AdminMarketDeltaThresholdsPage"), "AdminMarketDeltaThresholdsPage");
const AdminPackAuditPage = lazyWithRetry(() => import("./pages/admin/AdminPackAuditPage"), "AdminPackAuditPage");
const AdminRfqRemindersPage = lazyWithRetry(() => import("./pages/admin/AdminRfqRemindersPage"), "AdminRfqRemindersPage");
const AdminRfqRoutingTestPage = lazyWithRetry(() => import("./pages/admin/AdminRfqRoutingTestPage"), "AdminRfqRoutingTestPage");
const AdminRfqRoutingAuditPage = lazyWithRetry(() => import("./pages/admin/AdminRfqRoutingAuditPage"), "AdminRfqRoutingAuditPage");
const AdminVendorMarketIntelPage = lazyWithRetry(() => import("./pages/admin/AdminVendorMarketIntelPage"), "AdminVendorMarketIntelPage");
const AdminAnnouncementBar = lazyWithRetry(() => import("./pages/admin/AdminAnnouncementBar"), "AdminAnnouncementBar");
const AdminFeatureFlags = lazyWithRetry(() => import("./pages/admin/AdminFeatureFlags"), "AdminFeatureFlags");
const AdminI18nPilot = lazyWithRetry(() => import("./pages/admin/AdminI18nPilot"), "AdminI18nPilot");
const AdminCatalogDiagnostics = lazyWithRetry(() => import("./pages/admin/AdminCatalogDiagnostics"), "AdminCatalogDiagnostics");
const AdminSearchDebug = lazyWithRetry(() => import("./pages/admin/AdminSearchDebug"), "AdminSearchDebug");
const AdminOfferDataQuality = lazyWithRetry(() => import("./pages/admin/AdminOfferDataQuality"), "AdminOfferDataQuality");
const AdminSavingsOcr = lazyWithRetry(() => import("./pages/admin/AdminSavingsOcr"), "AdminSavingsOcr");
const AdminProductSubmissions = lazyWithRetry(() => import("./pages/admin/AdminProductSubmissions"), "AdminProductSubmissions");
const AdminCommissions = lazyWithRetry(() => import("./pages/admin/AdminCommissions"), "AdminCommissions");
const AdminCommissionOverridesPage = lazyWithRetry(() => import("./pages/admin/AdminCommissionOverridesPage"), "AdminCommissionOverridesPage");
const AdminOnboardingCMS = lazyWithRetry(() => import("./pages/admin/AdminOnboardingCMS"), "AdminOnboardingCMS");
const AdminSync = lazyWithRetry(() => import("./pages/admin/AdminSync"), "AdminSync");
const AdminFabricants = lazyWithRetry(() => import("./pages/admin/AdminFabricants"), "AdminFabricants");
const AdminApiKeys = lazyWithRetry(() => import("./pages/admin/AdminApiKeys"), "AdminApiKeys");
const AdminApiDocs = lazyWithRetry(() => import("./pages/admin/AdminApiDocs"), "AdminApiDocs");
const AdminCountries = lazyWithRetry(() => import("./pages/admin/AdminCountries"), "AdminCountries");
const AdminMarketCodes = lazyWithRetry(() => import("./pages/admin/AdminMarketCodes"), "AdminMarketCodes");
const AdminExternalVendors = lazyWithRetry(() => import("./pages/admin/AdminExternalVendors"), "AdminExternalVendors");
const AdminExternalVatAudit = lazyWithRetry(() => import("./pages/admin/AdminExternalVatAudit"), "AdminExternalVatAudit");
const AdminVatRules = lazyWithRetry(() => import("./pages/admin/AdminVatRules"), "AdminVatRules");
const AdminStripeCommissions = lazyWithRetry(() => import("./pages/admin/AdminStripeCommissions"), "AdminStripeCommissions");
const AdminStripeRevenue = lazyWithRetry(() => import("./pages/admin/AdminStripeRevenue"), "AdminStripeRevenue");
const AdminOrderRefund = lazyWithRetry(() => import("./pages/admin/AdminOrderRefund"), "AdminOrderRefund");
const AdminTranslations = lazyWithRetry(() => import("./pages/admin/AdminTranslations"), "AdminTranslations");
const AdminPriceAlerts = lazyWithRetry(() => import("./pages/admin/AdminPriceAlerts"), "AdminPriceAlerts");
const AdminPriceAlertDetail = lazyWithRetry(() => import("./pages/admin/AdminPriceAlertDetail"), "AdminPriceAlertDetail");
const AdminPriceAlertSettings = lazyWithRetry(() => import("./pages/admin/AdminPriceAlertSettings"), "AdminPriceAlertSettings");
const AdminFlashDeals = lazyWithRetry(() => import("./pages/admin/AdminFlashDeals"), "AdminFlashDeals");
const AdminDelegues = lazyWithRetry(() => import("./pages/admin/AdminDelegues"), "AdminDelegues");
const AdminShipments = lazyWithRetry(() => import("./pages/admin/AdminShipments"), "AdminShipments");
const AdminReconciliation = lazyWithRetry(() => import("./pages/admin/AdminReconciliation"), "AdminReconciliation");

// Vendor pages
const VendorLoginPage = lazyWithRetry(() => import("./pages/vendor/VendorLoginPage"), "VendorLoginPage");
const VendorOrderPage = lazyWithRetry(() => import("./pages/VendorOrderPage"), "VendorOrderPage");
const VendorLayout = lazyWithRetry(() => import("./components/vendor/VendorLayout"), "VendorLayout");
const VendorDashboard = lazyWithRetry(() => import("./pages/vendor/VendorDashboard"), "VendorDashboard");

const VendorOffers = lazyWithRetry(() => import("./pages/vendor/VendorOffers"), "VendorOffers");
const VendorCatalog = lazyWithRetry(() => import("./pages/vendor/VendorCatalog"), "VendorCatalog");
const VendorProductSubmissionPage = lazyWithRetry(() => import("./pages/vendor/VendorProductSubmissionPage"), "VendorProductSubmissionPage");
const VendorNotifications = lazyWithRetry(() => import("./pages/vendor/VendorNotifications"), "VendorNotifications");
const VendorOrders = lazyWithRetry(() => import("./pages/vendor/VendorOrders"), "VendorOrders");
const VendorOpportunities = lazyWithRetry(() => import("./pages/vendor/VendorOpportunities"), "VendorOpportunities");
const VendorCompetitorAlerts = lazyWithRetry(() => import("./pages/vendor/VendorCompetitorAlerts"), "VendorCompetitorAlerts");
const VendorMarketIntelHub = lazyWithRetry(() => import("./pages/vendor/VendorMarketIntelHub"), "VendorMarketIntelHub");
const VendorTenders = lazyWithRetry(() => import("./pages/vendor/VendorTenders"), "VendorTenders");
const VendorRfqInbox = lazyWithRetry(() => import("./pages/vendor/VendorRfqInbox"), "VendorRfqInbox");
const VendorAnalytics = lazyWithRetry(() => import("./pages/vendor/VendorAnalytics"), "VendorAnalytics");
const VendorFinance = lazyWithRetry(() => import("./pages/vendor/VendorFinance"), "VendorFinance");
const VendorLogistics = lazyWithRetry(() => import("./pages/vendor/VendorLogistics"), "VendorLogistics");
const VendorHealth = lazyWithRetry(() => import("./pages/vendor/VendorHealth"), "VendorHealth");
const VendorAcademy = lazyWithRetry(() => import("./pages/vendor/VendorAcademy"), "VendorAcademy");
const VendorSettings = lazyWithRetry(() => import("./pages/vendor/VendorSettings"), "VendorSettings");
const VendorStripeOnboardingPage = lazyWithRetry(() => import("./pages/vendor/VendorStripeOnboardingPage"), "VendorStripeOnboardingPage");
const VendorStripeSuccessPage = lazyWithRetry(() => import("./pages/vendor/VendorStripeSuccessPage"), "VendorStripeSuccessPage");
const VendorStripeRefreshPage = lazyWithRetry(() => import("./pages/vendor/VendorStripeRefreshPage"), "VendorStripeRefreshPage");
const VendorMessages = lazyWithRetry(() => import("./pages/vendor/VendorMessages"), "VendorMessages");
const VendorOnboardingWizard = lazyWithRetry(() => import("./pages/vendor/VendorOnboardingWizard"), "VendorOnboardingWizard");
const VendorNewShipment = lazyWithRetry(() => import("./pages/vendor/VendorNewShipment"), "VendorNewShipment");
const VendorShipments = lazyWithRetry(() => import("./pages/vendor/VendorShipments"), "VendorShipments");
const VendorShipmentDetail = lazyWithRetry(() => import("./pages/vendor/VendorShipmentDetail"), "VendorShipmentDetail");
const VendorBilling = lazyWithRetry(() => import("./pages/vendor/VendorBilling"), "VendorBilling");
const VendorContractPage = lazyWithRetry(() => import("./pages/vendor/VendorContractPage"), "VendorContractPage");
const VendorContractChangelogPage = lazyWithRetry(() => import("./pages/vendor/VendorContractChangelogPage"), "VendorContractChangelogPage");

// ReStock pages
const RestockSiteLayout = lazyWithRetry(() => import("./components/restock/RestockSiteLayout"), "RestockSiteLayout");
const RestockSellerNewOffer = lazyWithRetry(() => import("./pages/restock/RestockSellerNewOffer"), "RestockSellerNewOffer");
const RestockSellerOffers = lazyWithRetry(() => import("./pages/restock/RestockSellerOffers"), "RestockSellerOffers");
const RestockSellerCounterOffers = lazyWithRetry(() => import("./pages/restock/RestockSellerCounterOffers"), "RestockSellerCounterOffers");
const RestockSellerSales = lazyWithRetry(() => import("./pages/restock/RestockSellerSales"), "RestockSellerSales");
const RestockSellerHelp = lazyWithRetry(() => import("./pages/restock/RestockSellerHelp"), "RestockSellerHelp");
const RestockAdminOffers = lazyWithRetry(() => import("./pages/restock/RestockAdminOffers"), "RestockAdminOffers");
const RestockAdminBuyers = lazyWithRetry(() => import("./pages/restock/RestockAdminBuyers"), "RestockAdminBuyers");
const RestockAdminCampaigns = lazyWithRetry(() => import("./pages/restock/RestockAdminCampaigns"), "RestockAdminCampaigns");
const RestockAdminRules = lazyWithRetry(() => import("./pages/restock/RestockAdminRules"), "RestockAdminRules");
const RestockOpportunities = lazyWithRetry(() => import("./pages/restock/RestockOpportunities"), "RestockOpportunities");
const RestockLandingPage = lazyWithRetry(() => import("./pages/restock/RestockLandingPage"), "RestockLandingPage");
const RestockMobileSwipe = lazyWithRetry(() => import("./pages/restock/RestockMobileSwipe"), "RestockMobileSwipe");
const RestockSettings = lazyWithRetry(() => import("./pages/restock/RestockSettings"), "RestockSettings");
const RestockBuyerDashboard = lazyWithRetry(() => import("./pages/restock/RestockBuyerDashboard"), "RestockBuyerDashboard");
const RestockDrops = lazyWithRetry(() => import("./pages/restock/RestockDrops"), "RestockDrops");
const RestockFaqPage = lazyWithRetry(() => import("./pages/restock/RestockFaqPage"), "RestockFaqPage");
const RestockAdminFaq = lazyWithRetry(() => import("./pages/restock/RestockAdminFaq"), "RestockAdminFaq");
const RestockAdminPriceReferences = lazyWithRetry(() => import("./pages/restock/RestockAdminPriceReferences"), "RestockAdminPriceReferences");
const RestockAdminPayouts = lazyWithRetry(() => import("./pages/restock/RestockAdminPayouts"), "RestockAdminPayouts");
const RestockSellerReferral = lazyWithRetry(() => import("./pages/restock/RestockSellerReferral"), "RestockSellerReferral");
const RestockCheckout = lazyWithRetry(() => import("./pages/restock/RestockCheckout"), "RestockCheckout");
const PitchdeckRedirect = lazyWithRetry(() => import("./pages/PitchdeckRedirect"), "PitchdeckRedirect");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

function LP({ children }: { children: React.ReactNode }) {
  return (
    <LazyRouteBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </LazyRouteBoundary>
  );
}

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <I18nProvider>
      <CartProvider>
      <CountryProvider>
      <PriceDisplayProvider>
      <ImpersonationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <EnvNoIndex />
          <ImpersonationBanner />
          <LazyRouteBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LP><HomePage /></LP>} />
            <Route path="/pitchdeck" element={<PitchdeckRedirect />} />
            <Route path="/recherche" element={<LP><SearchResultsPage /></LP>} />
            <Route path="/produit/:slug" element={<LP><SafeBoundary label="la fiche produit"><ProductPage /></SafeBoundary></LP>} />
            <Route path="/marques" element={<LP><BrandsPage /></LP>} />
            <Route path="/marques/:slug" element={<LP><BrandDetailPage /></LP>} />
            {/* Redirection ancienne route singulier → pluriel */}
            <Route path="/marque/:slug" element={<RedirectBrandSingular />} />
            <Route path="/fabricants" element={<LP><FabricantsPage /></LP>} />
            <Route path="/fabricant/:slug" element={<LP><ManufacturerPage /></LP>} />
            <Route path="/vendeur/:code" element={<LP><VendorRouteGate /></LP>} />
            <Route path="/delegue/:delegateId" element={<LP><DelegatePublicPage /></LP>} />
            <Route path="/panier" element={<LP><CartPage /></LP>} />
            <Route path="/compte" element={<LP><AccountPage /></LP>} />
            <Route path="/compte/mes-categories" element={<LP><MesCategoriesPage /></LP>} />
            <Route path="/compte/mes-rfq" element={<LP><MesRfqPage /></LP>} />
            <Route path="/compte/rfq-credits" element={<LP><RfqCreditsPage /></LP>} />
            <Route path="/compte/imports" element={<LP><ImportHistoryPage /></LP>} />
            <Route path="/espace-pharmacie/abonnement" element={<LP><PharmacieAbonnementPage /></LP>} />
            <Route path="/checkout" element={<LP><CheckoutPage /></LP>} />
            <Route path="/confirmation" element={<LP><ConfirmationPage /></LP>} />
            <Route path="/commande/:id" element={<LP><OrderDetailPage /></LP>} />
            <Route path="/connexion" element={<LP><LoginPage /></LP>} />
            <Route path="/inscription" element={<Navigate to="/onboarding" replace />} />
            <Route path="/categorie/:slug" element={<LP><CataloguePage /></LP>} />
            <Route path="/catalogue" element={<LP><CataloguePage /></LP>} />
            <Route path="/shop" element={<RedirectShopToCatalogue />} />
            <Route path="/shop/*" element={<RedirectShopToCatalogue />} />
            <Route path="/promotions" element={<LP><PromotionsPage /></LP>} />
            <Route path="/seller-onboarding" element={<Navigate to="/onboarding" replace />} />
            <Route path="/buyer-onboarding" element={<Navigate to="/onboarding" replace />} />
            <Route path="/onboarding" element={<LP><OnboardingPage /></LP>} />
            <Route path="/buyer-completion" element={<LP><BuyerCompletionPage /></LP>} />
            <Route path="/invest" element={<LP><InvestPage /></LP>} />
            <Route path="/mot-de-passe-oublie" element={<LP><ForgotPasswordPage /></LP>} />
            <Route path="/reset-password" element={<LP><ResetPasswordPage /></LP>} />
            <Route path="/entreprise/a-propos" element={<LP><AboutPage /></LP>} />
            <Route path="/entreprise/pourquoi-medikong" element={<LP><WhyMedikongPage /></LP>} />
            <Route path="/entreprise/comment-ca-marche" element={<LP><HowItWorksPage /></LP>} />
            <Route path="/entreprise/equipe" element={<LP><TeamPage /></LP>} />
            <Route path="/entreprise/carrieres" element={<Navigate to="/" replace />} />
            <Route path="/entreprise/presse" element={<Navigate to="/" replace />} />
            <Route path="/entreprise/investir" element={<Navigate to="/invest" replace />} />
            {/* Redirects from old paths */}
            <Route path="/a-propos" element={<Navigate to="/entreprise/a-propos" replace />} />
            <Route path="/pourquoi-medikong" element={<Navigate to="/entreprise/pourquoi-medikong" replace />} />
            <Route path="/comment-ca-marche" element={<Navigate to="/entreprise/comment-ca-marche" replace />} />
            <Route path="/equipe" element={<Navigate to="/entreprise/equipe" replace />} />
            <Route path="/carrieres" element={<Navigate to="/entreprise/carrieres" replace />} />
            <Route path="/presse" element={<Navigate to="/entreprise/presse" replace />} />
            <Route path="/investir" element={<Navigate to="/entreprise/investir" replace />} />

            <Route path="/professionnels" element={<LP><ProfessionnelsPage /></LP>} />
            <Route path="/pharmacies" element={<LP><PharmaciesPage /></LP>} />
            <Route path="/ehpad" element={<LP><EhpadPage /></LP>} />
            <Route path="/grossistes" element={<LP><GrossistesPage /></LP>} />
            <Route path="/hopitaux" element={<LP><HopitauxPage /></LP>} />
            <Route path="/cabinets-medicaux" element={<LP><CabinetsMedicauxPage /></LP>} />
            <Route path="/dentistes" element={<LP><DentistesPage /></LP>} />
            <Route path="/veterinaires" element={<LP><VeterinairesPage /></LP>} />
            <Route path="/sourcing" element={<LP><SourcingPage /></LP>} />
            <Route path="/economies" element={<LP><EconomiesPage /></LP>} />
            <Route path="/calculateur-economies" element={<Navigate to="/economies" replace />} />
            <Route path="/bonnes-affaires" element={<LP><BonnesAffairesPage /></LP>} />
            <Route path="/categories" element={<LP><CategoriesPage /></LP>} />
            <Route path="/mes-prix" element={<LP><MyPricesPage /></LP>} />
            <Route path="/mes-alertes-prix" element={<LP><MyPriceAlertsPage /></LP>} />

            {/* Trust & Process */}
            <Route path="/verification-fournisseurs" element={<LP><SupplierVerificationPage /></LP>} />
            <Route path="/garantie-qualite" element={<LP><QualityGuaranteePage /></LP>} />
            <Route path="/comment-commander" element={<LP><HowToOrderPage /></LP>} />
            <Route path="/paiement-differe" element={<LP><BuyNowPayLaterPage /></LP>} />
            <Route path="/logistique" element={<LP><LogisticsPage /></LP>} />
            <Route path="/devenir-vendeur" element={<LP><BecomeSellerPage /></LP>} />
            <Route path="/temoignages" element={<LP><TestimonialsPage /></LP>} />
            <Route path="/contact" element={<LP><ContactPage /></LP>} />
            <Route path="/centre-aide" element={<LP><HelpCenterPage /></LP>} />
            <Route path="/centre-aide/categorie/:key" element={<LP><HelpCategoryPage /></LP>} />
            <Route path="/centre-aide/:slug" element={<LP><HelpArticlePage /></LP>} />
            <Route path="/aide/packs-et-prix-100" element={<LP><PricingBasisHelpPage /></LP>} />

            {/* Legal */}
            <Route path="/mentions-legales" element={<LP><LegalNoticePage /></LP>} />
            <Route path="/cgv" element={<LP><TermsPage /></LP>} />
            <Route path="/politique-confidentialite" element={<LP><PrivacyPage /></LP>} />
            <Route path="/cookies" element={<LP><CookiePolicyPage /></LP>} />
            <Route path="/unsubscribe" element={<LP><UnsubscribePage /></LP>} />
            <Route path="/audit-achats" element={<AuditAchatsPage />} />
            <Route path="/audit-achats/confirmation" element={<AuditAchatsConfirmationPage />} />

            <Route path="/admin/login" element={<LP><AdminLoginPage /></LP>} />

            {/* Admin Back-Office */}
            <Route path="/admin" element={<LP><AdminLayout /></LP>}>
              <Route index element={<LP><AdminDashboard /></LP>} />
              <Route path="vendeurs" element={<LP><AdminVendeurs /></LP>} />
              <Route path="vendeurs/:id" element={<LP><AdminVendeurDetail /></LP>} />
              <Route path="vendors-stripe" element={<LP><AdminVendors /></LP>} />
              <Route path="onboarding" element={<LP><AdminOnboarding /></LP>} />
              <Route path="produits" element={<LP><AdminProduits /></LP>} />
              <Route path="produits/mapping" element={<LP><AdminSourceMapping /></LP>} />
              <Route path="produits-soumis" element={<LP><AdminProductSubmissions /></LP>} />
              <Route path="produits/:id" element={<LP><AdminProduitDetail /></LP>} />
              <Route path="categories" element={<LP><AdminCategories /></LP>} />
              <Route path="marques" element={<LP><AdminMarques /></LP>} />
              <Route path="marques/doublons" element={<LP><AdminBrandDuplicates /></LP>} />
              <Route path="marques/:slug/edit" element={<LP><AdminBrandTransparenceEdit /></LP>} />
              <Route path="brands/:slug/edit" element={<LP><AdminBrandTransparenceEdit /></LP>} />
              <Route path="db-backups" element={<LP><AdminDbBackups /></LP>} />
              <Route path="backup-rls-audit" element={<LP><AdminBackupRlsAudit /></LP>} />
              <Route path="rfq-credits" element={<LP><AdminRfqCreditsPage /></LP>} />
              <Route path="rfq-ledger" element={<LP><AdminRfqLedgerPage /></LP>} />
              <Route path="rfq-plans" element={<LP><AdminRfqPlansPage /></LP>} />
              <Route path="rfq-reminders" element={<LP><AdminRfqRemindersPage /></LP>} />
              <Route path="rfq-routing-test" element={<LP><AdminRfqRoutingTestPage /></LP>} />
              <Route path="rfq-routing-audit" element={<LP><AdminRfqRoutingAuditPage /></LP>} />
              <Route path="vendor-market-intel" element={<LP><AdminVendorMarketIntelPage /></LP>} />
              <Route path="abonnements" element={<LP><AdminAbonnements /></LP>} />
              <Route path="announcement-bar" element={<LP><AdminAnnouncementBar /></LP>} />
              <Route path="modules" element={<LP><AdminFeatureFlags /></LP>} />
              <Route path="i18n-pilot" element={<LP><AdminI18nPilot /></LP>} />
              <Route path="fabricants" element={<LP><AdminFabricants /></LP>} />
              <Route path="schemas-pim" element={<LP><AdminSchemasPIM /></LP>} />
              <Route path="commandes" element={<LP><AdminCommandes /></LP>} />
              <Route path="commandes-en-retard" element={<LP><AdminCommandesEnRetard /></LP>} />
              <Route path="litiges" element={<LP><AdminLitiges /></LP>} />
              <Route path="finances" element={<LP><AdminFinances /></LP>} />
              <Route path="veille-prix" element={<LP><AdminVeillePrix /></LP>} />
              <Route path="pack-anomalies" element={<LP><AdminPackAnomalies /></LP>} />
              <Route path="pack-size-backfill" element={<LP><AdminPackSizeBackfill /></LP>} />
              <Route path="pack-size-mismatches" element={<LP><AdminPackSizeMismatches /></LP>} />
              <Route path="prix-cockpit" element={<LP><AdminPriceCockpitPage /></LP>} />
              <Route path="market-delta-anomalies" element={<LP><AdminMarketDeltaAnomaliesPage /></LP>} />
              <Route path="market-delta-thresholds" element={<LP><AdminMarketDeltaThresholdsPage /></LP>} />
              <Route path="pack-audit" element={<LP><AdminPackAuditPage /></LP>} />
              <Route path="leads" element={<LP><AdminLeads /></LP>} />
              <Route path="audits" element={<LP><AuditsAdminPage /></LP>} />
              <Route path="analytics" element={<LP><AdminAnalytics /></LP>} />
              <Route path="recherches" element={<LP><AdminRecherches /></LP>} />
              <Route path="reglementaire" element={<LP><AdminReglementaire /></LP>} />
              <Route path="import-export" element={<LP><AdminImportExport /></LP>} />
              <Route path="crm" element={<LP><AdminCRM /></LP>} />
              <Route path="cms" element={<LP><AdminCMS /></LP>} />
              <Route path="cms/home/marques" element={<LP><AdminCmsHomeBrands /></LP>} />
              <Route path="cms/home/produits" element={<LP><AdminCmsHomeProducts /></LP>} />
              <Route path="cms/home/comparaison" element={<LP><AdminCmsHomeShowcase /></LP>} />
              <Route path="cms/partenaires-invest" element={<LP><AdminCmsPartnerLogos /></LP>} />
              <Route path="categories/non-mappees" element={<LP><AdminUnmappedCategories /></LP>} />
              <Route path="sourcing/pipeline" element={<LP><AdminSourcingPipeline /></LP>} />
              <Route path="categories/anomalies" element={<LP><AdminCategoryAnomalies /></LP>} />
              <Route path="categories/anomalies/:id" element={<LP><AdminCategoryAnomalyDetail /></LP>} />
              <Route path="preview/brand-product-card" element={<LP><AdminBrandProductCardPreview /></LP>} />
              <Route path="categories/qogita-mapping-llm" element={<LP><AdminQogitaLlmMapping /></LP>} />
              <Route path="categories/qogita-mapping-review" element={<LP><AdminQogitaAmbiguousReview /></LP>} />
              <Route path="categories/dashboard" element={<LP><AdminCategoryMappingDashboard /></LP>} />
              <Route path="prix-reference" element={<LP><AdminMarketCodes /></LP>} />
              {/* /admin/product-prices supprimé : utiliser /vendor/offers (offer_buyer_profile_prices) */}
              <Route path="invest-pipeline" element={<LP><AdminInvestPipeline /></LP>} />
              <Route path="logistique" element={<LP><AdminLogistique /></LP>} />
              <Route path="shipping-options" element={<LP><AdminShippingOptions /></LP>} />
              <Route path="equipe" element={<LP><AdminEquipe /></LP>} />
              <Route path="delegues" element={<LP><AdminDelegues /></LP>} />
              <Route path="profils" element={<LP><AdminProfils /></LP>} />
              <Route path="parametres" element={<LP><AdminParametres /></LP>} />
              <Route path="logs" element={<LP><AdminLogs /></LP>} />
              <Route path="users" element={<LP><AdminUsers /></LP>} />
              <Route path="audit-log" element={<LP><AdminAuditLog /></LP>} />
              <Route path="contract-audit" element={<LP><AdminContractAudit /></LP>} />
              <Route path="catalog-diagnostics" element={<LP><AdminCatalogDiagnostics /></LP>} />
              <Route path="search-debug" element={<LP><AdminSearchDebug /></LP>} />
              <Route path="offer-data-quality" element={<LP><AdminOfferDataQuality /></LP>} />
              <Route path="savings-ocr" element={<LP><AdminSavingsOcr /></LP>} />
              <Route path="onboarding-cms" element={<LP><AdminOnboardingCMS /></LP>} />
              <Route path="commissions" element={<LP><AdminCommissions /></LP>} />
              <Route path="commission-overrides" element={<LP><AdminCommissionOverridesPage /></LP>} />
              <Route path="sync" element={<LP><AdminSync /></LP>} />
              <Route path="api-keys" element={<LP><AdminApiKeys /></LP>} />
              <Route path="api-docs" element={<LP><AdminApiDocs /></LP>} />
              <Route path="pays" element={<LP><AdminCountries /></LP>} />
              <Route path="market-codes" element={<LP><AdminMarketCodes /></LP>} />
              <Route path="vendeurs-externes" element={<LP><AdminExternalVendors /></LP>} />
              <Route path="vendeurs-externes/audit-tva" element={<LP><AdminExternalVatAudit /></LP>} />
              <Route path="tva-regles" element={<LP><AdminVatRules /></LP>} />
              <Route path="stripe-commissions" element={<LP><AdminStripeCommissions /></LP>} />
              <Route path="stripe-revenue" element={<LP><AdminStripeRevenue /></LP>} />
              <Route path="commandes/:orderId/refund" element={<LP><AdminOrderRefund /></LP>} />
              <Route path="translations" element={<LP><AdminTranslations /></LP>} />
              <Route path="price-alerts" element={<LP><AdminPriceAlerts /></LP>} />
              <Route path="price-alerts/settings" element={<LP><AdminPriceAlertSettings /></LP>} />
              <Route path="price-alerts/:id" element={<LP><AdminPriceAlertDetail /></LP>} />
              <Route path="flash-deals" element={<LP><AdminFlashDeals /></LP>} />
              <Route path="shipments" element={<LP><AdminShipments /></LP>} />
              <Route path="reconciliation" element={<LP><AdminReconciliation /></LP>} />
              {/* ReStock administration — wrapped in AdminLayout to keep super-admin shell */}
              <Route path="restock" element={<Navigate to="/admin/restock/offers" replace />} />
              <Route path="restock/offers" element={<LP><RestockAdminOffers /></LP>} />
              <Route path="restock/buyers" element={<LP><RestockAdminBuyers /></LP>} />
              <Route path="restock/campaigns" element={<LP><RestockAdminCampaigns /></LP>} />
              <Route path="restock/rules" element={<LP><RestockAdminRules /></LP>} />
              <Route path="restock/settings" element={<LP><RestockSettings /></LP>} />
              <Route path="restock/drops" element={<LP><RestockDrops /></LP>} />
              <Route path="restock/faq" element={<LP><RestockAdminFaq /></LP>} />
              <Route path="restock/price-references" element={<LP><RestockAdminPriceReferences /></LP>} />
              <Route path="restock/payouts" element={<LP><RestockAdminPayouts /></LP>} />
            </Route>

            {/* Vendor Dashboard */}
            <Route path="/espace-vendeur/catalogue" element={<Navigate to="/vendor/catalog" replace />} />
            <Route path="/vendor/login" element={<LP><VendorLoginPage /></LP>} />
            <Route path="/vendor/orders/:order_number" element={<LP><VendorOrderPage /></LP>} />
            <Route path="/vendor/onboarding" element={<LP><VendorOnboardingWizard /></LP>} />
            <Route path="/vendor/stripe-onboarding" element={<LP><VendorStripeOnboardingPage /></LP>} />
            <Route path="/vendor/stripe-onboarding/success" element={<LP><VendorStripeSuccessPage /></LP>} />
            <Route path="/vendor/stripe-onboarding/refresh" element={<LP><VendorStripeRefreshPage /></LP>} />
            <Route path="/vendor" element={<LP><VendorLayout /></LP>}>
              <Route index element={<LP><VendorDashboard /></LP>} />
              <Route path="catalog" element={<LP><VendorCatalog /></LP>} />
              <Route path="produits/proposer" element={<LP><VendorProductSubmissionPage /></LP>} />
              <Route path="notifications" element={<LP><VendorNotifications /></LP>} />
              <Route path="interests" element={<Navigate to="/vendor/notifications" replace />} />
              <Route path="offers" element={<LP><VendorOffers /></LP>} />
              <Route path="orders" element={<LP><VendorOrders /></LP>} />
              <Route path="opportunities" element={<LP><VendorOpportunities /></LP>} />
              <Route path="alerts" element={<LP><VendorMarketIntelHub /></LP>} />
              <Route path="competitor-alerts" element={<LP><VendorMarketIntelHub /></LP>} />
              <Route path="positioning" element={<LP><VendorMarketIntelHub /></LP>} />
              <Route path="market-intel" element={<LP><VendorMarketIntelHub /></LP>} />
              <Route path="price-alert-rules" element={<LP><VendorMarketIntelHub /></LP>} />
              <Route path="tenders" element={<LP><VendorTenders /></LP>} />
              <Route path="rfq" element={<LP><VendorRfqInbox /></LP>} />
              <Route path="analytics" element={<LP><VendorAnalytics /></LP>} />
              <Route path="finance" element={<LP><VendorFinance /></LP>} />
              <Route path="logistics" element={<LP><VendorLogistics /></LP>} />
              <Route path="health" element={<LP><VendorHealth /></LP>} />
              <Route path="messages" element={<LP><VendorMessages /></LP>} />
              <Route path="academy" element={<LP><VendorAcademy /></LP>} />
              <Route path="settings" element={<LP><VendorSettings /></LP>} />
              <Route path="shipments" element={<LP><VendorShipments /></LP>} />
              <Route path="shipments/new" element={<LP><VendorNewShipment /></LP>} />
              <Route path="shipments/:id" element={<LP><VendorShipmentDetail /></LP>} />
              <Route path="billing" element={<LP><VendorBilling /></LP>} />
              <Route path="contract" element={<LP><VendorContractPage /></LP>} />
              <Route path="contract/changelog" element={<LP><VendorContractChangelogPage /></LP>} />
            </Route>

            {/* ReStock — all routes under main site layout with sub-nav */}
            <Route element={<LP><RestockSiteLayout /></LP>}>
              <Route path="/restock" element={<LP><RestockLandingPage /></LP>} />
              <Route path="/restock/opportunities/:campaignId" element={<LP><RestockOpportunities /></LP>} />
              <Route path="/restock/opportunities" element={<LP><RestockOpportunities /></LP>} />
              <Route path="/restock/buyer/dashboard" element={<LP><RestockBuyerDashboard /></LP>} />
              <Route path="/restock/buyer/drops" element={<LP><RestockDrops /></LP>} />
              <Route path="/restock/checkout" element={<LP><RestockCheckout /></LP>} />
              {/* Seller */}
              <Route path="/restock/seller" element={<Navigate to="/restock/seller/new" replace />} />
              <Route path="/restock/seller/new" element={<LP><RestockSellerNewOffer /></LP>} />
              <Route path="/restock/seller/offers" element={<LP><RestockSellerOffers /></LP>} />
              <Route path="/restock/seller/counteroffers" element={<LP><RestockSellerCounterOffers /></LP>} />
              <Route path="/restock/seller/sales" element={<LP><RestockSellerSales /></LP>} />
              <Route path="/restock/seller/referral" element={<LP><RestockSellerReferral /></LP>} />
              <Route path="/restock/seller/help" element={<LP><RestockSellerHelp /></LP>} />
              <Route path="/restock/faq" element={<LP><RestockFaqPage /></LP>} />

              {/* Admin ReStock — redirect legacy /restock/admin/* to /admin/restock/* */}
              <Route path="/restock/admin" element={<Navigate to="/admin/restock/offers" replace />} />
              <Route path="/restock/admin/offers" element={<Navigate to="/admin/restock/offers" replace />} />
              <Route path="/restock/admin/buyers" element={<Navigate to="/admin/restock/buyers" replace />} />
              <Route path="/restock/admin/campaigns" element={<Navigate to="/admin/restock/campaigns" replace />} />
              <Route path="/restock/admin/rules" element={<Navigate to="/admin/restock/rules" replace />} />
              <Route path="/restock/admin/settings" element={<Navigate to="/admin/restock/settings" replace />} />
              <Route path="/restock/admin/drops" element={<Navigate to="/admin/restock/drops" replace />} />
              <Route path="/restock/admin/faq" element={<Navigate to="/admin/restock/faq" replace />} />
              <Route path="/restock/admin/price-references" element={<Navigate to="/admin/restock/price-references" replace />} />
              <Route path="/restock/admin/payouts" element={<Navigate to="/admin/restock/payouts" replace />} />
            </Route>

            {/* ReStock standalone mobile */}
            {/* ReStock standalone routes — wrapped in RestockSiteLayout for SubNav */}
            <Route element={<LP><RestockSiteLayout /></LP>}>
              <Route path="/opportunities/:campaignId" element={<LP><RestockOpportunities /></LP>} />
              <Route path="/m/opportunities/:campaignId" element={<LP><RestockMobileSwipe /></LP>} />
              <Route path="/m/opportunities" element={<LP><RestockMobileSwipe /></LP>} />
            </Route>

            <Route path="/demo/seller-trust-badge" element={<Suspense fallback={<PageLoader />}><SellerTrustBadgeDemo /></Suspense>} />
            <Route path="/demo/delegues" element={<Suspense fallback={<PageLoader />}><DelegateDesignDemoPage /></Suspense>} />
            <Route path="*" element={<LP><NotFound /></LP>} />
          </Routes>
          </Suspense>
          </LazyRouteBoundary>
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
      </ImpersonationProvider>
      </PriceDisplayProvider>
      </CountryProvider>
      </CartProvider>
      </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;