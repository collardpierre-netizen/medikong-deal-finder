import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Garde-fou : les surfaces admin doivent passer par le helper centralisé
// `vendor-onboarding-mode-labels` au lieu de redéfinir leurs propres libellés
// CREATE / ATTACH / Auto-inscription (sinon les traductions FR/NL/EN divergent).

const CONSUMERS = [
  "src/components/admin/VendorFormDialog.tsx",
  "src/pages/admin/AdminVendeurDetail.tsx",
  "src/pages/admin/AdminVendorOnboardingEmailsPage.tsx",
];

// Libellés FR concrets que l'on ne veut PAS voir hardcodés dans les
// composants admin — ils doivent venir du helper.
const FORBIDDEN_HARDCODED = [
  "Création admin",
  "Rattachement",
  "Auto-inscription",
];

describe("vendor onboarding mode labels — admin consumers", () => {
  for (const file of CONSUMERS) {
    it(`${file} imports the centralized labels helper`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src).toMatch(/vendor-onboarding-mode-labels/);
    });

    it(`${file} does not hardcode mode labels in plain JSX`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const label of FORBIDDEN_HARDCODED) {
        // Tolère la présence du libellé dans un commentaire, mais interdit
        // une occurrence dans une chaîne JSX/JS littérale.
        const inString = new RegExp(`["'\`]${label}["'\`]`).test(src);
        expect(
          inString,
          `${file} ne doit pas contenir le libellé "${label}" en dur — utilise getVendorOnboardingModeLabel().`,
        ).toBe(false);
      }
    });
  }
});
