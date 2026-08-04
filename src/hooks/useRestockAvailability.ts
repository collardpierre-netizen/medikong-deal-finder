import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Disponibilité « seconde vie » (ReStock) sur le catalogue classique.
 *
 * Les lots ReStock vivent dans `restock_offers` (stock séparé, tunnel séparé).
 * Le seul point de rencontre avec le catalogue est l'identifiant produit :
 * EAN, sinon CNK. La lecture de `restock_offers` est réservée aux utilisateurs
 * authentifiés (RLS), donc le badge n'est jamais rendu en anonyme.
 */
export type SecondLifeInfo = {
  count: number;
  minPriceHt: number | null;
  maxPriceHt: number | null;
  bestGrade: string | null;
};

const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export function eanKey(v?: string | null) {
  return v ? `ean:${v}` : null;
}
export function cnkKey(v?: string | null) {
  return v ? `cnk:${v}` : null;
}

export type ProductKeyed = { gtin?: string | null; cnk_code?: string | null };

/** Récupère les EAN/CNK ayant au moins un lot ReStock publié (liste courte). */
export async function fetchSecondLifeKeys(): Promise<{ eans: string[]; cnks: string[] }> {
  const { data, error } = await supabase
    .from("restock_offers" as any)
    .select("ean, cnk")
    .eq("status", "published")
    .limit(2000);
  if (error || !data) return { eans: [], cnks: [] };
  const eans = new Set<string>();
  const cnks = new Set<string>();
  for (const row of data as any[]) {
    if (row.ean) eans.add(String(row.ean));
    if (row.cnk) cnks.add(String(row.cnk));
  }
  return { eans: [...eans], cnks: [...cnks] };
}

/** 1 seul round-trip pour la page courante du catalogue. */
export function useRestockAvailabilityMap(products: ProductKeyed[]) {
  const { isLoggedIn } = useAuth() as any;

  const eans = useMemo(
    () => [...new Set(products.map((p) => p.gtin).filter(Boolean) as string[])],
    [products]
  );
  const cnks = useMemo(
    () => [...new Set(products.map((p) => p.cnk_code).filter(Boolean) as string[])],
    [products]
  );

  const { data } = useQuery({
    queryKey: ["restock-availability", eans, cnks],
    enabled: !!isLoggedIn && (eans.length > 0 || cnks.length > 0),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, SecondLifeInfo>();
      const ors: string[] = [];
      if (eans.length) ors.push(`ean.in.(${eans.join(",")})`);
      if (cnks.length) ors.push(`cnk.in.(${cnks.join(",")})`);
      if (ors.length === 0) return map;

      const { data, error } = await supabase
        .from("restock_offers" as any)
        .select("ean, cnk, price_ht, grade")
        .eq("status", "published")
        .or(ors.join(","));
      if (error || !data) return map;

      for (const row of data as any[]) {
        const price = row.price_ht != null ? Number(row.price_ht) : null;
        for (const key of [eanKey(row.ean), cnkKey(row.cnk)]) {
          if (!key) continue;
          const prev = map.get(key);
          const grade = row.grade ? String(row.grade).toUpperCase() : null;
          map.set(key, {
            count: (prev?.count ?? 0) + 1,
            minPriceHt:
              price == null ? prev?.minPriceHt ?? null : Math.min(price, prev?.minPriceHt ?? price),
            maxPriceHt:
              price == null ? prev?.maxPriceHt ?? null : Math.max(price, prev?.maxPriceHt ?? price),
            bestGrade:
              grade == null
                ? prev?.bestGrade ?? null
                : prev?.bestGrade == null
                  ? grade
                  : (GRADE_RANK[grade] ?? 9) < (GRADE_RANK[prev.bestGrade] ?? 9)
                    ? grade
                    : prev.bestGrade,
          });
        }
      }
      return map;
    },
  });

  return data ?? new Map<string, SecondLifeInfo>();
}

export const RestockAvailabilityContext = createContext<Map<string, SecondLifeInfo> | null>(null);

/** Renvoie l'info seconde vie d'un produit, ou null hors provider / sans lot. */
export function useSecondLife(gtin?: string | null, cnk?: string | null): SecondLifeInfo | null {
  const map = useContext(RestockAvailabilityContext);
  if (!map) return null;
  const byEan = gtin ? map.get(`ean:${gtin}`) : undefined;
  if (byEan) return byEan;
  const byCnk = cnk ? map.get(`cnk:${cnk}`) : undefined;
  return byCnk ?? null;
}

/**
 * Reclasse la page courante selon la disponibilité seconde vie.
 * - `second_life` : les produits ayant un lot ReStock d'abord (puis prix bas).
 * - `best_saving` : plus grosse économie estimée (prix neuf − seconde vie) d'abord.
 * Les produits sans lot ReStock restent après, dans l'ordre serveur.
 */
export function sortBySecondLife<T extends ProductKeyed & { best_price_excl_vat?: number | null }>(
  products: T[],
  map: Map<string, SecondLifeInfo>,
  mode: "second_life" | "best_saving"
): T[] {
  if (map.size === 0) return products;

  const infoOf = (p: T) =>
    (p.gtin ? map.get(`ean:${p.gtin}`) : undefined) ?? (p.cnk_code ? map.get(`cnk:${p.cnk_code}`) : undefined) ?? null;

  const savingOf = (p: T) => {
    const info = infoOf(p);
    const newPrice = p.best_price_excl_vat ?? null;
    if (!info || info.minPriceHt == null || !newPrice || newPrice <= 0) return null;
    const saving = newPrice - info.minPriceHt;
    return saving > 0 ? saving : null;
  };

  return [...products]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (mode === "best_saving") {
        const sa = savingOf(a.p);
        const sb = savingOf(b.p);
        if (sa == null && sb == null) return a.i - b.i;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sb - sa || a.i - b.i;
      }
      const ia = infoOf(a.p);
      const ib = infoOf(b.p);
      if (!ia && !ib) return a.i - b.i;
      if (!ia) return 1;
      if (!ib) return -1;
      const pa = ia.minPriceHt ?? Number.POSITIVE_INFINITY;
      const pb = ib.minPriceHt ?? Number.POSITIVE_INFINITY;
      return pa - pb || a.i - b.i;
    })
    .map((x) => x.p);
}
