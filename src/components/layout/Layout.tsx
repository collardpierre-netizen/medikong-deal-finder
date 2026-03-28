import { Navbar } from "./Navbar";
import { TrustBar } from "./TrustBar";
import { SubNav } from "./SubNav";
import { Breadcrumbs } from "./Breadcrumbs";
import { Footer } from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";
import { PageTransition } from "@/components/shared/PageTransition";
import CartDrawer from "@/components/cart/CartDrawer";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

declare global {
  interface Window { dataLayer: Record<string, unknown>[]; }
}

export function Layout({ children, title, description }: { children: React.ReactNode; title?: string; description?: string }) {
  const location = useLocation();
  const canonicalUrl = `https://medikong-deal-finder.lovable.app${location.pathname}`;

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'page_view', page_path: location.pathname });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <link rel="canonical" href={canonicalUrl} />
        {title && <title>{title}</title>}
        {description && <meta name="description" content={description} />}
      </Helmet>
      <AnnouncementBar />
      <Navbar />
      <TrustBar />
      <SubNav />
      <Breadcrumbs />
      <main id="main-content" className="flex-1" role="main">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
