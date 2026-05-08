#!/usr/bin/env bun
/**
 * MediKong — Hardcoded FR copy guard
 *
 * Scans src/components and src/pages for user-facing French strings that
 * bypass the i18n layer (src/i18n/locales/*.json). Maintains a baseline
 * (scripts/i18n-baseline.json) of pre-existing violations; CI fails when
 * a NEW hardcoded FR string appears.
 *
 * Usage:
 *   bun scripts/check-i18n-strings.ts            # check (CI mode, exits 1 on new violations)
 *   bun scripts/check-i18n-strings.ts --update   # refresh baseline (use sparingly, with review)
 *   bun scripts/check-i18n-strings.ts --list     # list all current violations
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/components", "src/pages"];
const BASELINE_PATH = "scripts/i18n-baseline.json";

// Folders/files we don't enforce (admin tools, generated, tests, CMS-rich-text)
const IGNORED_PATH_RX = [
  /\/admin\//i,                       // admin back-office (internal staff)
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /\/__tests__\//,
  /\/ui\/(toast|sonner|chart|sidebar|carousel|calendar)\.tsx$/, // shadcn primitives
];

// Heuristic: a French user-facing string contains at least one accented
// FR character OR a high-signal French stopword/connector, AND is at least
// 3 chars long, AND is not a className / import / URL / id-like token.
const FR_ACCENTS_RX = /[àâäéèêëïîôöùûüÿçœÀÂÄÉÈÊËÏÎÔÖÙÛÜŸÇŒ]/;
const FR_WORDS_RX =
  /\b(le|la|les|un|une|des|du|de|au|aux|et|ou|où|mais|donc|car|ni|or|votre|vos|notre|nos|votre|cette|ces|cet|qui|que|quoi|dont|avec|sans|pour|par|sur|sous|dans|chez|vers|déjà|aussi|encore|toujours|jamais|merci|bonjour|bienvenue|connexion|inscription|panier|commande|livraison|paiement|prix|stock|rupture|disponible|fournisseur|acheteur|vendeur|produit|catégorie|marque|fabricant|recherche|filtrer|trier|ajouter|supprimer|modifier|enregistrer|annuler|valider|continuer|retour|suivant|précédent|chargement)\b/i;

const STRING_LITERAL_RX = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g;
const JSX_TEXT_RX = />([^<>{}\n]{3,})</g;

type Violation = { file: string; line: number; text: string };

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry)) out.push(full);
  }
  return out;
}

function isLikelyFrUserCopy(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > 400) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(t)) return false;             // needs letters
  if (/^[A-Z0-9_./@-]+$/.test(t)) return false;          // CONST_NAME / paths
  if (/^https?:\/\//.test(t) || /^mailto:/.test(t)) return false;
  if (/^[a-z]+(-[a-z0-9]+)+$/.test(t)) return false;     // kebab tokens
  if (/^[a-zA-Z]+([A-Z][a-zA-Z]*)+$/.test(t)) return false; // camelCase identifier
  if (/^\$?\{[^}]+\}$/.test(t)) return false;            // template-only
  // Tailwind-ish classes (space separated tokens with - or :)
  if (/^[\w:\-/[\]%.]+(\s+[\w:\-/[\]%.]+){2,}$/.test(t) && !FR_ACCENTS_RX.test(t)) return false;
  return FR_ACCENTS_RX.test(t) || FR_WORDS_RX.test(t);
}

function shouldIgnoreLine(line: string): boolean {
  // Skip imports, console.*, URL/path strings, t("..."), i18n keys
  if (/^\s*(import|export)\s/.test(line)) return true;
  if (/console\.(log|warn|error|info|debug)/.test(line)) return true;
  if (/\bt\s*\(\s*["'`]/.test(line)) return true;          // t("key")
  if (/\buseTranslation\b/.test(line)) return true;
  if (/\b(href|src|to|className|id|key|name|type|role|d|fill|stroke|viewBox|xmlns)\s*=\s*["'`]/.test(line)) {
    // these attribute strings shouldn't usually be FR copy; if accent appears we still catch via attr scan below
  }
  return false;
}

function scanFile(file: string): Violation[] {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (IGNORED_PATH_RX.some((rx) => rx.test(rel))) return [];
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const out: Violation[] = [];

  lines.forEach((line, i) => {
    if (shouldIgnoreLine(line)) return;
    // 1) JSX text nodes  >  …  <
    let m: RegExpExecArray | null;
    JSX_TEXT_RX.lastIndex = 0;
    while ((m = JSX_TEXT_RX.exec(line))) {
      const text = m[1].trim();
      if (isLikelyFrUserCopy(text)) out.push({ file: rel, line: i + 1, text });
    }
    // 2) String literals on user-facing attributes
    const attrMatch = line.match(
      /\b(title|placeholder|alt|aria-label|aria-description|label|tooltip)\s*=\s*(["'`])([^"'`]+)\2/,
    );
    if (attrMatch && isLikelyFrUserCopy(attrMatch[3])) {
      out.push({ file: rel, line: i + 1, text: attrMatch[3] });
    }
  });

  return out;
}

function loadBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { keys: string[] };
    return new Set(raw.keys ?? []);
  } catch {
    return new Set();
  }
}

function key(v: Violation): string {
  // Stable across line shifts: file + normalized text only
  return `${v.file}::${v.text.replace(/\s+/g, " ").trim()}`;
}

const args = new Set(process.argv.slice(2));
const allFiles = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const violations: Violation[] = allFiles.flatMap(scanFile);
const currentKeys = new Set(violations.map(key));

if (args.has("--update")) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ keys: [...currentKeys].sort(), updatedAt: new Date().toISOString() }, null, 2) + "\n",
  );
  console.log(`✓ Baseline updated with ${currentKeys.size} known violations.`);
  process.exit(0);
}

if (args.has("--list")) {
  for (const v of violations) console.log(`${v.file}:${v.line}  →  ${v.text}`);
  console.log(`\nTotal: ${violations.length}`);
  process.exit(0);
}

const baseline = loadBaseline();
const newOnes = violations.filter((v) => !baseline.has(key(v)));

if (newOnes.length === 0) {
  console.log(`✓ No new hardcoded FR copy. (${violations.length} pre-existing, baselined.)`);
  process.exit(0);
}

console.error(`✗ ${newOnes.length} new hardcoded French string(s) detected outside i18n:\n`);
for (const v of newOnes) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`     "${v.text}"`);
}
console.error(`
Fix by moving the copy to src/i18n/locales/fr.json and using:
    const { t } = useTranslation();
    <span>{t("section.key")}</span>

If the string is intentional (proper noun, brand, internal admin UI),
add the file path to IGNORED_PATH_RX or refactor to use t(). Only as a
last resort, refresh the baseline:
    bun scripts/check-i18n-strings.ts --update
`);
process.exit(1);
