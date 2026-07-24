#!/usr/bin/env bun
/**
 * Garde-fou CI : scanne le build produit (dist/) et échoue si une mention
 * publique de « Qogita » apparaît dans les surfaces exposées aux visiteurs
 * ou aux crawlers (HTML rendus, sitemap, robots, manifest, JSON-LD statique).
 *
 * Portée volontairement restreinte au HTML/XML/TXT/JSON car :
 *  - les bundles JS embarquent les libellés d'écrans admin internes
 *    (`/admin/qogita-*`, hooks React Query, etc.) qui ne sont accessibles
 *    qu'aux comptes admin authentifiés ;
 *  - la contrainte produit est « aucune mention publique », pas « aucun
 *    identifiant dans les sources ».
 *
 * Usage :
 *   bun run build && bun scripts/check-public-qogita.ts
 * Exit 1 si au moins une occurrence est trouvée.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "dist";
const FORBIDDEN = /qogita/i;
const EXTENSIONS = new Set([".html", ".htm", ".xml", ".txt", ".json", ".webmanifest"]);

if (!existsSync(ROOT)) {
  console.error(`❌ ${ROOT}/ introuvable. Lance 'bun run build' avant ce script.`);
  process.exit(2);
}

type Hit = { file: string; line: number; text: string };
const hits: Hit[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    const dot = name.lastIndexOf(".");
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
    if (!EXTENSIONS.has(ext)) continue;
    const content = readFileSync(full, "utf8");
    if (!FORBIDDEN.test(content)) continue;
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (FORBIDDEN.test(line)) {
        hits.push({
          file: relative(process.cwd(), full),
          line: i + 1,
          text: line.trim().slice(0, 240),
        });
      }
    });
  }
}

walk(ROOT);

if (hits.length === 0) {
  console.log("✅ Aucune mention publique de « Qogita » dans le build produit.");
  process.exit(0);
}

console.error(`❌ ${hits.length} mention(s) publique(s) de « Qogita » détectée(s) dans le build :\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  →  ${h.text}`);
}
console.error(
  "\nContexte : « Qogita » ne doit jamais apparaître dans les surfaces publiques " +
    "(HTML rendus, sitemap, robots, manifest, JSON-LD). Utiliser des libellés " +
    "génériques (« veille marché B2B », « grossistes B2B »).",
);
process.exit(1);
