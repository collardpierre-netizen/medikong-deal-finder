import { createContext, useContext, type ReactNode } from "react";
import { useBestOffersBatch, type BatchBestOffer } from "@/hooks/useBestOffersBatch";

interface Ctx {
  map: Map<string, BatchBestOffer>;
  isLoading: boolean;
  isError: boolean;
  errorCode?: string | null;
}

const BestOffersContext = createContext<Ctx | null>(null);

/**
 * Provider qui pré-charge les meilleures offres pour une liste de produits
 * en un seul round-trip (RPC `get_best_offers_for_products`). Chaque
 * `SearchTrivagoCard` lit ensuite depuis le contexte au lieu de déclencher
 * son propre `useProductOffers` au mount.
 */
export function BestOffersProvider({
  productIds,
  children,
}: {
  productIds: string[];
  children: ReactNode;
}) {
  const { data, isLoading, isError, error } = useBestOffersBatch(productIds);
  const errorCode = (error as any)?.code ?? (error as any)?.status ?? null;
  return (
    <BestOffersContext.Provider value={{ map: data ?? new Map(), isLoading, isError, errorCode }}>
      {children}
    </BestOffersContext.Provider>
  );
}

export function useBestOfferForProduct(productId: string): {
  bestOffer: BatchBestOffer | undefined;
  isLoading: boolean;
  isError: boolean;
  errorCode?: string | null;
  hasContext: boolean;
} {
  const ctx = useContext(BestOffersContext);
  if (!ctx) return { bestOffer: undefined, isLoading: false, isError: false, hasContext: false };
  return {
    bestOffer: ctx.map.get(productId),
    isLoading: ctx.isLoading,
    isError: ctx.isError,
    errorCode: ctx.errorCode,
    hasContext: true,
  };
}

