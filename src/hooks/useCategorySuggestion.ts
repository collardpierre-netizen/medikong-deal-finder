import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CategorySuggestion = {
  category_id: string;
  category_name: string;
  product_id: string;
  product_name: string;
  matched_by: "gtin" | "cnk";
};

/**
 * Suggests a category by looking up an active product matching the given GTIN or CNK.
 * Priority: GTIN > CNK. Debounced (300ms). Returns null if nothing matches.
 */
export function useCategorySuggestion(gtin: string | undefined, cnk: string | undefined) {
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cleanGtin = (gtin || "").replace(/\D/g, "");
    const cleanCnk = (cnk || "").replace(/\D/g, "");

    if (!cleanGtin && !cleanCnk) {
      setSuggestion(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // Variantes GTIN (padding éventuel) — comme l'import CSV
        const variants = new Set<string>();
        if (cleanGtin) {
          variants.add(cleanGtin);
          if (cleanGtin.length < 14) variants.add(cleanGtin.padStart(14, "0"));
          if (cleanGtin.length < 13) variants.add(cleanGtin.padStart(13, "0"));
          const stripped = cleanGtin.replace(/^0+/, "");
          if (stripped.length >= 8) variants.add(stripped);
        }

        let matchedBy: "gtin" | "cnk" | null = null;
        let product: any = null;

        if (variants.size > 0) {
          const { data } = await supabase
            .from("products")
            .select("id, name, category_id, categories(name)")
            .in("gtin", Array.from(variants))
            .eq("is_active", true)
            .not("category_id", "is", null)
            .limit(1);
          if (data && data[0]) { product = data[0]; matchedBy = "gtin"; }
        }

        if (!product && cleanCnk) {
          const { data } = await supabase
            .from("products")
            .select("id, name, category_id, categories(name)")
            .eq("cnk_code", cleanCnk)
            .eq("is_active", true)
            .not("category_id", "is", null)
            .limit(1);
          if (data && data[0]) { product = data[0]; matchedBy = "cnk"; }
        }

        if (cancelled) return;

        if (product?.category_id && product?.categories?.name) {
          setSuggestion({
            category_id: product.category_id,
            category_name: product.categories.name,
            product_id: product.id,
            product_name: product.name,
            matched_by: matchedBy!,
          });
        } else {
          setSuggestion(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [gtin, cnk]);

  return { suggestion, loading };
}
