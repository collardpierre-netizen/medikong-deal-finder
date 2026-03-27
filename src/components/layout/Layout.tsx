import { Navbar } from "./Navbar";
import { TrustBar } from "./TrustBar";
import { SubNav } from "./SubNav";
import { Breadcrumbs } from "./Breadcrumbs";
import { Footer } from "./Footer";
import { AnnouncementBar } from "./AnnouncementBar";
import { PageTransition } from "@/components/shared/PageTransition";
import CartDrawer from "@/components/cart/CartDrawer";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Navbar />
      <TrustBar />
      <SubNav />
      <Breadcrumbs />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
