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
      retry: 3,
      // Backoff exponentiel plafonné à 8 s (jitter géré côté fetch).
      retryDelay: (attemptIndex) => Math.min(8000, 500 * 2 ** attemptIndex),
    },
  },
});

