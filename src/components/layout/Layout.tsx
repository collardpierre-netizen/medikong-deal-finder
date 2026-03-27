import { Navbar } from "./Navbar";
import { TrustBar } from "./TrustBar";
import { SubNav } from "./SubNav";
import { Breadcrumbs } from "./Breadcrumbs";
import { Footer } from "./Footer";
import { PageTransition } from "@/components/shared/PageTransition";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <TrustBar />
      <SubNav />
      <Breadcrumbs />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </div>
  );
}
