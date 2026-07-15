import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCountry } from "@/contexts/CountryContext";

/**
 * Modal bloquant style apple.com : s'affiche uniquement quand
 * - aucun pays stocké (localStorage / profil / URL)
 * - ET l'auto-détection IP n'a pas renvoyé un pays supporté (BE/FR/NL/LU/DE).
 *
 * Impossible à fermer sans choix. Le choix est persisté par CountryContext.setCountry.
 */
export function CountryOnboardingModal() {
  const { t } = useTranslation();
  const { needsCountryChoice, activeCountries, setCountry, detectedCountry, loading } = useCountry();

  if (loading || !needsCountryChoice || activeCountries.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="country-onboarding-title"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MapPin size={22} className="text-primary" />
            </div>
            <h2 id="country-onboarding-title" className="text-xl font-bold text-mk-navy">
              {t("countryOnboarding.title")}
            </h2>
            <p className="text-sm text-mk-sec mt-2 leading-snug">
              {t("countryOnboarding.description")}
            </p>
            {detectedCountry && (
              <p className="text-[11.5px] text-mk-sec mt-2">
                {t("countryOnboarding.detectedUnsupported", { country: detectedCountry })}
              </p>
            )}
          </div>

          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeCountries.map((c) => (
              <button
                key={c.code}
                onClick={() => setCountry(c.code)}
                className="flex items-center gap-3 p-3 rounded-xl border border-mk-line hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <span className="text-2xl leading-none">{c.flag_emoji || "🌍"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{c.name}</div>
                  <div className="text-[11px] text-mk-sec">
                    {t("countryOnboarding.meta", {
                      code: c.code,
                      currency: c.currency,
                      vat: c.default_vat_rate ?? "—",
                    })}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="px-6 py-3 border-t border-border bg-slate-50 text-[11px] text-mk-sec flex items-start gap-1.5">
            <Truck size={12} className="shrink-0 mt-0.5" />
            <span>{t("countryOnboarding.footer")}</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
