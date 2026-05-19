import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  sanitizeVendorLabel,
  getVendorPublicName,
} from "@/lib/vendor-display";

describe("sanitizeVendorLabel — neutralise toujours Qogita", () => {
  const QOGITA_VARIANTS = [
    "Qogita",
    "qogita",
    "QOGITA",
    "QoGiTa",
    "Qogita B.V.",
    "Qogita Marketplace",
    "Vendeur Qogita FR",
    "  qogita  ",
    "powered by qogita",
    "Distributeur QOGITA Europe",
  ];

  it.each(QOGITA_VARIANTS)('masque "%s" derrière le display_code', (raw) => {
    expect(sanitizeVendorLabel(raw, "AB12CD")).toBe("Vendeur AB12CD");
    expect(sanitizeVendorLabel(raw, "AB12CD")).not.toMatch(/qogita/i);
  });

  it.each(QOGITA_VARIANTS)('masque "%s" même sans display_code', (raw) => {
    const out = sanitizeVendorLabel(raw, null);
    expect(out).toBe("Vendeur MediKong");
    expect(out).not.toMatch(/qogita/i);
  });

  it("préserve un nom de vendeur réel non-Qogita", () => {
    expect(sanitizeVendorLabel("Pharma Belgique SA", "ZZ9999")).toBe(
      "Pharma Belgique SA",
    );
  });

  it("retombe sur display_code si nom vide", () => {
    expect(sanitizeVendorLabel("", "ZZ9999")).toBe("Vendeur ZZ9999");
    expect(sanitizeVendorLabel(null, "ZZ9999")).toBe("Vendeur ZZ9999");
    expect(sanitizeVendorLabel(undefined, undefined)).toBe("Vendeur MediKong");
  });

  it("snapshot — table de vérité Qogita", () => {
    const matrix = QOGITA_VARIANTS.map((raw) => ({
      input: raw,
      withCode: sanitizeVendorLabel(raw, "AB12CD"),
      withoutCode: sanitizeVendorLabel(raw, null),
    }));
    expect(matrix).toMatchSnapshot();
  });
});

describe("getVendorPublicName — toujours anonymisé", () => {
  it("ignore show_real_name même à true", () => {
    expect(
      getVendorPublicName(
        {
          display_code: "AB12CD",
          company_name: "Pharma Belgique SA",
          name: "Pharma BE",
          show_real_name: true,
        },
        true,
      ),
    ).toBe("Fournisseur AB12CD");
  });

  it("snapshot — sortie figée", () => {
    expect(
      getVendorPublicName({
        display_code: "ZZ9999",
        company_name: "ACME",
        name: "ACME Pharma",
        show_real_name: true,
      }),
    ).toMatchSnapshot();
  });
});

/**
 * Contrat exports XLSX/CSV : aucune sortie acheteur ne doit fuiter
 * `company_name`/`name` vendeur en clair. Tout passage par les exports
 * doit être routé via `getVendorPublicName` ou `sanitizeVendorLabel`.
 *
 * Test statique sur le source de `src/lib/xlsx-utils.ts` — détecte tout
 * fallback `v.company_name || v.name` qui contournerait le garde-fou.
 */
describe("xlsx-utils — exports anonymisés (contrat statique)", () => {
  const SRC = readFileSync(
    resolve(__dirname, "../xlsx-utils.ts"),
    "utf-8",
  );

  it("n'expose jamais company_name/name vendeur en clair dans une row export", () => {
    // Patterns interdits : `v.company_name`, `v.name` (vendeur), `vendor.company_name`
    const forbidden = [
      /\bv\.company_name\b/,
      /\bv\.name\b(?!\s*=)/,
      /\bvendor\.company_name\b/,
      /\bvendors?\.company_name\b/,
    ];
    const violations = forbidden.filter((re) => re.test(SRC));
    expect(
      violations,
      `xlsx-utils.ts contient des fuites vendeur non anonymisées : ${violations
        .map((r) => r.source)
        .join(", ")}. Router via getVendorPublicName().`,
    ).toEqual([]);
  });

  it("importe le garde-fou d'anonymisation vendeur", () => {
    expect(SRC).toMatch(
      /vendor-display|vendor-anonymization-map/,
    );
    expect(SRC).toMatch(/getVendorPublicName|sanitizeVendorLabel|resolveVendorLabel|resolveVendorAnonMap/);
  });
});
