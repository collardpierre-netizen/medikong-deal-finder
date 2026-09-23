// Calcul pur de la remise et du verdict — testable.

export interface OverrideRulesV2 {
  version?: number;
  general_pct?: number | null;
  categories?: { category_id: string; pct: number }[];
  brands?: { brand_id: string; pct: number }[];
}

/** Priorité : marque > catégorie > générale (v2) > override_default > défaut grossiste. */
export function resolveDiscountPct(opts: {
  rules?: OverrideRulesV2 | null;
  overrideDefaultPct?: number | null;
  wholesalerDefaultPct?: number | null;
  brandId?: string | null;
  categoryIds?: (string | null | undefined)[];
}): number {
  const r = opts.rules;
  if (r && r.version === 2) {
    const b = opts.brandId && r.brands?.find((x) => x.brand_id === opts.brandId);
    if (b) return clamp(b.pct);
    for (const cid of opts.categoryIds ?? []) {
      const c = cid && r.categories?.find((x) => x.category_id === cid);
      if (c) return clamp(c.pct);
    }
    if (r.general_pct != null) return clamp(r.general_pct);
  }
  if (opts.overrideDefaultPct != null) return clamp(Number(opts.overrideDefaultPct));
  return clamp(Number(opts.wholesalerDefaultPct ?? 0));
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(80, Math.max(0, v));
}

export type Verdict = "green" | "orange" | "red" | "none";

/** delta = ref − best. Vert ≤ 0 ; orange ≤ 10 % ; rouge au-delà. */
export function computeVerdict(ref: number | null, best: number | null): { verdict: Verdict; delta: number | null } {
  if (ref == null || best == null || ref <= 0) return { verdict: "none", delta: null };
  const delta = round2(ref - best);
  if (delta <= 0) return { verdict: "green", delta };
  return { verdict: delta / ref <= 0.10 ? "orange" : "red", delta };
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
