// Calcul pur de la remise et du verdict — testable.

export interface OverrideRulesV2 {
  version?: number;
  general_pct?: number | null;
  categories?: { category_id: string; pct: number }[];
  brands?: { brand_id: string; pct: number; name?: string; min_order_cents?: number | null; franco_cents?: number | null }[];
  manufacturers?: { manufacturer_id: string; pct: number; name?: string; min_order_cents?: number | null; franco_cents?: number | null }[];
}

/** Priorité : marque > fabricant > catégorie > générale (v2) > override_default > défaut grossiste. */
export function resolveDiscountPct(opts: {
  rules?: OverrideRulesV2 | null;
  overrideDefaultPct?: number | null;
  wholesalerDefaultPct?: number | null;
  brandId?: string | null;
  manufacturerId?: string | null;
  categoryIds?: (string | null | undefined)[];
}): number {
  return resolveDiscount(opts).pct;
}

export type DiscountKind = "brand" | "manufacturer" | "category" | "general" | "default";

/** Même priorité, avec l'origine de la remise (pour « remise Nutricia 15 % »). */
export function resolveDiscount(opts: Parameters<typeof resolveDiscountPct>[0]): { pct: number; kind: DiscountKind; name: string | null } {
  const r = opts.rules;
  if (r && r.version === 2) {
    const b = opts.brandId && r.brands?.find((x) => x.brand_id === opts.brandId);
    if (b) return { pct: clamp(b.pct), kind: "brand", name: b.name ?? null };
    const m = opts.manufacturerId && r.manufacturers?.find((x) => x.manufacturer_id === opts.manufacturerId);
    if (m) return { pct: clamp(m.pct), kind: "manufacturer", name: m.name ?? null };
    for (const cid of opts.categoryIds ?? []) {
      const c = cid && r.categories?.find((x) => x.category_id === cid);
      if (c) return { pct: clamp(c.pct), kind: "category", name: null };
    }
    if (r.general_pct != null) return { pct: clamp(r.general_pct), kind: "general", name: null };
  }
  if (opts.overrideDefaultPct != null) return { pct: clamp(Number(opts.overrideDefaultPct)), kind: "general", name: null };
  return { pct: clamp(Number(opts.wholesalerDefaultPct ?? 0)), kind: "default", name: null };
}

export function discountLabel(d: { pct: number; kind: DiscountKind; name: string | null }): string {
  const v = String(d.pct).replace(".", ",");
  if ((d.kind === "brand" || d.kind === "manufacturer") && d.name) return `remise ${d.name} ${v} %`;
  if (d.kind === "category") return `remise gamme ${v} %`;
  return `remise générale ${v} %`;
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
