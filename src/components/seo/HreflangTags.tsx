import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { SUPPORTED_LANGUAGES } from "@/i18n";

/**
 * Emits <link rel="alternate" hreflang="..."> tags for the current page across
 * all supported languages, plus an x-default pointing to the FR canonical.
 *
 * Mount this once near the top of any public-facing page (Home, Catalogue,
 * Brand, Category, Product). Safe to mount multiple times — last write wins.
 *
 * Sprint 1 (Apr 2026): emits same URL per locale (no /en prefix yet). When
 * dedicated locale routes are added (Sprint 3), update this to prefix paths.
 */
export function HreflangTags({ baseUrl }: { baseUrl?: string } = {}) {
  const { pathname, search } = useLocation();
  const origin =
    baseUrl ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "https://medikong.pro");
  const fullUrl = `${origin}${pathname}${search}`;

  return (
    <Helmet>
      <link rel="canonical" href={fullUrl} />
      {SUPPORTED_LANGUAGES.map((lang) => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={lang}
          href={fullUrl}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={fullUrl} />
    </Helmet>
  );
}
