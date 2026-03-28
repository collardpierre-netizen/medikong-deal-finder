import { Navbar } from "@/components/layout/Navbar";
import { TrustBar } from "@/components/layout/TrustBar";
import { Footer } from "@/components/layout/Footer";
import { EntrepriseSubNav } from "./EntrepriseSubNav";
import CartDrawer from "@/components/cart/CartDrawer";

export function EntrepriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <TrustBar />
      <EntrepriseSubNav />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
