#!/usr/bin/env bun
/**
 * Garde-fou build/deploy : interdit toute occurrence d'emails legacy
 * (ex. pit@medikong.pro) dans le code source avant publication.
 *
 * Usage : bun scripts/check-legacy-emails.ts
 * Exit code 1 si une occurrence est trouvée.
 */
import { spawnSync } from "node:child_process";

const FORBIDDEN_EMAILS = ["pit@medikong.pro"];

// Dossiers / fichiers exclus du scan
const EXCLUDES = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vercel",
  ".lovable",
  "coverage",
  "playwright-report",
  "test-results",
  "bun.lockb",
  "package-lock.json",
  "scripts/check-legacy-emails.ts", // ce fichier mentionne l'email à des fins de doc
];

let hasError = false;

for (const email of FORBIDDEN_EMAILS) {
  const args = [
    "--hidden",
    "--no-messages",
    "-n",
    "-F",
    email,
    ".",
  ];
  for (const ex of EXCLUDES) {
    args.push("-g", `!${ex}`);
  }

  const result = spawnSync("rg", args, { encoding: "utf8" });

  if (result.error) {
    console.error(`❌ Impossible d'exécuter ripgrep : ${result.error.message}`);
    process.exit(2);
  }

  // rg : 0 = match trouvé, 1 = aucun match, >=2 = erreur
  if (result.status === 0) {
    hasError = true;
    console.error(
      `\n❌ Email legacy interdit détecté : "${email}"\n` +
        `Occurrences trouvées :\n${result.stdout}`,
    );
  } else if (result.status === 1) {
    console.log(`✅ Aucune occurrence de "${email}"`);
  } else {
    console.error(
      `❌ ripgrep a échoué (exit ${result.status}) : ${result.stderr}`,
    );
    process.exit(2);
  }
}

if (hasError) {
  console.error(
    "\n🚫 Build bloqué : remplacez toutes les occurrences par l'email courant " +
      "(voir src/config/audit.ts → AUDIT_NOTIFICATION_EMAIL).",
  );
  process.exit(1);
}

console.log("\n✅ Aucun email legacy trouvé. OK pour publier.");
