import { Navbar } from "./Navbar";
import { TrustBar } from "./TrustBar";
import { SubNav } from "./SubNav";
import { Breadcrumbs } from "./Breadcrumbs";
import { Footer } from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";
import { PageTransition } from "@/components/shared/PageTransition";
import CartDrawer from "@/components/cart/CartDrawer";
import { TranslationActivatedPopup } from "@/components/TranslationActivatedPopup";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

declare global {
  interface Window { dataLayer: Record<string, unknown>[]; }
}

export function Layout({ children, title, description }: { children: React.ReactNode; title?: string; description?: string }) {
  const location = useLocation();
  const { i18n } = useTranslation();
  const canonicalUrl = `https://medikong-deal-finder.lovable.app${location.pathname}`;
  const showTranslationPopup = !location.pathname.startsWith("/categories");

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'page_view', page_path: location.pathname });
  }, [location.pathname]);

  // Sync HTML lang attribute
  useEffect(() => {
    document.documentElement.lang = i18n.language?.substring(0, 2) || "fr";
  }, [i18n.language]);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" hreflang="fr" href={`${canonicalUrl}?lang=fr`} />
        <link rel="alternate" hreflang="nl" href={`${canonicalUrl}?lang=nl`} />
        <link rel="alternate" hreflang="de" href={`${canonicalUrl}?lang=de`} />
        <link rel="alternate" hreflang="en" href={`${canonicalUrl}?lang=en`} />
        <link rel="alternate" hreflang="x-default" href={canonicalUrl} />
        {title && <title>{title}</title>}
        {description && <meta name="description" content={description} />}
      </Helmet>
      <AnnouncementBar />
      <TrustBar />
      <Navbar />
      <SubNav />
      <Breadcrumbs />
      <main id="main-content" className="flex-1" role="main">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <CartDrawer />
      {showTranslationPopup && <TranslationActivatedPopup />}
    </div>
  );
}
