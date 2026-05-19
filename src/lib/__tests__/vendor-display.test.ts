import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
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

/**
 * 🔒 Fuzz / property test : getVendorPublicName ne doit JAMAIS fuiter
 * la valeur reçue dans `name` ou `company_name` dans sa sortie,
 * quel que soit le contenu (réel, vide, Qogita, accents, html, etc.).
 */
describe("getVendorPublicName — propriété : aucune fuite name/company_name", () => {
  const NAMES = [
    "Pharma Belgique SA",
    "ACME Pharma",
    "Qogita B.V.",
    "<script>alert(1)</script>",
    "Distributeur Médical Européen",
    "  Multi   Space   Vendor  ",
    "VENDOR_WITH_UNDERSCORES",
    "Société Générale Pharmaceutique & Cie",
    "🇧🇪 Pharma BE",
    "X",
    "a".repeat(200),
  ];
  const COMPANIES = [
    "MegaCorp International",
    "Tiny SARL",
    "Qogita Marketplace EU",
    "Distrib. Vétérinaire de l'Ouest",
    "Holding 123 SA",
    "",
  ];

  for (const name of NAMES) {
    for (const company of COMPANIES) {
      it(`anonymise (name="${name.slice(0, 20)}…", company="${company.slice(0, 20)}…")`, () => {
        const out = getVendorPublicName({
          display_code: "AB12CD",
          name,
          company_name: company,
          show_real_name: true, // ignoré par contrat
        });
        // La sortie est figée
        expect(out).toBe("Fournisseur AB12CD");
        // Et ne contient strictement aucun morceau identifiable
        if (name.length >= 3) expect(out).not.toContain(name);
        if (company.length >= 3) expect(out).not.toContain(company);
        expect(out).not.toMatch(/qogita/i);
      });
    }
  }

  it("fallback : sans display_code, retombe sur un code dérivé sans exposer le nom complet", () => {
    const out = getVendorPublicName({
      display_code: null,
      name: "PharmaBelgique",
      company_name: "Pharma Belgique SA",
    });
    expect(out).toMatch(/^Fournisseur /);
    expect(out).not.toBe("Pharma Belgique SA");
    expect(out).not.toContain("Pharma Belgique SA");
  });
});

/**
 * Contrat statique : tout export PDF/CSV/XLSX côté acheteur doit router
 * les libellés vendeur via `getVendorPublicName` (ou helper équivalent),
 * jamais via `vendor.company_name` / `vendor.name` brut.
 */
describe("Exports PDF/CSV buyer-facing — contrat statique", () => {
  const TARGETS = [
    "../../pages/OrderDetailPage.tsx",
    "../../components/buyer/BuyerImportModal.tsx",
  ];

  for (const rel of TARGETS) {
    const path = resolve(__dirname, rel);
    const src = readFileSync(path, "utf-8");

    it(`${rel} importe le garde-fou getVendorPublicName`, () => {
      expect(src).toMatch(/getVendorPublicName|resolveVendorLabel/);
    });

    it(`${rel} ne contient pas de fuite \`v.company_name\`/\`v.name\` non routée`, () => {
      // On interdit les patterns d'accès direct dans des structures de row export.
      const forbidden = [
        /vendor\.company_name(?!\s*\?\?\s*)/,
        /vendor\?\.company_name(?!\s*\?\?)/,
      ];
      const violations = forbidden.filter((re) => re.test(src));
      expect(
        violations,
        `${rel} fuit company_name vendeur en clair dans un export : ${violations.map((r) => r.source).join(", ")}`,
      ).toEqual([]);
    });
  }
});

/**
 * Contrat statique : les templates emails transactionnels buyer-facing
 * ne doivent jamais lire `.company_name` ou `vendor.name` directement.
 * Le seul vecteur autorisé est une prop déjà-rendue (ex : `vendorDisplayName`)
 * qui DOIT être alimentée par le caller via `getVendorPublicName`.
 */
describe("Email templates buyer-facing — contrat statique", () => {
  const TEMPLATES_DIR = resolve(
    __dirname,
    "../../../supabase/functions/_shared/transactional-email-templates",
  );

  // Templates dont la cible est l'acheteur (buyer / customer).
  // Les templates vendor-* sont exclus : ils s'adressent au vendeur lui-même
  // (légitime de voir son propre nom).
  const BUYER_FACING = [
    "order-confirmation.tsx",
    "order-line-refunded-customer.tsx",
    "buyer-registration.tsx",
    "wholesale-savings-report.tsx",
  ];

  for (const file of BUYER_FACING) {
    const path = join(TEMPLATES_DIR, file);
    if (!existsSync(path)) continue;
    const src = readFileSync(path, "utf-8");

    it(`${file} ne lit jamais .company_name directement`, () => {
      expect(src).not.toMatch(/\.company_name\b/);
    });

    it(`${file} ne lit pas \`vendor.name\` brut (utiliser prop pré-rendue)`, () => {
      expect(src).not.toMatch(/\bvendor\.name\b/);
      expect(src).not.toMatch(/\bvendors\.name\b/);
    });
  }

  it("aucun template buyer-facing ne mentionne 'Qogita'", () => {
    for (const file of BUYER_FACING) {
      const path = join(TEMPLATES_DIR, file);
      if (!existsSync(path)) continue;
      const src = readFileSync(path, "utf-8");
      expect(src, `${file} contient 'Qogita'`).not.toMatch(/qogita/i);
    }
  });
});

