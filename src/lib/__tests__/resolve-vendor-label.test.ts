import { describe, it, expect } from "vitest";
import {
  resolveVendorLabel,
  resolveVendorVisibility,
  type VendorVisibilityRule,
} from "@/lib/vendor-display";

const vendor = {
  id: "v1",
  name: "Pharma SA",
  company_name: "Pharma Company SA",
  display_code: "ABC123",
  show_real_name: false,
};

const rule = (over: Partial<VendorVisibilityRule>): VendorVisibilityRule => ({
  vendor_id: "v1",
  country_code: null,
  customer_type: null,
  show_real_name: true,
  priority: 0,
  ...over,
});

describe("resolveVendorLabel — fallback anonymisation", () => {
  it("retourne 'Fournisseur <display_code>' sans règle et show_real_name=false", () => {
    expect(resolveVendorLabel(vendor, [])).toBe("Fournisseur ABC123");
  });

  it("retourne 'Fournisseur XXXXXX' si display_code manquant", () => {
    const v = { ...vendor, display_code: undefined as unknown as string };
    expect(resolveVendorLabel(v, [])).toBe("Fournisseur XXXXXX");
  });

  it("retourne le vrai nom (company_name prioritaire) si show_real_name=true au niveau vendeur", () => {
    expect(resolveVendorLabel({ ...vendor, show_real_name: true }, [])).toBe(
      "Pharma Company SA"
    );
  });

  it("retombe sur name si company_name absent", () => {
    const v = { ...vendor, show_real_name: true, company_name: undefined };
    expect(resolveVendorLabel(v, [])).toBe("Pharma SA");
  });

  it("anonymise si show_real_name=true mais aucun nom réel disponible", () => {
    const v = { ...vendor, show_real_name: true, company_name: "", name: "" };
    expect(resolveVendorLabel(v, [])).toBe("Fournisseur ABC123");
  });

  it("ignore les règles si context absent", () => {
    const rules = [rule({ show_real_name: true })];
    expect(resolveVendorLabel(vendor, rules)).toBe("Fournisseur ABC123");
  });

  it("ignore les règles si vendor.id manquant", () => {
    const v = { ...vendor, id: undefined };
    const rules = [rule({ show_real_name: true })];
    expect(resolveVendorLabel(v, rules, { country: "BE" })).toBe(
      "Fournisseur ABC123"
    );
  });
});

describe("resolveVendorLabel — matching pays × customer_type", () => {
  it("règle wildcard (country=null, type=null) autorise partout", () => {
    const rules = [rule({ show_real_name: true })];
    expect(
      resolveVendorLabel(vendor, rules, { country: "FR", customerType: "b2b" })
    ).toBe("Pharma Company SA");
  });

  it("règle pays-spécifique matche uniquement le bon pays", () => {
    const rules = [rule({ country_code: "BE", show_real_name: true })];
    expect(resolveVendorLabel(vendor, rules, { country: "BE" })).toBe(
      "Pharma Company SA"
    );
    expect(resolveVendorLabel(vendor, rules, { country: "FR" })).toBe(
      "Fournisseur ABC123"
    );
  });

  it("règle customer_type-spécifique matche uniquement le bon profil", () => {
    const rules = [rule({ customer_type: "pharmacy", show_real_name: true })];
    expect(
      resolveVendorLabel(vendor, rules, { customerType: "pharmacy" })
    ).toBe("Pharma Company SA");
    expect(
      resolveVendorLabel(vendor, rules, { customerType: "hospital" })
    ).toBe("Fournisseur ABC123");
  });

  it("règle combinée (pays + type) ne matche que si les deux collent", () => {
    const rules = [
      rule({
        country_code: "BE",
        customer_type: "pharmacy",
        show_real_name: true,
      }),
    ];
    expect(
      resolveVendorLabel(vendor, rules, {
        country: "BE",
        customerType: "pharmacy",
      })
    ).toBe("Pharma Company SA");
    expect(
      resolveVendorLabel(vendor, rules, {
        country: "BE",
        customerType: "hospital",
      })
    ).toBe("Fournisseur ABC123");
    expect(
      resolveVendorLabel(vendor, rules, {
        country: "FR",
        customer_type: "pharmacy" as unknown as string,
      } as { country?: string; customerType?: string })
    ).toBe("Fournisseur ABC123");
  });

  it("règle d'un autre vendeur est ignorée", () => {
    const rules = [
      rule({ vendor_id: "other", show_real_name: true }),
    ];
    expect(resolveVendorLabel(vendor, rules, { country: "BE" })).toBe(
      "Fournisseur ABC123"
    );
  });
});

describe("resolveVendorLabel — priorité des règles", () => {
  it("priorité la plus haute gagne (hide > show)", () => {
    const rules = [
      rule({ country_code: "BE", show_real_name: true, priority: 1 }),
      rule({ country_code: "BE", show_real_name: false, priority: 10 }),
    ];
    expect(resolveVendorLabel(vendor, rules, { country: "BE" })).toBe(
      "Fournisseur ABC123"
    );
  });

  it("priorité la plus haute gagne (show > hide)", () => {
    const rules = [
      rule({ country_code: "BE", show_real_name: false, priority: 1 }),
      rule({ country_code: "BE", show_real_name: true, priority: 10 }),
    ];
    expect(resolveVendorLabel(vendor, rules, { country: "BE" })).toBe(
      "Pharma Company SA"
    );
  });

  it("règle spécifique override le default vendeur (show_real_name=true)", () => {
    const v = { ...vendor, show_real_name: true };
    const rules = [rule({ country_code: "FR", show_real_name: false, priority: 5 })];
    expect(resolveVendorLabel(v, rules, { country: "FR" })).toBe(
      "Fournisseur ABC123"
    );
    // Pays non couvert par la règle → aucune règle matchante → fallback vendor-level
    expect(resolveVendorLabel(v, rules, { country: "BE" })).toBe(
      "Pharma Company SA"
    );
  });
});

describe("resolveVendorVisibility — bool brut", () => {
  it("retourne false par défaut", () => {
    expect(resolveVendorVisibility(vendor, [])).toBe(false);
  });
  it("retourne true si règle matchante autorise", () => {
    const rules = [rule({ country_code: "LU", show_real_name: true })];
    expect(
      resolveVendorVisibility(vendor, rules, { country: "LU" })
    ).toBe(true);
  });
});
