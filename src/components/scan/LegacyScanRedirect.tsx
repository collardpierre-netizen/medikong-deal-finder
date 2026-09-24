import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scanUrlFromLegacyPath } from "@/config/surface";

/** Monté sur `/scan` de la marketplace : renvoie vers scan.medikong.pro. */
export default function LegacyScanRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(scanUrlFromLegacyPath(location.pathname, location.search));
  }, [location.pathname, location.search]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
      <p className="text-muted-foreground">Redirection vers scan.medikong.pro…</p>
    </div>
  );
}
