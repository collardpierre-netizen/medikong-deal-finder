import { describe, it, expect } from "vitest";

/**
 * Régression : la boutique vendeur doit dédupliquer les offres par produit
 * (un vendeur peut avoir plusieurs offres actives pour le même produit) sinon
 * React garde des cartes "fantômes" lors de l'application des filtres marque
 * et catégorie. On reproduit ici la logique de `vendorProducts` + filtres de
 * `src/pages/VendorPublicPage.tsx` sur des offres dupliquées.
 */

function slugify(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type Offer = {
  id: string;
  price_excl_vat: number;
  stock_quantity: number;
  products: {
    id: string;
    slug: string;
    name: string;
    brand_name: string | null;
    category_name: string | null;
    image_urls?: string[];
    brands?: { slug: string } | null;
  };
};

function dedupeOffers(offers: Offer[]) {
  const byProduct = new Map<string, Offer>();
  for (const o of offers) {
    if (!o.products) continue;
    const existing = byProduct.get(o.products.id);
    const price = Number(o.price_excl_vat) || 0;
    const existingPrice = existing ? Number(existing.price_excl_vat) || 0 : Infinity;
    const candWeight = (o.stock_quantity > 0 ? 0 : 1) * 1e9 + price;
    const exWeight = existing ? (existing.stock_quantity > 0 ? 0 : 1) * 1e9 + existingPrice : Infinity;
    if (!existing || candWeight < exWeight) byProduct.set(o.products.id, o);
  }
  return Array.from(byProduct.values()).map((o) => {
    const p = o.products;
    return {
      id: p.id,
      brand: p.brand_name || "",
      brandSlug: p.brands?.slug || slugify(p.brand_name || ""),
      categoryName: p.category_name || "",
      categorySlug: p.category_name ? slugify(p.category_name) : "",
      stock: o.stock_quantity > 0,
      price: Number(o.price_excl_vat) || 0,
      offerId: o.id,
    };
  });
}

function applyFilters(
  list: ReturnType<typeof dedupeOffers>,
  filters: { brands?: string[]; categories?: string[] }
) {
  let out = list;
  if (filters.brands?.length) out = out.filter((p) => filters.brands!.includes(p.brandSlug));
  if (filters.categories?.length) out = out.filter((p) => filters.categories!.includes(p.categorySlug));
  return out;
}

const productA = {
  id: "prod-a",
  slug: "pluggerz-earplugs",
  name: "Pluggerz Earplugs",
  brand_name: "Pluggerz",
  category_name: "Hygiene",
  brands: { slug: "pluggerz" },
};
const productB = {
  id: "prod-b",
  slug: "hydratis-peche",
  name: "Hydratis Pêche",
  brand_name: "Hydratis",
  category_name: "Boissons",
  brands: { slug: "hydratis" },
};
const productC = {
  id: "prod-c",
  slug: "bioderma-h2o",
  name: "Bioderma H2O",
  brand_name: "Bioderma",
  category_name: "Hygiene",
  brands: { slug: "bioderma" },
};

const duplicatedOffers: Offer[] = [
  // 3 offres pour productA (cas de prod observé sur fixmer-pharma)
  { id: "o1", price_excl_vat: 12, stock_quantity: 0, products: productA },
  { id: "o2", price_excl_vat: 9, stock_quantity: 5, products: productA },
  { id: "o3", price_excl_vat: 11, stock_quantity: 10, products: productA },
  // 2 offres pour productB
  { id: "o4", price_excl_vat: 4.83, stock_quantity: 20, products: productB },
  { id: "o5", price_excl_vat: 5.10, stock_quantity: 0, products: productB },
  // 1 offre pour productC
  { id: "o6", price_excl_vat: 5.25, stock_quantity: 30, products: productC },
];

describe("VendorPublicPage — déduplication offres + filtres", () => {
  it("dédoublonne les offres par product_id (1 carte par produit)", () => {
    const products = dedupeOffers(duplicatedOffers);
    expect(products).toHaveLength(3);
    const ids = products.map((p) => p.id).sort();
    expect(ids).toEqual(["prod-a", "prod-b", "prod-c"]);
  });

  it("conserve l'offre en stock la moins chère pour un même produit", () => {
    const products = dedupeOffers(duplicatedOffers);
    const a = products.find((p) => p.id === "prod-a")!;
    expect(a.offerId).toBe("o2"); // 9€, en stock
    expect(a.price).toBe(9);
    expect(a.stock).toBe(true);
  });

  it("le filtre marque réduit la liste sans cartes fantômes", () => {
    const products = dedupeOffers(duplicatedOffers);
    const filtered = applyFilters(products, { brands: ["hydratis"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("prod-b");
    expect(filtered[0].brand).toBe("Hydratis");
  });

  it("le filtre catégorie réduit la liste sans cartes fantômes", () => {
    const products = dedupeOffers(duplicatedOffers);
    const filtered = applyFilters(products, { categories: ["hygiene"] });
    expect(filtered.map((p) => p.id).sort()).toEqual(["prod-a", "prod-c"]);
    expect(filtered.every((p) => p.categorySlug === "hygiene")).toBe(true);
  });

  it("combine marque + catégorie", () => {
    const products = dedupeOffers(duplicatedOffers);
    const filtered = applyFilters(products, { brands: ["pluggerz"], categories: ["hygiene"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("prod-a");
  });

  it("régression : compte produit > nombre de cards filtrées (pas d'inflation par doublons)", () => {
    const products = dedupeOffers(duplicatedOffers);
    // Sans déduplication, le filtre marque "pluggerz" aurait retourné 3 cards
    // (les 3 offres dupliquées). Avec déduplication on doit en avoir 1.
    const filtered = applyFilters(products, { brands: ["pluggerz"] });
    expect(filtered.length).toBeLessThan(
      duplicatedOffers.filter((o) => o.products.brands?.slug === "pluggerz").length
    );
    expect(filtered).toHaveLength(1);
  });
});
