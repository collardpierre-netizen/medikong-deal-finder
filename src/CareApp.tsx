import { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { CareNoIndex } from "@/components/care/CareNoIndex";
import { LazyRouteBoundary } from "@/components/LazyRouteBoundary";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { Loader2 } from "lucide-react";

const CarePortalPage = lazyWithRetry(() => import("./pages/care/CarePortalPage"), "CarePortalPage");
const CareGroupRouter = lazyWithRetry(() => import("./pages/care/CareGroupRouter"), "CareGroupRouter");
const CareResidenceBackOfficePage = lazyWithRetry(
  () => import("./pages/care/CareResidenceBackOfficePage"),
  "CareResidenceBackOfficePage",
);
const CareAuthPage = lazyWithRetry(() => import("./pages/care/CareAuthPage"), "CareAuthPage");
const CareNotFoundPage = lazyWithRetry(() => import("./pages/care/CareNotFoundPage"), "CareNotFoundPage");

function CareLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-mk-blue" />
    </div>
  );
}

/**
 * Arbre de routes de la surface Care (care.medikong.pro).
 * Aucune route marketplace n'est montée ici, et réciproquement :
 * une URL croisée tombe sur le 404 de sa propre surface.
 */
const CareApp = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <CareNoIndex />
              <LazyRouteBoundary>
                <Suspense fallback={<CareLoader />}>
                  <Routes>
                    <Route path="/" element={<CarePortalPage />} />
                    <Route path="/auth" element={<CareAuthPage />} />
                    <Route path="/groups/:param" element={<CareGroupRouter />} />
                    <Route path="/residences/:id" element={<CareResidenceBackOfficePage />} />
                    <Route path="*" element={<CareNotFoundPage />} />
                  </Routes>
                </Suspense>
              </LazyRouteBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default CareApp;
