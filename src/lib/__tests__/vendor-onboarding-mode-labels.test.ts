import { describe, it, expect } from "vitest";
import {
  VENDOR_ONBOARDING_MODE_META,
  getVendorOnboardingModeLabel,
  getVendorOnboardingModeBadgeColors,
  type VendorOnboardingMode,
  type VendorOnboardingLocale,
} from "@/lib/vendor-onboarding-mode-labels";

const MODES: VendorOnboardingMode[] = ["create", "attach", "self_register"];
const LOCALES: VendorOnboardingLocale[] = ["fr", "nl", "en"];

const EXPECTED_LABELS: Record<VendorOnboardingMode, Record<VendorOnboardingLocale, string>> = {
  create: {
    fr: "Création admin",
    nl: "Admin-aanmaak",
    en: "Admin create",
  },
  attach: {
    fr: "Rattachement",
    nl: "Koppeling",
    en: "Attach",
  },
  self_register: {
    fr: "Auto-inscription",
    nl: "Zelfregistratie",
    en: "Self-registration",
  },
};

describe("vendor onboarding mode labels", () => {
  it("exports metadata for the 3 supported modes", () => {
    expect(Object.keys(VENDOR_ONBOARDING_MODE_META).sort()).toEqual(
      [...MODES].sort(),
    );
  });

  for (const mode of MODES) {
    for (const locale of LOCALES) {
      it(`returns the expected label for ${mode} / ${locale}`, () => {
        expect(getVendorOnboardingModeLabel(mode, locale)).toBe(
          EXPECTED_LABELS[mode][locale],
        );
      });
    }
  }

  it("uses FR as default locale", () => {
    for (const mode of MODES) {
      expect(getVendorOnboardingModeLabel(mode)).toBe(EXPECTED_LABELS[mode].fr);
    }
  });

  it("returns an em dash for nullish modes", () => {
    expect(getVendorOnboardingModeLabel(null)).toBe("—");
    expect(getVendorOnboardingModeLabel(undefined)).toBe("—");
    expect(getVendorOnboardingModeLabel("")).toBe("—");
  });

  it("falls back to the raw value for unknown modes", () => {
    expect(getVendorOnboardingModeLabel("unknown_mode")).toBe("unknown_mode");
  });

  it("provides non-empty descriptions in every locale", () => {
    for (const mode of MODES) {
      for (const locale of LOCALES) {
        const desc = VENDOR_ONBOARDING_MODE_META[mode].description[locale];
        expect(desc.length).toBeGreaterThan(20);
      }
    }
  });

  it("assigns a distinct badge palette to each mode", () => {
    const palettes = MODES.map((m) => getVendorOnboardingModeBadgeColors(m));
    const uniqueBg = new Set(palettes.map((p) => p.bg));
    expect(uniqueBg.size).toBe(MODES.length);
    for (const p of palettes) {
      expect(p.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("returns a neutral fallback palette for unknown/nullish modes", () => {
    const fallback = { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" };
    expect(getVendorOnboardingModeBadgeColors(null)).toEqual(fallback);
    expect(getVendorOnboardingModeBadgeColors(undefined)).toEqual(fallback);
    expect(getVendorOnboardingModeBadgeColors("nope")).toEqual(fallback);
  });
});
