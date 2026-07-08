import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  needsCountryChoice: boolean;
  detectedCountry: string | null;
}


const CountryContext = createContext<CountryContextType | undefined>(undefined);

const STORAGE_KEY = "mk_country";
const SUPPORTED = ["BE", "FR", "NL", "LU", "DE"];

async function persistRemote(code: string) {
  try {
    await (supabase.rpc as any)("set_user_preference", { _key: "country", _value: code });
  } catch {
    // best-effort
  }
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [country, setCountryState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "BE";
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasUserChoice, setHasUserChoice] = useState<boolean>(() => !!localStorage.getItem(STORAGE_KEY));

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

  // Load remote preference on login (takes priority over IP detect, not over explicit local choice made this session)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const remote = (data?.preferences as any)?.country as string | undefined;
      if (remote && SUPPORTED.includes(remote)) {
        setCountryState(remote);
        localStorage.setItem(STORAGE_KEY, remote);
        setHasUserChoice(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const [needsCountryChoice, setNeedsCountryChoice] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);

  // Auto-detect country on first visit (only if no explicit choice)
  useEffect(() => {
    if (hasUserChoice) return;
    if (countries.length === 0) return;

    const detectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        const detected = data?.country_code as string | undefined;
        setDetectedCountry(detected || null);
        if (
          detected &&
          SUPPORTED.includes(detected) &&
          countries.some((c) => c.code === detected && c.is_active)
        ) {
          setCountryState(detected);
          localStorage.setItem(STORAGE_KEY, detected);
          setHasUserChoice(true);
        } else {
          // IP renvoie un pays non supporté (ou rien) → on demande à l'utilisateur
          setNeedsCountryChoice(true);
        }
      } catch {
        // Timeout / erreur réseau → popup de choix
        setNeedsCountryChoice(true);
      }
    };
    detectCountry();
  }, [countries, hasUserChoice]);

  const setCountry = (code: string) => {
    setCountryState(code);
    localStorage.setItem(STORAGE_KEY, code);
    setHasUserChoice(true);
    setNeedsCountryChoice(false);
    if (user?.id) void persistRemote(code);
  };

  const activeCountries = countries.filter((c) => c.is_active);
  const currentCountry = countries.find((c) => c.code === country);

  return (
    <CountryContext.Provider
      value={{
        country,
        setCountry,
        countries,
        activeCountries,
        currentCountry,
        loading,
        needsCountryChoice,
        detectedCountry,
      }}
    >
      {children}
    </CountryContext.Provider>
  );
}


export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error("useCountry must be used within CountryProvider");
  return ctx;
}

