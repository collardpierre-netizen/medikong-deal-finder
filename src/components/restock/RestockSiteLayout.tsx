import { Outlet } from "react-router-dom";
import { Footer } from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import { RestockSubNav } from "./RestockSubNav";

export default function RestockSiteLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <RestockSubNav />
      <main id="main-content" className="flex-1" role="main">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
