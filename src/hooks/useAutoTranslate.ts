import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TranslationResult {
  translated: string;
  isTranslated: boolean;
  isLoading: boolean;
  original: string;
}

interface UseAutoTranslateOptions {
  /** If provided, the translation will be persisted to products.<field>_<lang> for re-use across all users. */
  productId?: string;
  field?: "name" | "short_description" | "description";
  /** Source language of the input text (defaults to "fr"). */
  sourceLang?: string;
}

// Per-tab in-memory cache to avoid re-querying the edge function in a single session.
const memoryCache = new Map<string, string>();
// Avoid spamming a billing toast more than once per minute.
let lastBillingToastAt = 0;

export function useAutoTranslate(
  text: string | null | undefined,
  options: UseAutoTranslateOptions = {},
): TranslationResult {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || "fr";
  const sourceLang = options.sourceLang || "fr";
  const [translated, setTranslated] = useState(text || "");
  const [isLoading, setIsLoading] = useState(false);

  const autoTranslate =
    typeof window !== "undefined"
      ? localStorage.getItem("medikong_auto_translate") !== "false"
      : true;

  useEffect(() => {
    if (!text || currentLang === sourceLang || !autoTranslate) {
      setTranslated(text || "");
      return;
    }

    const cacheKey = `${sourceLang}:${currentLang}:${text.substring(0, 200)}`;

    if (memoryCache.has(cacheKey)) {
      setTranslated(memoryCache.get(cacheKey)!);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const payload = {
      texts: [
        options.productId && options.field
          ? { text, productId: options.productId, field: options.field }
          : text,
      ],
      targetLang: currentLang,
      sourceLang,
    };

    supabase.functions
      .invoke("translate-and-cache", { body: payload })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          // supabase-js wraps non-2xx as error; surface billing/rate-limit messages
          const status = (error as { status?: number }).status;
          if (status === 429) {
            const now = Date.now();
            if (now - lastBillingToastAt > 60_000) {
              lastBillingToastAt = now;
              toast.warning("Trop de traductions à la fois — réessaie dans un instant.");
            }
          } else if (status === 402) {
            const now = Date.now();
            if (now - lastBillingToastAt > 60_000) {
              lastBillingToastAt = now;
              toast.error(
                "Crédits IA épuisés — recharge ton workspace pour réactiver les traductions.",
              );
            }
          }
          setTranslated(text);
          setIsLoading(false);
          return;
        }

        const result = data?.translations?.[0];
        if (typeof result === "string" && result.trim()) {
          memoryCache.set(cacheKey, result);
          setTranslated(result);
        } else {
          setTranslated(text);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [text, currentLang, sourceLang, autoTranslate, options.productId, options.field]);

  return {
    translated,
    isTranslated: currentLang !== sourceLang && autoTranslate && translated !== text,
    isLoading,
    original: text || "",
  };
}
