import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Smoke a11y tests — vérifie qu'aucune violation WCAG 2.1 niveau A ou AA
 * n'est introduite sur les pages publiques clés.
 *
 * Tags axe utilisés : wcag2a, wcag2aa, wcag21a, wcag21aa.
 *
 * Joué sur deux viewports via les projects Playwright (cf. playwright.config.ts) :
 *   - desktop-1280 (1280×800)
 *   - mobile-390   (Pixel 5, ≈ 393×851)
 * Toute nouvelle violation sur l'un des deux fait échouer la CI.
 *
 * Pour limiter le bruit pendant qu'on rattrape la dette, on tolère
 * temporairement quelques règles via `disableRules` ci-dessous. Chaque
 * entrée doit pointer vers un ticket de remédiation et être levée
 * dès que la dette est purgée.
 */

const KEY_PUBLIC_PAGES = [
  { name: "Accueil", path: "/" },
  { name: "Catalogue", path: "/catalogue" },
  { name: "Marques", path: "/marques" },
  { name: "Catégories", path: "/categories" },
  { name: "Promotions", path: "/promotions" },
  { name: "Connexion", path: "/connexion" },
];

// Règles temporairement désactivées (à vider au fur et à mesure).
// Chaque entrée DOIT pointer vers un ticket de remédiation. Une fois la
// dette purgée, l'entrée doit être retirée — sinon le job CI échoue
// (cf. test "garde-fou TEMPORARILY_DISABLED_RULES" plus bas).
type DisabledRule = {
  /** Identifiant axe-core (ex: "color-contrast") */
  rule: string;
  /** Ticket de suivi (ex: "A11Y-12") — obligatoire */
  ticket: string;
  /** Contexte/raison courte */
  reason?: string;
};

const TEMPORARILY_DISABLED_RULES: DisabledRule[] = [
  // ex: { rule: "color-contrast", ticket: "A11Y-12", reason: "dette CMS hero" },
];

const DISABLED_RULE_IDS = TEMPORARILY_DISABLED_RULES.map((r) => r.rule);

// Identifiants d'archivage (PR / commit / horodatage). Resté inertes en local.
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-"); // 2026-05-08T09-12-33-000Z
const COMMIT_SHA = (process.env.GITHUB_SHA || "local").slice(0, 7);
const PR_NUMBER =
  process.env.GITHUB_EVENT_NAME === "pull_request"
    ? (process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//)?.[1] ?? "PR")
    : null;
const RUN_TAG = PR_NUMBER ? `pr-${PR_NUMBER}-${COMMIT_SHA}` : `main-${COMMIT_SHA}`;
const SNAPSHOTS_DIR = join(process.cwd(), "a11y-snapshots", `${RUN_TS}__${RUN_TAG}`);

function safeSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "root"
  );
}

for (const { name, path } of KEY_PUBLIC_PAGES) {
  test.describe(`A11y ${name} (${path})`, () => {
    test("aucune violation WCAG A/AA", async ({ page }, testInfo) => {
      await page.goto(path, { waitUntil: "networkidle" });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(DISABLED_RULE_IDS)
        // Ignore les iframes tierces (recaptcha, stripe, gtm, etc.)
        .exclude("iframe")
        .analyze();

      const vp = page.viewportSize();
      const projectName = testInfo.project.name;

      // Snapshot JSON : 1 fichier par (page × viewport), toujours écrit (pass ou fail).
      // Permet de comparer l'évolution des violations dans le temps.
      const snapshot = {
        meta: {
          run_ts: RUN_TS,
          commit_sha: process.env.GITHUB_SHA || "local",
          pr_number: PR_NUMBER,
          run_tag: RUN_TAG,
          ci: process.env.CI === "true",
          github_run_id: process.env.GITHUB_RUN_ID || null,
          page_name: name,
          page_path: path,
          project: projectName,
          viewport: vp,
          base_url: process.env.PLAYWRIGHT_BASE_URL || null,
          axe_tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          disabled_rules: TEMPORARILY_DISABLED_RULES,
        },
        counts: {
          violations: results.violations.length,
          passes: results.passes.length,
          incomplete: results.incomplete.length,
          inapplicable: results.inapplicable.length,
          total_violation_nodes: results.violations.reduce(
            (sum, v) => sum + v.nodes.length,
            0,
          ),
        },
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          tags: v.tags,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            html: n.html,
            failureSummary: n.failureSummary,
          })),
        })),
      };

      try {
        mkdirSync(SNAPSHOTS_DIR, { recursive: true });
        const filename = `${safeSlug(projectName)}__${safeSlug(path)}__${RUN_TS}__${RUN_TAG}.json`;
        const fullPath = join(SNAPSHOTS_DIR, filename);
        writeFileSync(fullPath, JSON.stringify(snapshot, null, 2), "utf-8");
        await testInfo.attach(`a11y-snapshot-${projectName}`, {
          path: fullPath,
          contentType: "application/json",
        });
      } catch (err) {
        console.warn(`[a11y] échec d'écriture snapshot: ${(err as Error).message}`);
      }

      // Rapport lisible en cas d'échec
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        firstTarget: v.nodes[0]?.target,
      }));

      const ctx = `[${projectName} ${vp?.width}×${vp?.height}] ${path}`;
      expect(
        results.violations,
        `Violations a11y détectées sur ${ctx}:\n${JSON.stringify(summary, null, 2)}`,
      ).toEqual([]);
    });
  });
}
