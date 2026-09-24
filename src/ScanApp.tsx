import { Suspense, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { CartProvider } from "@/contexts/CartContext";
import { PriceDisplayProvider } from "@/contexts/PriceDisplayContext";
import { LazyRouteBoundary } from "@/components/LazyRouteBoundary";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { Loader2 } from "lucide-react";
import ScanGate from "@/pages/scan/ScanGate";
import "@/pages/scan/scan-theme.css";

const ScanHomePage = lazyWithRetry(() => import("./pages/scan/ScanHomePage"), "ScanHomePage");
const ScanConditionsPage = lazyWithRetry(() => import("./pages/scan/ScanConditionsPage"), "ScanConditionsPage");
const ScanCartPage = lazyWithRetry(() => import("./pages/scan/ScanCartPage"), "ScanCartPage");
const ScanSoonPage = lazyWithRetry(() => import("./pages/scan/ScanSoonPage"), "ScanSoonPage");

function Loader() {
  return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}

/** Manifeste propre à l'hôte scan (installable, sans service worker). */
function useScanManifest() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
    link.href = "/manifest-scan.json";
    document.documentElement.classList.add("scan-surface");
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    meta?.setAttribute("content", "#1E293B");
  }, []);
}

/** Arbre de routes de la surface Scan (scan.medikong.pro). */
const ScanApp = () => {
  useScanManifest();
  return (
    <HelmetProvider>
      <Helmet>
        <title>MediKong Scan</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <I18nProvider>
            <CartProvider>
              <PriceDisplayProvider>
                <TooltipProvider>
                  <Sonner position="top-center" />
                  <BrowserRouter>
                    <div className="scan-theme min-h-screen bg-background text-foreground">
                      <LazyRouteBoundary>
                        <Suspense fallback={<Loader />}>
                          <ScanGate>
                            <Routes>
                              <Route path="/" element={<ScanHomePage />} />
                              <Route path="/conditions" element={<ScanConditionsPage />} />
                              <Route path="/panier" element={<ScanCartPage />} />
                              <Route path="/ruptures" element={<ScanSoonPage title="Ruptures" />} />
                              <Route path="/moi" element={<ScanSoonPage title="Moi" />} />
                              <Route path="*" element={<ScanHomePage />} />
                            </Routes>
                          </ScanGate>
                        </Suspense>
                      </LazyRouteBoundary>
                    </div>
                  </BrowserRouter>
                </TooltipProvider>
              </PriceDisplayProvider>
            </CartProvider>
          </I18nProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default ScanApp;
