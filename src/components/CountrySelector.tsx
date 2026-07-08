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
    </div>
  );
}
