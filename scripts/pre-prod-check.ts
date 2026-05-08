/**
 * Pre-prod check — usage : `bun run scripts/pre-prod-check.ts`
 *
 * Sortie : exit code 1 si une anomalie bloquante est détectée.
 * À exécuter manuellement avant chaque bascule prod (Lovable n'a pas de CI).
 *
 * Ne nécessite que `bun` + `glob` (déjà dans node_modules via vite).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const errors: string[] = [];
const warnings: string[] = [];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(p, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(p);
    }
  }
  return files;
}

// 1. Audit du code source
const codeFiles = walk("src");
const ALLOW_CONSOLE_LOG = /\/(__tests__|test|tests|admin\/[A-Z]\w+Audit|debug)/i;

for (const file of codeFiles) {
  const content = readFileSync(file, "utf8");

  // console.log : warning sauf dans pages admin de debug/audit
  if (/\bconsole\.log\b/.test(content) && !ALLOW_CONSOLE_LOG.test(file)) {
    warnings.push(`console.log dans ${file}`);
  }
  // debugger : bloquant
  if (/\bdebugger\b/.test(content)) errors.push(`debugger dans ${file}`);
  // lorem ipsum : bloquant
  if (/lorem ipsum/i.test(content)) errors.push(`lorem ipsum dans ${file}`);
  // TODO/FIXME : warning
  if (/\b(TODO|FIXME)\b/.test(content)) warnings.push(`TODO/FIXME dans ${file}`);
  // Liens internes vers dev
  if (/dev\.medikong\.pro/.test(content) && !file.endsWith("env.ts")) {
    warnings.push(`Lien vers dev.medikong.pro dans ${file}`);
  }
  // Stripe test key hardcodée
  if (/pk_test_[A-Za-z0-9]+/.test(content)) {
    errors.push(`Clé Stripe TEST hardcodée dans ${file}`);
  }
}

// Rapport
console.log("\n=== Pre-prod check ===\n");
console.log(`Fichiers scannés : ${codeFiles.length}`);

if (warnings.length) {
  console.log(`\n⚠️  WARNINGS (${warnings.length}) :`);
  warnings.slice(0, 50).forEach((w) => console.log("  -", w));
  if (warnings.length > 50) console.log(`  ...et ${warnings.length - 50} autres`);
}
if (errors.length) {
  console.log(`\n❌ ERRORS (${errors.length}) :`);
  errors.forEach((e) => console.log("  -", e));
  console.log("\nÉchec : corriger les erreurs avant la bascule prod.\n");
  process.exit(1);
}

console.log(
  errors.length === 0 && warnings.length === 0
    ? "\n✓ Aucun problème détecté.\n"
    : "\n✓ Pas d'erreur bloquante. Vérifier les warnings ci-dessus.\n",
);
console.log("👉 Compléter ensuite docs/PRE_PROD_CHECKLIST.md (audit DB + bascule).");
process.exit(0);
