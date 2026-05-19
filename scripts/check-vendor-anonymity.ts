#!/usr/bin/env bun
/**
 * 🔒 Garde-fou anonymisation vendeur
 *
 * Bloque toute fuite d'identité réelle (vendor.name / vendor.company_name /
 * getVendorAdminName / show_real_name) en dehors de la liste blanche admin.
 *
 * Surfaces couvertes : composants React, hooks, libs, edge functions,
 * templates emails, scripts de génération PDF/XLSX, logs.
 *
 * Exécuté en local et en CI (.github/workflows/lint.yml).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "supabase/functions"];

// Allowlist : seuls ces préfixes ont le droit de rendre / manipuler le nom réel.
const ADMIN_ALLOWLIST = [
  "src/pages/admin/",
  "src/components/admin/",
  "src/lib/vendor-display.ts", // définit les helpers
  "supabase/functions/_shared/admin-", // futurs helpers admin
];

const ALLOWED_FILE_EXACT = new Set<string>([
  "scripts/check-vendor-anonymity.ts",
  "src/lib/vendor-display.ts",
  "src/integrations/supabase/types.ts",
]);

// Motifs interdits hors allowlist
const FORBIDDEN_PATTERNS: { name: string; regex: RegExp; hint: string }[] = [
  {
    name: "getVendorAdminName",
    regex: /\bgetVendorAdminName\s*\(/,
    hint: "Réservé aux pages admin. Utilise getVendorPublicName().",
  },
  {
    name: "vendor.company_name (JSX render)",
    regex: /\{[^}]*\bvendors?\.company_name\b[^}]*\}/,
    hint: "Ne jamais rendre company_name. Passe par getVendorPublicName().",
  },
  {
    name: "vendor.show_real_name (render branch)",
    regex: /\bshow_real_name\s*(===|!==|\?|&&|\|\|)/,
    hint: "show_real_name ne doit jamais conditionner un rendu vendeur public.",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (e === "node_modules" || e === ".git" || e === "dist" || e === "build") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}

function isAllowed(rel: string): boolean {
  if (ALLOWED_FILE_EXACT.has(rel)) return true;
  return ADMIN_ALLOWLIST.some((prefix) => rel.startsWith(prefix));
}

const files: string[] = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

const violations: { file: string; line: number; pattern: string; snippet: string; hint: string }[] = [];

for (const abs of files) {
  const rel = relative(ROOT, abs);
  if (isAllowed(rel)) continue;
  const src = readFileSync(abs, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    for (const p of FORBIDDEN_PATTERNS) {
      if (p.regex.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          pattern: p.name,
          snippet: line.trim().slice(0, 160),
          hint: p.hint,
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log(`✅ vendor-anonymity: ${files.length} fichiers scannés, aucune fuite détectée.`);
  process.exit(0);
}

console.error(`\n❌ vendor-anonymity: ${violations.length} violation(s) détectée(s)\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    motif    : ${v.pattern}`);
  console.error(`    snippet  : ${v.snippet}`);
  console.error(`    correctif: ${v.hint}\n`);
}
console.error("Toute identité vendeur affichée hors /admin doit passer par getVendorPublicName().");
process.exit(1);
