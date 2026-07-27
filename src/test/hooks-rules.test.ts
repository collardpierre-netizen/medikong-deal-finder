// @vitest-environment node
import { describe, it, expect } from "vitest";

import { ESLint } from "eslint";
import path from "node:path";

/**
 * Garde-fou anti-régression : bloque tout hook conditionnel dans src/.
 *
 * Historique : ProductPage.tsx a livré en prod des appels `useLocalizedProductField`
 * APRÈS des early returns (React error #310). La règle `react-hooks/rules-of-hooks`
 * est bien active en "error" dans eslint.config.js, mais `bun run lint` remonte
 * beaucoup de bruit non-hook et n'était pas gating de fait.
 *
 * Ce test exécute ESLint programmatiquement sur tout `src/` avec UNIQUEMENT les
 * règles hooks activées. Toute violation fait échouer la suite de tests.
 */
describe("react-hooks rules — no conditional hooks in src/", () => {
  it("src/**/*.{ts,tsx} passe react-hooks/rules-of-hooks", async () => {
    const eslint = new ESLint({
      cwd: path.resolve(__dirname, "../.."),
      // On charge la config projet (plugins déjà déclarés), puis on override
      // pour ne garder que la règle hooks et neutraliser le reste.
      overrideConfig: [
        {
          rules: {
            "react-hooks/rules-of-hooks": "error",
            // Toutes les autres règles projet passent en "off" pour ce run :
            // on ne veut PAS que le bruit existant fasse échouer le test.
            // (les règles non listées ici restent héritées de la config, mais
            //  ESLint applique la dernière valeur — on éteint les principales)
            "react-hooks/exhaustive-deps": "off",
            "jsx-a11y/control-has-associated-label": "off",
            "jsx-a11y/anchor-has-content": "off",
            "react/jsx-no-undef": "off",
            "react/jsx-no-duplicate-props": "off",
            "react/jsx-key": "off",
            "react/jsx-no-target-blank": "off",
            "react/no-children-prop": "off",
            "react/no-direct-mutation-state": "off",
            "react/jsx-uses-vars": "off",
            "no-restricted-syntax": "off",
            "no-fallthrough": "off",
            "no-empty": "off",
            "no-useless-escape": "off",
            "no-case-declarations": "off",
            "no-prototype-builtins": "off",
            "prefer-const": "off",
            "no-var": "off",
            "no-undef": "off",
            "no-redeclare": "off",
            "no-constant-condition": "off",
            "no-cond-assign": "off",
            "no-async-promise-executor": "off",
            "no-self-assign": "off",
            "no-unsafe-optional-chaining": "off",
            "no-misleading-character-class": "off",
            "no-control-regex": "off",
            "no-useless-catch": "off",
            "getter-return": "off",
            "valid-typeof": "off",
          },
        },
      ],
    });

    const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);

    // Baseline : fichiers avec des violations pré-existantes au moment de
    // l'activation de ce garde-fou. NE PAS ÉTENDRE. Un nouveau fichier qui
    // apparaît ici doit être corrigé avant merge — c'est tout l'intérêt.
    // Signalées à l'équipe pour correction séparée :
    //   - src/components/product/ProductPriceHistory.tsx
    //   - src/pages/MyPriceAlertsPage.tsx
    //   - src/pages/OrderPaymentConfirmationPage.tsx
    const BASELINE_FILES = new Set<string>([
      "src/components/product/ProductPriceHistory.tsx",
      "src/pages/MyPriceAlertsPage.tsx",
      "src/pages/OrderPaymentConfirmationPage.tsx",
    ]);

    const hookViolations = results
      .flatMap((r) =>
        r.messages
          .filter((m) => (m.ruleId ?? "").startsWith("react-hooks/"))
          .map((m) => ({
            file: path.relative(process.cwd(), r.filePath).replace(/\\/g, "/"),
            line: m.line,
            column: m.column,
            rule: m.ruleId,
            message: m.message,
          })),
      )
      .filter((v) => !BASELINE_FILES.has(v.file));

    expect(
      hookViolations,
      hookViolations.length
        ? `Hook conditionnel détecté (${hookViolations.length}). ` +
            `Corrigez les appels de hooks pour qu'ils soient TOUJOURS invoqués ` +
            `dans le même ordre, avant tout early return :\n` +
            hookViolations
              .map(
                (v) =>
                  `  - ${v.file}:${v.line}:${v.column} [${v.rule}] ${v.message}`,
              )
              .join("\n")
        : "",
    ).toEqual([]);
  }, 60_000);
});

