import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bandeau global : source Qogita gelée depuis le retrait de son API offres.
 * Ne s'affiche que si `qogita_config.offers_source_healthy` = false.
 * Passe à false → true automatiquement (aucune régression) dès qu'un cycle
 * complet du scraper storefront a re-vérifié le périmètre.
 */
export function QogitaFreezeBanner() {
  const { data } = useQuery({
    queryKey: ["qogita-freeze-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("qogita_config")
        .select("key, value")
        .in("key", ["offers_source_healthy", "offers_frozen_since"]);
      const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
      return {
        healthy: map.get("offers_source_healthy") === "true",
        frozenSince: map.get("offers_frozen_since") ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (!data || data.healthy) return null;

  const dateFr = data.frozenSince
    ? new Date(data.frozenSince).toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div
      role="status"
      className="w-full border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="leading-snug">
          <span className="font-semibold">Offres &amp; prix figés</span>
          {dateFr ? <> depuis le {dateFr}</> : null} — la source Qogita est en
          reconnexion. Certaines offres peuvent ne pas être disponibles à la
          commande le temps de la re-vérification.
        </p>
      </div>
    </div>
  );
}
