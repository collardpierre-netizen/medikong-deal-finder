import { useCountry } from "@/contexts/CountryContext";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function CountrySelector() {
  const { country, setCountry, activeCountries, currentCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
      >
        <span className="text-base leading-none">{currentCountry?.flag_emoji || "🌍"}</span>
        <span className="hidden sm:inline">{currentCountry?.name || country}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-border py-1 min-w-[180px] z-50"
          >
            {activeCountries.map(c => (
              <button
                key={c.code}
                onClick={() => { setCountry(c.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                  c.code === country ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="text-base">{c.flag_emoji}</span>
                <span>{c.name}</span>
                {c.code === country && <span className="ml-auto text-primary text-xs">✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
