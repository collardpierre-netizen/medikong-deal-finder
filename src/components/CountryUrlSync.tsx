import { useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useCountry } from "@/contexts/CountryContext";

const SUPPORTED = ["BE", "FR", "NL", "LU", "DE"];

/**
 * Sync le pays sélectionné avec le paramètre `?country=XX` de l'URL.
 * - Au premier montage / changement de route : si `?country=XX` est présent et valide,
 *   on l'applique via le contexte (persisté en localStorage + profil).
 * - Quand le pays change côté contexte : on met à jour le paramètre d'URL (replace, pas push).
 */
export function CountryUrlSync() {
  const { country, setCountry } = useCountry();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const initializedFromUrl = useRef(false);

  // URL → contexte (une seule fois, ou si l'utilisateur change de pays via lien externe)
  useEffect(() => {
    const urlCountry = params.get("country")?.toUpperCase();
    if (urlCountry && SUPPORTED.includes(urlCountry) && urlCountry !== country) {
      setCountry(urlCountry);
    }
    initializedFromUrl.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Contexte → URL (quand le pays change, on écrit le paramètre)
  useEffect(() => {
    if (!initializedFromUrl.current) return;
    const current = params.get("country");
    if (current === country) return;
    const next = new URLSearchParams(params);
    if (country) {
      next.set("country", country);
    } else {
      next.delete("country");
    }
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  return null;
}
