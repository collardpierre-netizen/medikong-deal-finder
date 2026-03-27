import { Navbar } from "./Navbar";
import { TrustBar } from "./TrustBar";
import { SubNav } from "./SubNav";
import { Footer } from "./Footer";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <TrustBar />
      <SubNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
