#!/usr/bin/env bun
/**
 * MediKong — French typography linter
 *
 * Enforces basic FR typographic rules on user-facing copy:
 *   1. Use « » (chevrons) instead of straight " or 'smart' English quotes for quoted text.
 *   2. Use NBSP (\u00A0) before  ; : ! ? »  and after  «
 *   3. Use narrow NBSP (\u202F) is OK too (we accept both).
 *   4. No double spaces.
 *   5. Use … (U+2026) instead of "..."
 *   6. Use ’ (U+2019) for apostrophes inside words (l'usine -> l’usine)  [warning, not error]
 *
 * Scope:
 *   - src/i18n/locales/*.json (FR primary; NL/DE/EN scanned only for double-spaces / "..." / nbsp before « » when used)
 *   - Optional: hardcoded FR strings in src/components & src/pages (warnings only, until full i18n migration)
 *
 * Usage:
 *   bun scripts/check-fr-typography.ts            # check (CI mode)
 *   bun scripts/check-fr-typography.ts --fix      # autofix safe rules in i18n JSON files
 *   bun scripts/check-fr-typography.ts --warn-jsx # also scan JSX (warnings, never fails)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const LOCALES_DIR = "src/i18n/locales";
const NBSP = "\u00A0";
const NNBSP = "\u202F"; // narrow no-break space (also acceptable)

type Issue = {
  file: string;
  path: string;             // dotted JSON path
  rule: string;
  message: string;
  value: string;
  severity: "error" | "warn";
};

// ─── Rules on a single FR string ─────────────────────────────────────────────
function lintFrString(s: string): { rule: string; message: string; severity: "error" | "warn" }[] {
  const issues: { rule: string; message: string; severity: "error" | "warn" }[] = [];
  if (!s || typeof s !== "string") return issues;

  // 1. Straight double quotes used as quotation marks (heuristic: pair " ... ")
  if (/"[^"\n]+"/.test(s)) {
    issues.push({
      rule: "fr/chevrons",
      severity: "error",
      message: 'Utiliser les guillemets français « … » au lieu des guillemets droits "…".',
    });
  }
  // 2. English smart quotes “ ”
  if (/[“”]/.test(s)) {
    issues.push({
      rule: "fr/chevrons",
      severity: "error",
      message: "Utiliser « … » au lieu des guillemets anglais “ ”.",
    });
  }
  // 3. NBSP before ; : ! ? » (a regular space is wrong; missing space is also wrong)
  //    Allow both NBSP (\u00A0) and narrow NBSP (\u202F).
  const beforePunctRx = /(\S)([;:!?»])/g;
  let m: RegExpExecArray | null;
  while ((m = beforePunctRx.exec(s))) {
    const before = m[1];
    const punct = m[2];
    // OK if previous char is already an NBSP / narrow NBSP
    if (before === NBSP || before === NNBSP) continue;
    // Allow URLs / times like "12:34" / smileys ":)" / "http://"
    if (punct === ":" && /[0-9]/.test(before)) continue;
    if (punct === ":" && /[/A-Za-z]/.test(before) && /^[a-z]+:\/\//.test(s)) continue;
    issues.push({
      rule: "fr/nbsp-before",
      severity: "error",
      message: `Insérer une espace insécable avant « ${punct} » (trouvé: "${before}${punct}").`,
    });
    break; // one report per string is enough
  }
  // 4. NBSP after «  (opening chevron must be followed by NBSP)
  const afterChevronRx = /«([^\u00A0\u202F])/;
  if (afterChevronRx.test(s)) {
    issues.push({
      rule: "fr/nbsp-after",
      severity: "error",
      message: "Insérer une espace insécable après «.",
    });
  }
  // 5. Double spaces
  if (/  +/.test(s.replace(/\n/g, ""))) {
    issues.push({
      rule: "fr/double-space",
      severity: "error",
      message: "Espaces multiples consécutifs.",
    });
  }
  // 6. "..." instead of …
  if (/\.{3}/.test(s)) {
    issues.push({
      rule: "fr/ellipsis",
      severity: "error",
      message: 'Utiliser le caractère "…" (U+2026) au lieu de trois points "...".',
    });
  }
  // 7. Apostrophes droites entre lettres (warning)
  if (/\b[a-zàâäéèêëïîôöùûüÿç]'[a-zàâäéèêëïîôöùûüÿç]/i.test(s)) {
    issues.push({
      rule: "fr/apostrophe",
      severity: "warn",
      message: "Préférer l’apostrophe typographique ’ (U+2019) à l'apostrophe droite '.",
    });
  }
  return issues;
}

// ─── Safe autofixers (subset of rules) ───────────────────────────────────────
function autofixFr(s: string): string {
  if (typeof s !== "string") return s;
  let out = s;
  // … instead of ...
  out = out.replace(/\.{3}/g, "…");
  // collapse double spaces (preserve newlines)
  out = out.replace(/ {2,}/g, " ");
  // NBSP before ; : ! ? »  (not for URLs / times)
  out = out.replace(/(\S)([;!?»])/g, (full, b, p) => {
    if (b === NBSP || b === NNBSP) return full;
    return `${b}${NBSP}${p}`;
  });
  out = out.replace(/(\D)(:)/g, (full, b, p) => {
    if (b === NBSP || b === NNBSP) return full;
    if (/^[a-z]+:\/\//.test(out)) return full; // best-effort skip URLs
    return `${b}${NBSP}${p}`;
  });
  // NBSP after «
  out = out.replace(/«([^\u00A0\u202F])/g, `«${NBSP}$1`);
  // smart double quotes around runs → chevrons
  out = out.replace(/[“"]([^"”\n]+?)[”"]/g, (_full, inner) => `«${NBSP}${inner}${NBSP}»`);
  return out;
}

// ─── Walk JSON ───────────────────────────────────────────────────────────────
function walkJson(
  node: unknown,
  path: string,
  visit: (path: string, value: string) => void,
): void {
  if (typeof node === "string") visit(path, node);
  else if (Array.isArray(node)) node.forEach((v, i) => walkJson(v, `${path}[${i}]`, visit));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walkJson(v, path ? `${path}.${k}` : k, visit);
  }
}

function transformJson(node: unknown, fix: (s: string) => string): unknown {
  if (typeof node === "string") return fix(node);
  if (Array.isArray(node)) return node.map((v) => transformJson(v, fix));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = transformJson(v, fix);
    return out;
  }
  return node;
}

// ─── Run ─────────────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const FIX = args.has("--fix");
const WARN_JSX = args.has("--warn-jsx");

const issues: Issue[] = [];
const localePath = (lang: string) => join(ROOT, LOCALES_DIR, `${lang}.json`);

// FR is the source of truth for typography
// Universal autofix (safe across all locales): "..." → … and double spaces collapse
const autofixUniversal = (s: string) =>
  typeof s === "string" ? s.replace(/\.{3}/g, "…").replace(/ {2,}/g, " ") : s;

if (existsSync(localePath("fr"))) {
  const file = relative(ROOT, localePath("fr"));
  let json = JSON.parse(readFileSync(localePath("fr"), "utf8"));
  if (FIX) {
    json = transformJson(json, autofixFr);
    writeFileSync(localePath("fr"), JSON.stringify(json, null, 2) + "\n");
    console.log(`✓ Autofix applied to ${file}`);
  }
  walkJson(json, "", (path, value) => {
    for (const i of lintFrString(value)) {
      issues.push({ file, path, value, ...i });
    }
  });
}

// Other locales: only check rules that apply universally (double-space, "...")
for (const lang of ["nl", "de", "en"]) {
  if (!existsSync(localePath(lang))) continue;
  const file = relative(ROOT, localePath(lang));
  const json = JSON.parse(readFileSync(localePath(lang), "utf8"));
  walkJson(json, "", (path, value) => {
    if (typeof value !== "string") return;
    if (/  +/.test(value.replace(/\n/g, ""))) {
      issues.push({
        file, path, value,
        rule: "fr/double-space",
        severity: "error",
        message: "Espaces multiples consécutifs.",
      });
    }
    if (/\.{3}/.test(value)) {
      issues.push({
        file, path, value,
        rule: "fr/ellipsis",
        severity: "error",
        message: 'Utiliser "…" au lieu de "...".',
      });
    }
  });
}

// Optional: scan JSX files for FR strings (warning-only)
if (WARN_JSX) {
  function walkDir(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walkDir(full, out);
      else if (/\.(tsx|jsx)$/.test(entry)) out.push(full);
    }
    return out;
  }
  const files = [...walkDir(join(ROOT, "src/components")), ...walkDir(join(ROOT, "src/pages"))];
  const jsxText = />([^<>{}\n]{4,})</g;
  for (const f of files) {
    if (/\/admin\//.test(f)) continue;
    const src = readFileSync(f, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      let m: RegExpExecArray | null;
      jsxText.lastIndex = 0;
      while ((m = jsxText.exec(line))) {
        const text = m[1].trim();
        if (!/[àâäéèêëïîôöùûüÿç]/i.test(text) && !/\b(le|la|les|un|une|des)\b/i.test(text)) continue;
        for (const i2 of lintFrString(text)) {
          issues.push({
            file: relative(ROOT, f),
            path: `L${i + 1}`,
            value: text,
            ...i2,
            severity: "warn",
          });
        }
      }
    });
  }
}

const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");

if (issues.length === 0) {
  console.log("✓ Typographie FR conforme.");
  process.exit(0);
}

const groupBy = <T,>(arr: T[], key: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
};

console.error(`\n${errors.length} erreur(s), ${warns.length} avertissement(s)\n`);
for (const [file, list] of groupBy(issues, (i) => i.file)) {
  console.error(`── ${file}`);
  for (const it of list.slice(0, 50)) {
    const sev = it.severity === "error" ? "ERR " : "warn";
    console.error(`  [${sev}] ${it.rule}  @ ${it.path}`);
    console.error(`         ${it.message}`);
    console.error(`         valeur: ${JSON.stringify(it.value).slice(0, 160)}`);
  }
  if (list.length > 50) console.error(`  … ${list.length - 50} autre(s) masqué(s)`);
}
console.error(`
Astuce : la majorité des règles sont auto-corrigeables :
    bun scripts/check-fr-typography.ts --fix
puis vérifier le diff avant commit.
`);

process.exit(errors.length > 0 ? 1 : 0);
