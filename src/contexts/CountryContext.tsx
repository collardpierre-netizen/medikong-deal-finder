import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Country {
  code: string;
  name: string;
  name_local: string | null;
  flag_emoji: string | null;
  currency: string;
  default_vat_rate: number | null;
  default_language: string | null;
  is_active: boolean;
  qogita_sync_enabled: boolean;
  display_order: number;
}

interface CountryContextType {
  country: string;
  setCountry: (code: string) => void;
  countries: Country[];
  activeCountries: Country[];
  currentCountry: Country | undefined;
  loading: boolean;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<string>(() => {
    return localStorage.getItem("mk_country") || "BE";
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      const { data } = await supabase
        .from("countries")
        .select("*")
        .order("display_order");
      if (data) setCountries(data as unknown as Country[]);
      setLoading(false);
    };
    fetchCountries();
  }, []);

  // Auto-detect country on first visit
  useEffect(() => {
    const stored = localStorage.getItem("mk_country");
    if (stored) return; // already chosen

    const detectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        const detected = data?.country_code;
        if (detected && countries.some(c => c.code === detected && c.is_active)) {
          setCountryState(detected);
          localStorage.setItem("mk_country", detected);
        }
      } catch {
        // fallback to BE
      }
    };
    if (countries.length > 0) detectCountry();
  }, [countries]);

  const setCountry = (code: string) => {
    setCountryState(code);
    localStorage.setItem("mk_country", code);
  };

  const activeCountries = countries.filter(c => c.is_active);
  const currentCountry = countries.find(c => c.code === country);

  return (
    <CountryContext.Provider value={{ country, setCountry, countries, activeCountries, currentCountry, loading }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error("useCountry must be used within CountryProvider");
  return ctx;
}
