import { createContext, useContext, ReactNode } from "react";
import type { VendorTrust } from "@/hooks/useVendorTrust";

const VendorTrustContext = createContext<Record<string, VendorTrust>>({});

export function VendorTrustProvider({
  trustMap,
  children,
}: {
  trustMap: Record<string, VendorTrust>;
  children: ReactNode;
}) {
  return <VendorTrustContext.Provider value={trustMap}>{children}</VendorTrustContext.Provider>;
}

export function useVendorTrustForId(vendorId: string | null | undefined): VendorTrust | null {
  const map = useContext(VendorTrustContext);
  if (!vendorId) return null;
  return map[vendorId] ?? null;
}
