import { useCountry } from "@/contexts/CountryContext";
import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Truck, Info, MapPin, Eye, EyeOff, Globe, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCountryOfferCounts } from "@/hooks/useCountryOfferCounts";

const fmt = (n: number) => new Intl.NumberFormat("fr-BE").format(n);

export function CountrySelector() {
  const { country, setCountry, activeCountries, currentCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const [previewAll, setPreviewAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);


  const codes = useMemo(() => activeCountries.map((c) => c.code), [activeCountries]);
  const { data: counts, isLoading: countsLoading } = useCountryOfferCounts(open || previewAll ? codes : []);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hiddenCountries = activeCountries.filter((c) => c.code !== country);
  const activeCounts = counts?.[country];


  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
        aria-label={`Filtre de livraison actif : ${currentCountry?.name || country}. Cliquer pour changer.`}
        title={`Filtre livraison : ${currentCountry?.name || country}`}
      >
        <Truck size={12} className="opacity-80" />
        <span className="text-base leading-none">{currentCountry?.flag_emoji || "🌍"}</span>
        <span className="hidden sm:inline">
          <span className="opacity-70 mr-1 font-normal">Livrer vers</span>
          {currentCountry?.name || country}
        </span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-border py-0 min-w-[300px] z-50 overflow-hidden"
          >
            {/* Header explicatif */}
            <div className="px-3 py-2.5 bg-gradient-to-b from-slate-50 to-white border-b border-border">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <MapPin size={11} /> Pays de livraison
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Le catalogue, les prix et les offres affichés sont filtrés selon le pays choisi.
                Les offres dont les fournisseurs ne livrent pas ici sont masquées.
              </p>
            </div>

            {/* Pays actif */}
            <div className="px-3 pt-2 pb-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Filtre actif
              </div>
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-primary/5 border border-primary/20"
              >
                <span className="text-lg">{currentCountry?.flag_emoji || "🌍"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{currentCountry?.name || country}</div>
                  <div className="text-[10px] text-slate-500">
                    Devise&nbsp;{currentCountry?.currency || "EUR"} · TVA par défaut {currentCountry?.default_vat_rate ?? "—"}%
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10.5px]">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <Eye size={11} /> {countsLoading || !activeCounts ? "…" : fmt(activeCounts.visible)} visibles
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <EyeOff size={11} /> {countsLoading || !activeCounts ? "…" : fmt(activeCounts.hidden)} masquées
                    </span>
                  </div>
                </div>
                <span className="text-primary text-xs font-bold">✓</span>
              </div>
            </div>


            {/* Autres pays disponibles */}
            {hiddenCountries.length > 0 && (
              <div className="px-3 pt-2 pb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  Basculer vers un autre pays
                </div>
                <div className="space-y-0.5">
                  {hiddenCountries.map((c) => {
                    const cc = counts?.[c.code];
                    return (
                      <button
                        key={c.code}
                        onClick={() => {
                          setCountry(c.code);
                          setOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm hover:bg-slate-100 transition-colors text-left"
                      >
                        <span className="text-base">{c.flag_emoji}</span>
                        <span className="flex-1 text-foreground">{c.name}</span>
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-700 font-semibold">
                          <Eye size={10} /> {countsLoading || !cc ? "…" : fmt(cc.visible)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400">
                          <EyeOff size={10} /> {countsLoading || !cc ? "…" : fmt(cc.hidden)}
                        </span>
                      </button>
                    );
                  })}

                </div>
              </div>
            )}

            {/* CTA aperçu tous pays */}
            <button
              onClick={() => {
                setPreviewAll(true);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 border-t border-border text-[11.5px] font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              <Globe size={13} />
              Aperçu « tous pays » — comparer la visibilité
            </button>

            {/* Note bas de dropdown */}
            <div className="px-3 py-2 border-t border-border bg-slate-50 text-[10.5px] text-slate-500 leading-snug flex gap-1.5">
              <Info size={12} className="shrink-0 mt-0.5 text-slate-400" />
              <span>
                Une offre est visible si le fournisseur a coché <strong>{currentCountry?.code || country}</strong> dans ses pays de livraison.
                Vous voyez moins d'offres ici&nbsp;? Essayez un autre pays ci-dessus.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal aperçu tous pays */}
      <AnimatePresence>
        {previewAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[100] flex items-start justify-center pt-16 px-4"
            onClick={() => setPreviewAll(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gradient-to-b from-slate-50 to-white">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-primary" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Aperçu « tous pays »</div>
                    <div className="text-[11px] text-slate-500">Comparaison temporaire de la visibilité de vos offres par pays.</div>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewAll(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4">
                {countsLoading || !counts ? (
                  <div className="text-sm text-slate-500 py-6 text-center">Calcul en cours…</div>
                ) : (
                  <div className="space-y-2.5">
                    {activeCountries.map((c) => {
                      const cc = counts[c.code] || { visible: 0, hidden: 0 };
                      const total = cc.visible + cc.hidden;
                      const pct = total > 0 ? Math.round((cc.visible / total) * 100) : 0;
                      const isCurrent = c.code === country;
                      return (
                        <div
                          key={c.code}
                          className={`p-3 rounded-lg border ${isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-white"}`}
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <span className="text-lg leading-none">{c.flag_emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                {c.name}
                                {isCurrent && <span className="text-[10px] font-bold text-primary uppercase">actif</span>}
                              </div>
                              <div className="text-[10.5px] text-slate-500">
                                {fmt(cc.visible)} visibles / {fmt(total)} au total · {pct}%
                              </div>
                            </div>
                            {!isCurrent && (
                              <button
                                onClick={() => {
                                  setCountry(c.code);
                                  setPreviewAll(false);
                                }}
                                className="text-[10.5px] font-semibold text-primary hover:underline shrink-0"
                              >
                                Basculer
                              </button>
                            )}
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[10.5px]">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <Eye size={10} /> {fmt(cc.visible)} visibles
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <EyeOff size={10} /> {fmt(cc.hidden)} masquées
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-border bg-slate-50 text-[11px] text-slate-500 flex items-start gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>
                  Ce panneau ne modifie pas votre pays actif. Il compare, en lecture seule, combien d'offres sont visibles et masquées par pays afin d'identifier où votre catalogue est le mieux distribué.
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

