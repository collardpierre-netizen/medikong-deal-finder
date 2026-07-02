import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient global partagé.
 *
 * Extrait dans son propre module pour permettre l'invalidation ciblée
 * (ex. `bustAdminQueryCache`) depuis des utilitaires hors composants.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});
