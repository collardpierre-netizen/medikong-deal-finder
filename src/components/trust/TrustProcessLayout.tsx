import { Layout } from "@/components/layout/Layout";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function TrustProcessLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return <Layout>{children}</Layout>;
}
