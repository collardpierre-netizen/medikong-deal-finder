import { lazy, Suspense } from "react"; // v2
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import { CookieConsent } from "@/components/layout/CookieConsent";
import { HelmetProvider } from "react-helmet-async";
import { Loader2 } from "lucide-react";

// Page loader for lazy routes
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-mk-blue" />
    </div>
  );
}

// Lazy load ALL pages
const HomePage = lazy(() => import("./pages/HomePage"));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const BrandsPage = lazy(() => import("./pages/BrandsPage"));
const BrandDetailPage = lazy(() => import("./pages/BrandDetailPage"));
const ManufacturerPage = lazy(() => import("./pages/ManufacturerPage"));
const FabricantsPage = lazy(() => import("./pages/FabricantsPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ConfirmationPage = lazy(() => import("./pages/ConfirmationPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const CataloguePage = lazy(() => import("./pages/CataloguePage"));
const PromotionsPage = lazy(() => import("./pages/PromotionsPage"));
const SellerOnboardingPage = lazy(() => import("./pages/SellerOnboardingPage"));
const BuyerOnboardingPage = lazy(() => import("./pages/BuyerOnboardingPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const BuyerCompletionPage = lazy(() => import("./pages/BuyerCompletionPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const InvestPage = lazy(() => import("./pages/InvestPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const VendorPublicPage = lazy(() => import("./pages/VendorPublicPage"));
const ProfessionnelsPage = lazy(() => import("./pages/ProfessionnelsPage"));
const SourcingPage = lazy(() => import("./pages/SourcingPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const MyPricesPage = lazy(() => import("./pages/MyPricesPage"));

// Entreprise pages
const AboutPage = lazy(() => import("./pages/entreprise/AboutPage"));
const WhyMedikongPage = lazy(() => import("./pages/entreprise/WhyMedikongPage"));
const HowItWorksPage = lazy(() => import("./pages/entreprise/HowItWorksPage"));
const TeamPage = lazy(() => import("./pages/entreprise/TeamPage"));
const CareersPage = lazy(() => import("./pages/entreprise/CareersPage"));
const PressPage = lazy(() => import("./pages/entreprise/PressPage"));
const InvestirPage = lazy(() => import("./pages/entreprise/InvestirPage"));

// Trust pages
const SupplierVerificationPage = lazy(() => import("./pages/trust/SupplierVerificationPage"));
const QualityGuaranteePage = lazy(() => import("./pages/trust/QualityGuaranteePage"));
const HowToOrderPage = lazy(() => import("./pages/trust/HowToOrderPage"));
const BuyNowPayLaterPage = lazy(() => import("./pages/trust/BuyNowPayLaterPage"));
const LogisticsPage = lazy(() => import("./pages/trust/LogisticsPage"));
const BecomeSellerPage = lazy(() => import("./pages/trust/BecomeSellerPage"));
const TestimonialsPage = lazy(() => import("./pages/trust/TestimonialsPage"));
const ContactPage = lazy(() => import("./pages/trust/ContactPage"));
const HelpCenterPage = lazy(() => import("./pages/trust/HelpCenterPage"));
const HelpArticlePage = lazy(() => import("./pages/trust/HelpArticlePage"));
const HelpCategoryPage = lazy(() => import("./pages/trust/HelpCategoryPage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));

// Legal pages
const LegalNoticePage = lazy(() => import("./pages/legal/LegalNoticePage"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/legal/PrivacyPage"));
const CookiePolicyPage = lazy(() => import("./pages/legal/CookiePolicyPage"));

// Admin pages
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminVendeurs = lazy(() => import("./pages/admin/AdminVendeurs"));
const AdminVendeurDetail = lazy(() => import("./pages/admin/AdminVendeurDetail"));
const AdminOnboarding = lazy(() => import("./pages/admin/AdminOnboarding"));
const AdminProduits = lazy(() => import("./pages/admin/AdminProduits"));
const AdminProduitDetail = lazy(() => import("./pages/admin/AdminProduitDetail"));
const AdminSchemasPIM = lazy(() => import("./pages/admin/AdminSchemasPIM"));
const AdminCommandes = lazy(() => import("./pages/admin/AdminCommandes"));
const AdminFinances = lazy(() => import("./pages/admin/AdminFinances"));
const AdminLitiges = lazy(() => import("./pages/admin/AdminLitiges"));
const AdminVeillePrix = lazy(() => import("./pages/admin/AdminVeillePrix"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminReglementaire = lazy(() => import("./pages/admin/AdminReglementaire"));
const AdminImportExport = lazy(() => import("./pages/admin/AdminImportExport"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminMarques = lazy(() => import("./pages/admin/AdminMarques"));
const AdminCRM = lazy(() => import("./pages/admin/AdminCRM"));
const AdminCMS = lazy(() => import("./pages/admin/AdminCMS"));
const AdminPrixReference = lazy(() => import("./pages/admin/AdminPrixReference"));
const AdminProductPrices = lazy(() => import("./pages/admin/AdminProductPrices"));
const AdminInvestPipeline = lazy(() => import("./pages/admin/AdminInvestPipeline"));
const AdminLogistique = lazy(() => import("./pages/admin/AdminLogistique"));
const AdminEquipe = lazy(() => import("./pages/admin/AdminEquipe"));
const AdminProfils = lazy(() => import("./pages/admin/AdminProfils"));
const AdminParametres = lazy(() => import("./pages/admin/AdminParametres"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminCommissions = lazy(() => import("./pages/admin/AdminCommissions"));
const AdminOnboardingCMS = lazy(() => import("./pages/admin/AdminOnboardingCMS"));
const AdminSync = lazy(() => import("./pages/admin/AdminSync"));
const AdminFabricants = lazy(() => import("./pages/admin/AdminFabricants"));
const AdminApiKeys = lazy(() => import("./pages/admin/AdminApiKeys"));
const AdminApiDocs = lazy(() => import("./pages/admin/AdminApiDocs"));
const AdminCountries = lazy(() => import("./pages/admin/AdminCountries"));
const AdminMarketCodes = lazy(() => import("./pages/admin/AdminMarketCodes"));

// Vendor pages
const VendorLayout = lazy(() => import("./components/vendor/VendorLayout"));
const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const VendorCatalog = lazy(() => import("./pages/vendor/VendorCatalog"));
const VendorOffers = lazy(() => import("./pages/vendor/VendorOffers"));
const VendorOrders = lazy(() => import("./pages/vendor/VendorOrders"));
const VendorOpportunities = lazy(() => import("./pages/vendor/VendorOpportunities"));
const VendorAlerts = lazy(() => import("./pages/vendor/VendorAlerts"));
const VendorTenders = lazy(() => import("./pages/vendor/VendorTenders"));
const VendorAnalytics = lazy(() => import("./pages/vendor/VendorAnalytics"));
const VendorFinance = lazy(() => import("./pages/vendor/VendorFinance"));
const VendorLogistics = lazy(() => import("./pages/vendor/VendorLogistics"));
const VendorHealth = lazy(() => import("./pages/vendor/VendorHealth"));
const VendorAcademy = lazy(() => import("./pages/vendor/VendorAcademy"));
const VendorSettings = lazy(() => import("./pages/vendor/VendorSettings"));
const VendorMessages = lazy(() => import("./pages/vendor/VendorMessages"));

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
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
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
          <ImpersonationBanner />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LP><HomePage /></LP>} />
            <Route path="/recherche" element={<LP><SearchResultsPage /></LP>} />
            <Route path="/produit/:slug" element={<LP><ProductPage /></LP>} />
            <Route path="/marques" element={<LP><BrandsPage /></LP>} />
            <Route path="/marque/:slug" element={<LP><BrandDetailPage /></LP>} />
            <Route path="/fabricants" element={<LP><FabricantsPage /></LP>} />
            <Route path="/fabricant/:slug" element={<LP><ManufacturerPage /></LP>} />
            <Route path="/vendeur/:slug" element={<LP><VendorPublicPage /></LP>} />
            <Route path="/panier" element={<LP><CartPage /></LP>} />
            <Route path="/compte" element={<LP><AccountPage /></LP>} />
            <Route path="/checkout" element={<LP><CheckoutPage /></LP>} />
            <Route path="/confirmation" element={<LP><ConfirmationPage /></LP>} />
            <Route path="/commande/:id" element={<LP><OrderDetailPage /></LP>} />
            <Route path="/connexion" element={<LP><LoginPage /></LP>} />
            <Route path="/inscription" element={<Navigate to="/onboarding" replace />} />
            <Route path="/categorie/:slug" element={<LP><CataloguePage /></LP>} />
            <Route path="/catalogue" element={<LP><CataloguePage /></LP>} />
            <Route path="/promotions" element={<LP><PromotionsPage /></LP>} />
            <Route path="/seller-onboarding" element={<LP><SellerOnboardingPage /></LP>} />
            <Route path="/buyer-onboarding" element={<LP><BuyerOnboardingPage /></LP>} />
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
            <Route path="/sourcing" element={<LP><SourcingPage /></LP>} />
            <Route path="/categories" element={<LP><CategoriesPage /></LP>} />
            <Route path="/mes-prix" element={<LP><MyPricesPage /></LP>} />

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

            {/* Legal */}
            <Route path="/mentions-legales" element={<LP><LegalNoticePage /></LP>} />
            <Route path="/cgv" element={<LP><TermsPage /></LP>} />
            <Route path="/politique-confidentialite" element={<LP><PrivacyPage /></LP>} />
            <Route path="/cookies" element={<LP><CookiePolicyPage /></LP>} />
            <Route path="/unsubscribe" element={<LP><UnsubscribePage /></LP>} />

            <Route path="/admin/login" element={<LP><AdminLoginPage /></LP>} />

            {/* Admin Back-Office */}
            <Route path="/admin" element={<LP><AdminLayout /></LP>}>
              <Route index element={<LP><AdminDashboard /></LP>} />
              <Route path="vendeurs" element={<LP><AdminVendeurs /></LP>} />
              <Route path="vendeurs/:id" element={<LP><AdminVendeurDetail /></LP>} />
              <Route path="onboarding" element={<LP><AdminOnboarding /></LP>} />
              <Route path="produits" element={<LP><AdminProduits /></LP>} />
              <Route path="produits/:id" element={<LP><AdminProduitDetail /></LP>} />
              <Route path="categories" element={<LP><AdminCategories /></LP>} />
              <Route path="marques" element={<LP><AdminMarques /></LP>} />
              <Route path="fabricants" element={<LP><AdminFabricants /></LP>} />
              <Route path="schemas-pim" element={<LP><AdminSchemasPIM /></LP>} />
              <Route path="commandes" element={<LP><AdminCommandes /></LP>} />
              <Route path="litiges" element={<LP><AdminLitiges /></LP>} />
              <Route path="finances" element={<LP><AdminFinances /></LP>} />
              <Route path="veille-prix" element={<LP><AdminVeillePrix /></LP>} />
              <Route path="leads" element={<LP><AdminLeads /></LP>} />
              <Route path="analytics" element={<LP><AdminAnalytics /></LP>} />
              <Route path="reglementaire" element={<LP><AdminReglementaire /></LP>} />
              <Route path="import-export" element={<LP><AdminImportExport /></LP>} />
              <Route path="crm" element={<LP><AdminCRM /></LP>} />
              <Route path="cms" element={<LP><AdminCMS /></LP>} />
              <Route path="prix-reference" element={<LP><AdminPrixReference /></LP>} />
              <Route path="product-prices" element={<LP><AdminProductPrices /></LP>} />
              <Route path="invest-pipeline" element={<LP><AdminInvestPipeline /></LP>} />
              <Route path="logistique" element={<LP><AdminLogistique /></LP>} />
              <Route path="equipe" element={<LP><AdminEquipe /></LP>} />
              <Route path="profils" element={<LP><AdminProfils /></LP>} />
              <Route path="parametres" element={<LP><AdminParametres /></LP>} />
              <Route path="logs" element={<LP><AdminLogs /></LP>} />
              <Route path="users" element={<LP><AdminUsers /></LP>} />
              <Route path="audit-log" element={<LP><AdminAuditLog /></LP>} />
              <Route path="onboarding-cms" element={<LP><AdminOnboardingCMS /></LP>} />
              <Route path="commissions" element={<LP><AdminCommissions /></LP>} />
              <Route path="sync" element={<LP><AdminSync /></LP>} />
              <Route path="api-keys" element={<LP><AdminApiKeys /></LP>} />
              <Route path="api-docs" element={<LP><AdminApiDocs /></LP>} />
              <Route path="pays" element={<LP><AdminCountries /></LP>} />
              <Route path="market-codes" element={<LP><AdminMarketCodes /></LP>} />
            </Route>

            {/* Vendor Dashboard */}
            <Route path="/vendor" element={<LP><VendorLayout /></LP>}>
              <Route index element={<LP><VendorDashboard /></LP>} />
              <Route path="catalog" element={<LP><VendorCatalog /></LP>} />
              <Route path="offers" element={<LP><VendorOffers /></LP>} />
              <Route path="orders" element={<LP><VendorOrders /></LP>} />
              <Route path="opportunities" element={<LP><VendorOpportunities /></LP>} />
              <Route path="alerts" element={<LP><VendorAlerts /></LP>} />
              <Route path="tenders" element={<LP><VendorTenders /></LP>} />
              <Route path="analytics" element={<LP><VendorAnalytics /></LP>} />
              <Route path="finance" element={<LP><VendorFinance /></LP>} />
              <Route path="logistics" element={<LP><VendorLogistics /></LP>} />
              <Route path="health" element={<LP><VendorHealth /></LP>} />
              <Route path="messages" element={<LP><VendorMessages /></LP>} />
              <Route path="academy" element={<LP><VendorAcademy /></LP>} />
              <Route path="settings" element={<LP><VendorSettings /></LP>} />
            </Route>

            <Route path="*" element={<LP><NotFound /></LP>} />
          </Routes>
          </Suspense>
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