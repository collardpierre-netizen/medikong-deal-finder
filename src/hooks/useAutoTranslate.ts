import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

interface TranslationResult {
  translated: string;
  isTranslated: boolean;
  isLoading: boolean;
  original: string;
}

const memoryCache = new Map<string, string>();

export function useAutoTranslate(text: string | null | undefined): TranslationResult {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || "fr";
  const [translated, setTranslated] = useState(text || "");
  const [isLoading, setIsLoading] = useState(false);

  const autoTranslate = typeof window !== "undefined"
    ? localStorage.getItem("medikong_auto_translate") !== "false"
    : true;

  useEffect(() => {
    if (!text || currentLang === "fr" || !autoTranslate) {
      setTranslated(text || "");
      return;
    }

    const cacheKey = `${currentLang}:${text.substring(0, 200)}`;

    if (memoryCache.has(cacheKey)) {
      setTranslated(memoryCache.get(cacheKey)!);
      return;
    }

    setIsLoading(true);

    supabase.functions.invoke("translate", {
      body: { texts: [text], targetLang: currentLang, sourceLang: "fr" },
    }).then(({ data, error }) => {
      if (!error && data?.translations?.[0]) {
        const result = data.translations[0];
        memoryCache.set(cacheKey, result);
        setTranslated(result);
      } else {
        setTranslated(text);
      }
      setIsLoading(false);
    });
  }, [text, currentLang, autoTranslate]);

  return {
    translated,
    isTranslated: currentLang !== "fr" && autoTranslate && translated !== text,
    isLoading,
    original: text || "",
  };
}