/**
 * Contrat statique : les edge functions qui ENVOIENT des emails à
 * l'acheteur doivent alimenter la prop `vendorDisplayName` (ou la
 * variante legacy `vendorName` côté template-payload) via le helper
 * d'anonymisation, jamais via `vendor.company_name || vendor.name`.
 *
 * ⚠️ Ce test échouera tant qu'une fuite résiduelle existe dans un
 * caller — c'est le point. Si un test casse ici, fixer le caller
 * (router via "Fournisseur <display_code>") avant de relâcher.
 */
describe("Edge functions buyer-facing — contrat statique callers email", () => {
  const FUNCTIONS_DIR = resolve(__dirname, "../../../supabase/functions");

  // Edge functions qui envoient des emails à l'acheteur (et passent vendorDisplayName/vendorName).
  const BUYER_CALLERS = ["refund-order-line"];

  for (const fn of BUYER_CALLERS) {
    const path = join(FUNCTIONS_DIR, fn, "index.ts");
    if (!existsSync(path)) continue;
    const src = readFileSync(path, "utf-8");

    it(`${fn} ne construit pas vendorDisplayName/vendorName via \`vendor.company_name || vendor.name\``, () => {
      // Patternes typiques de fuite :
      //   const vendorName = vendor?.company_name || vendor?.name
      //   const vendorDisplayName = vendor?.company_name || vendor?.name
      const leak = /vendor(Name|DisplayName)\s*=\s*vendor\??\.?(company_name|name)/;
      expect(
        src,
        `${fn}/index.ts construit vendorDisplayName/vendorName à partir des champs en clair. Router via display_code → "Fournisseur <code>".`,
      ).not.toMatch(leak);
    });
  }
});

/**
 * Garde-fou statique buyer-facing — interdit tout AFFICHAGE direct des
 * champs sensibles (`company_name`, `show_real_name`, `vendor_name`)
 * dans les composants/pages destinés à l'acheteur (fichiers `.tsx`).
 *
 * Règle unique : aucun rendu JSX `{x.company_name}` /
 * `{x.show_real_name}` / `{x.vendor_name}` — toujours router via
 * `getVendorPublicName` / `sanitizeVendorLabel` / `resolveVendorName`.
 *
 * Note : on N'INTERDIT PAS les `select("... company_name ...")` ni
 * la lecture en mémoire — ces accès sont légitimes pour nourrir
 * l'anonymizer downstream. Seul le rendu final compte.
 *
 * Si un test casse, NE PAS allowlister le fichier : la fuite doit être
 * corrigée à la source en routant la valeur via l'helper d'anonymisation.
 */
describe("Guard buyer-facing — pas d'affichage JSX de company_name / show_real_name / vendor_name", () => {
  // Composants/pages acheteur déjà nettoyés. Étendre cette liste à chaque
  // nouvelle vue buyer-facing pour la verrouiller.
  const BUYER_FACING_TSX: readonly string[] = [
    "../../pages/ProductPage.tsx",
    "../../pages/VendorPublicPage.tsx",
    "../../pages/OrderDetailPage.tsx",
    "../../components/buyer/BuyerImportModal.tsx",
  ];

  // On flag toute expression JSX `{ ... .field ... }` qui n'est pas un
  // argument à un helper d'anonymisation reconnu.
  const SAFE_CALLERS = "(?:resolveVendorName|sanitizeVendorLabel|getVendorPublicName)";

  const FORBIDDEN_JSX = [
    {
      field: "company_name",
      regex: new RegExp(
        `\\{(?![^{}]*${SAFE_CALLERS}\\s*\\()[^{}]*\\.company_name\\b[^{}]*\\}`,
      ),
    },
    {
      field: "show_real_name",
      regex: new RegExp(
        `\\{(?![^{}]*${SAFE_CALLERS}\\s*\\()[^{}]*\\.show_real_name\\b[^{}]*\\}`,
      ),
    },
    {
      field: "vendor_name",
      regex: new RegExp(
        `\\{(?![^{}]*${SAFE_CALLERS}\\s*\\()[^{}]*\\.vendor_name\\b[^{}]*\\}`,
      ),
    },
  ];

  for (const rel of BUYER_FACING_TSX) {
    const path = resolve(__dirname, rel);
    if (!existsSync(path)) continue;
    const src = readFileSync(path, "utf-8");

    for (const { field, regex } of FORBIDDEN_JSX) {
      it(`${rel} — interdit : .${field} rendu en JSX hors anonymizer`, () => {
        const match = src.match(regex);
        expect(
          match,
          match
            ? `${rel} affiche \`.${field}\` en clair : « ${match[0].slice(0, 160)} ». Router via getVendorPublicName / sanitizeVendorLabel / resolveVendorName.`
            : undefined,
        ).toBeNull();
      });
    }
  }
});
