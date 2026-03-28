import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { CartProvider } from "@/contexts/CartContext";
import HomePage from "./pages/HomePage";
import ResultsPage from "./pages/ResultsPage";
import ProductPage from "./pages/ProductPage";
import BrandsPage from "./pages/BrandsPage";
import BrandDetailPage from "./pages/BrandDetailPage";
import ManufacturerPage from "./pages/ManufacturerPage";
import CartPage from "./pages/CartPage";
import AccountPage from "./pages/AccountPage";
import CheckoutPage from "./pages/CheckoutPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CategoryPage from "./pages/CategoryPage";
import PromotionsPage from "./pages/PromotionsPage";
import SellerOnboardingPage from "./pages/SellerOnboardingPage";
import BuyerOnboardingPage from "./pages/BuyerOnboardingPage";
import BuyerCompletionPage from "./pages/BuyerCompletionPage";
import NotFound from "./pages/NotFound";
import InvestPage from "./pages/InvestPage";
import AdminLayout from "./components/admin/AdminLayout";
import VendorLayout from "./components/vendor/VendorLayout";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import VendorPlaceholder from "./pages/vendor/VendorPlaceholder";
import VendorCatalog from "./pages/vendor/VendorCatalog";
import VendorOffers from "./pages/vendor/VendorOffers";
import VendorOrders from "./pages/vendor/VendorOrders";
import VendorOpportunities from "./pages/vendor/VendorOpportunities";
import VendorAlerts from "./pages/vendor/VendorAlerts";
import VendorTenders from "./pages/vendor/VendorTenders";
import VendorAnalytics from "./pages/vendor/VendorAnalytics";
import VendorFinance from "./pages/vendor/VendorFinance";
import VendorLogistics from "./pages/vendor/VendorLogistics";
import VendorHealth from "./pages/vendor/VendorHealth";
import VendorAcademy from "./pages/vendor/VendorAcademy";
import VendorSettings from "./pages/vendor/VendorSettings";
import VendorMessages from "./pages/vendor/VendorMessages";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import AdminVendeurs from "./pages/admin/AdminVendeurs";
import AdminVendeurDetail from "./pages/admin/AdminVendeurDetail";
import AdminOnboarding from "./pages/admin/AdminOnboarding";
import AdminProduits from "./pages/admin/AdminProduits";
import AdminProduitDetail from "./pages/admin/AdminProduitDetail";
import AdminSchemasPIM from "./pages/admin/AdminSchemasPIM";
import AdminCommandes from "./pages/admin/AdminCommandes";
import AdminFinances from "./pages/admin/AdminFinances";
import AdminLitiges from "./pages/admin/AdminLitiges";
import AdminVeillePrix from "./pages/admin/AdminVeillePrix";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminReglementaire from "./pages/admin/AdminReglementaire";
import AdminImportExport from "./pages/admin/AdminImportExport";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminMarques from "./pages/admin/AdminMarques";
import AdminCRM from "./pages/admin/AdminCRM";
import AdminCMS from "./pages/admin/AdminCMS";
import AdminPrixReference from "./pages/admin/AdminPrixReference";
import AdminLogistique from "./pages/admin/AdminLogistique";
import AdminEquipe from "./pages/admin/AdminEquipe";
import AdminParametres from "./pages/admin/AdminParametres";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <I18nProvider>
      <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/recherche" element={<ResultsPage />} />
            <Route path="/produit/:slug" element={<ProductPage />} />
            <Route path="/marques" element={<BrandsPage />} />
            <Route path="/marque/:slug" element={<BrandDetailPage />} />
            <Route path="/fabricant/:slug" element={<ManufacturerPage />} />
            <Route path="/panier" element={<CartPage />} />
            <Route path="/compte" element={<AccountPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
            <Route path="/commande/:id" element={<OrderDetailPage />} />
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/inscription" element={<RegisterPage />} />
            <Route path="/categorie/:slug" element={<CategoryPage />} />
            <Route path="/promotions" element={<PromotionsPage />} />
            <Route path="/seller-onboarding" element={<SellerOnboardingPage />} />
            <Route path="/buyer-onboarding" element={<BuyerOnboardingPage />} />
            <Route path="/buyer-completion" element={<BuyerCompletionPage />} />
            <Route path="/invest" element={<InvestPage />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />


            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Admin Back-Office */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="vendeurs" element={<AdminVendeurs />} />
              <Route path="vendeurs/:id" element={<AdminVendeurDetail />} />
              <Route path="onboarding" element={<AdminOnboarding />} />
              <Route path="produits" element={<AdminProduits />} />
              <Route path="produits/:id" element={<AdminProduitDetail />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="marques" element={<AdminMarques />} />
              <Route path="schemas-pim" element={<AdminSchemasPIM />} />
              <Route path="commandes" element={<AdminCommandes />} />
              <Route path="litiges" element={<AdminLitiges />} />
              <Route path="finances" element={<AdminFinances />} />
              <Route path="veille-prix" element={<AdminVeillePrix />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="reglementaire" element={<AdminReglementaire />} />
              <Route path="import-export" element={<AdminImportExport />} />
              <Route path="crm" element={<AdminCRM />} />
              <Route path="cms" element={<AdminCMS />} />
              <Route path="logistique" element={<AdminLogistique />} />
              <Route path="equipe" element={<AdminEquipe />} />
              <Route path="parametres" element={<AdminParametres />} />
              <Route path="logs" element={<AdminLogs />} />
            </Route>

            {/* Vendor Dashboard */}
            <Route path="/vendor" element={<VendorLayout />}>
              <Route index element={<VendorDashboard />} />
              <Route path="catalog" element={<VendorCatalog />} />
              <Route path="offers" element={<VendorOffers />} />
              <Route path="orders" element={<VendorOrders />} />
              <Route path="opportunities" element={<VendorOpportunities />} />
              <Route path="alerts" element={<VendorAlerts />} />
              <Route path="tenders" element={<VendorTenders />} />
              <Route path="analytics" element={<VendorAnalytics />} />
              <Route path="finance" element={<VendorFinance />} />
              <Route path="logistics" element={<VendorLogistics />} />
              <Route path="health" element={<VendorHealth />} />
              <Route path="messages" element={<VendorMessages />} />
              <Route path="academy" element={<VendorAcademy />} />
              <Route path="settings" element={<VendorSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </CartProvider>
      </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
