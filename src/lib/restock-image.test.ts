import { describe, it, expect, vi, beforeEach } from "vitest";

type ProductRow = { gtin?: string; cnk_code?: string; image_url: string };

const state: { byColumn: Record<string, ProductRow[]>; shouldThrow: boolean; calls: string[] } = {
  byColumn: {},
  shouldThrow: false,
  calls: [],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const builder: any = {
        _column: "",
        _values: [] as string[],
        select() {
          return builder;
        },
        in(column: string, values: string[]) {
          builder._column = column;
          builder._values = values;
          state.calls.push(column);
          return builder;
        },
        not() {
          return builder;
        },
        then(resolve: (r: { data: ProductRow[] | null }) => void) {
          if (state.shouldThrow) return Promise.reject(new Error("db down")).then(resolve as any);
          const rows = (state.byColumn[builder._column] || []).filter((r) =>
            builder._values.includes(String((r as any)[builder._column])),
          );
          return Promise.resolve({ data: rows }).then(resolve);
        },
      };
      return builder;
    },
  },
}));

const { resolveRestockOfferImage, attachRestockCatalogImages } = await import("@/lib/restock-image");

beforeEach(() => {
  state.byColumn = {};
  state.shouldThrow = false;
  state.calls = [];
});

describe("resolveRestockOfferImage — cascade", () => {
  it("priorise product_image_url", () => {
    expect(
      resolveRestockOfferImage({
        product_image_url: "https://cdn.test/a.jpg",
        photos: ["https://cdn.test/b.jpg"],
        photo_url: "https://cdn.test/c.jpg",
        catalog_image_url: "https://cdn.test/d.jpg",
      }),
    ).toBe("https://cdn.test/a.jpg");
  });

  it("retombe sur photos[0] (string)", () => {
    expect(
      resolveRestockOfferImage({
        product_image_url: null,
        photos: ["https://cdn.test/b.jpg", "https://cdn.test/b2.jpg"],
        photo_url: "https://cdn.test/c.jpg",
      }),
    ).toBe("https://cdn.test/b.jpg");
  });

  it("accepte photos[0] sous forme d'objet { url }", () => {
    expect(resolveRestockOfferImage({ photos: [{ url: "https://cdn.test/obj.jpg" }] })).toBe(
      "https://cdn.test/obj.jpg",
    );
  });

  it("ignore les entrées photos vides et prend la première valide", () => {
    expect(resolveRestockOfferImage({ photos: ["", "   ", "https://cdn.test/ok.jpg"] })).toBe(
      "https://cdn.test/ok.jpg",
    );
  });

  it("retombe sur photo_url", () => {
    expect(
      resolveRestockOfferImage({ product_image_url: "", photos: [], photo_url: "https://cdn.test/c.jpg" }),
    ).toBe("https://cdn.test/c.jpg");
  });

  it("retombe sur le produit MediKong rattaché", () => {
    expect(
      resolveRestockOfferImage({
        photo_url: null,
        medikong_product: { image_url: "https://cdn.test/mk.jpg" },
        catalog_image_url: "https://cdn.test/cat.jpg",
      }),
    ).toBe("https://cdn.test/mk.jpg");
  });

  it("retombe enfin sur catalog_image_url (EAN/CNK résolu)", () => {
    expect(resolveRestockOfferImage({ catalog_image_url: "https://cdn.test/cat.jpg" })).toBe(
      "https://cdn.test/cat.jpg",
    );
  });

  it("ignore les URLs placeholder invalides", () => {
    expect(
      resolveRestockOfferImage({
        product_image_url: "https://cdn.test/no-image.png",
        photo_url: "https://cdn.test/real.jpg",
      }),
    ).toBe("https://cdn.test/real.jpg");
  });

  it("retourne null sans aucune image et sans offre", () => {
    expect(resolveRestockOfferImage({})).toBeNull();
    expect(resolveRestockOfferImage(null)).toBeNull();
  });
});

describe("attachRestockCatalogImages — résolution EAN puis CNK", () => {
  it("résout par EAN (products.gtin)", async () => {
    state.byColumn.gtin = [{ gtin: "5400000000001", image_url: "https://cdn.test/ean.jpg" }];
    const [offer] = await attachRestockCatalogImages([{ ean: "5400000000001", cnk: null }]);
    expect(offer.catalog_image_url).toBe("https://cdn.test/ean.jpg");
    expect(resolveRestockOfferImage(offer)).toBe("https://cdn.test/ean.jpg");
  });

  it("résout par CNK quand l'EAN ne matche pas", async () => {
    state.byColumn.gtin = [];
    state.byColumn.cnk_code = [{ cnk_code: "1234567", image_url: "https://cdn.test/cnk.jpg" }];
    const [offer] = await attachRestockCatalogImages([{ ean: "0000000000000", cnk: "1234567" }]);
    expect(offer.catalog_image_url).toBe("https://cdn.test/cnk.jpg");
  });

  it("privilégie l'EAN sur le CNK quand les deux matchent", async () => {
    state.byColumn.gtin = [{ gtin: "5400000000001", image_url: "https://cdn.test/ean.jpg" }];
    state.byColumn.cnk_code = [{ cnk_code: "1234567", image_url: "https://cdn.test/cnk.jpg" }];
    const [offer] = await attachRestockCatalogImages([{ ean: "5400000000001", cnk: "1234567" }]);
    expect(offer.catalog_image_url).toBe("https://cdn.test/ean.jpg");
  });

  it("ne requête pas pour les offres ayant déjà une image", async () => {
    const offers = [{ ean: "5400000000001", product_image_url: "https://cdn.test/own.jpg" }];
    const result = await attachRestockCatalogImages(offers);
    expect(result).toBe(offers);
    expect(state.calls).toHaveLength(0);
  });

  it("laisse l'offre inchangée si aucun produit catalogue ne matche", async () => {
    const [offer] = await attachRestockCatalogImages([{ ean: "9999999999999", cnk: "0000000" }]);
    expect(offer.catalog_image_url).toBeUndefined();
    expect(resolveRestockOfferImage(offer)).toBeNull();
  });

  it("retourne les offres d'origine en cas d'erreur DB", async () => {
    state.shouldThrow = true;
    const offers = [{ ean: "5400000000001" }];
    await expect(attachRestockCatalogImages(offers)).resolves.toBe(offers);
  });

  it("gère une liste vide", async () => {
    const offers: any[] = [];
    expect(await attachRestockCatalogImages(offers)).toBe(offers);
  });
});
