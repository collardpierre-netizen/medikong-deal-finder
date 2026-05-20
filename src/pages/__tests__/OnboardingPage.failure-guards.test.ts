import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Garde-fou statique : vérifie que `handleSubmit` dans OnboardingPage.tsx
 * ne peut JAMAIS atteindre l'écran "Inscription réussie" (déclenché par
 * `goNext()` dans la dernière étape) si l'une des branches d'insertion
 * (vendor / customer / restock_buyers) a échoué.
 *
 * Règles vérifiées :
 *  1) Chaque message `toast.error` bloquant DOIT être suivi (dans la même
 *     branche) d'un `return;` avant le `goNext()` final.
 *  2) Le seul `goNext()` dans `handleSubmit` se trouve APRÈS toutes les
 *     branches d'erreur.
 *  3) Chaque branche d'erreur appelle `setSubmitting(false)` avant le return.
 *  4) Aucune branche d'erreur ne se contente d'un `console.warn` sans toast
 *     bloquant (regression guard : on avait eu des "Inscription réussie" qui
 *     mentaient à cause de console.warn silencieux).
 */
const SOURCE = readFileSync(
  resolve(__dirname, "../OnboardingPage.tsx"),
  "utf8",
);

function extractHandleSubmit(): string {
  const start = SOURCE.indexOf("const handleSubmit = async () => {");
  expect(start, "handleSubmit must exist").toBeGreaterThan(-1);
  // Borne basse fiable : commentaire de section suivant.
  const end = SOURCE.indexOf("/* ─── Email Confirmation Screen", start);
  expect(end, "end marker must exist").toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

const HANDLE = extractHandleSubmit();

const BLOCKING_TOASTS = [
  "Création du compte vendeur impossible",
  "Création du compte acheteur impossible",
  "Inscription ReStock impossible",
];

describe("OnboardingPage — failure guards (jamais 'Inscription réussie' en cas d'erreur)", () => {
  it("contient bien handleSubmit et un seul goNext() final", () => {
    const goNextMatches = HANDLE.match(/goNext\(\)/g) || [];
    expect(goNextMatches.length).toBe(1);
  });

  it.each(BLOCKING_TOASTS)(
    "branche d'erreur « %s » : toast.error -> setSubmitting(false) -> return AVANT goNext()",
    (label) => {
      const idx = HANDLE.indexOf(label);
      expect(idx, `toast.error("${label}") doit exister`).toBeGreaterThan(-1);

      // Fenêtre de ~600 chars après le toast pour couvrir setSubmitting+return
      const window = HANDLE.slice(idx, idx + 800);

      expect(
        window,
        "doit appeler setSubmitting(false) après le toast d'erreur",
      ).toMatch(/setSubmitting\(false\)/);

      expect(
        window,
        "doit return immédiatement après pour bloquer la suite",
      ).toMatch(/return\s*;/);

      // Le return doit précéder le goNext() final
      const returnPos = idx + window.search(/return\s*;/);
      const goNextPos = HANDLE.indexOf("goNext()");
      expect(returnPos).toBeLessThan(goNextPos);
    },
  );

  it("aucune branche d'erreur bloquante ne se contente d'un console.warn silencieux", () => {
    // On autorise console.warn pour des updates non-critiques (ex: profiles)
    // mais PAS pour les inserts vendor/customer/restock qui ouvrent l'écran de succès.
    const forbiddenPatterns = [
      /console\.warn\([^)]*[Vv]endor[^)]*\)\s*;?\s*(?!.*toast\.error)/s,
      /console\.warn\([^)]*[Cc]ustomer[^)]*\)\s*;?\s*(?!.*toast\.error)/s,
      /console\.warn\([^)]*[Rr]e[Ss]tock[^)]*\)\s*;?\s*(?!.*toast\.error)/s,
    ];
    for (const re of forbiddenPatterns) {
      expect(HANDLE).not.toMatch(re);
    }
  });

  it("le catch global affiche un toast d'erreur (pas de silencieux)", () => {
    expect(HANDLE).toMatch(/catch\s*\(/);
    expect(HANDLE).toMatch(/toast\.error\(\s*["']Erreur lors de l'inscription/);
  });

  it("le catch global ne contient PAS de goNext() (sinon écran de succès trompeur)", () => {
    const catchIdx = HANDLE.indexOf("catch");
    const finallyIdx = HANDLE.indexOf("finally", catchIdx);
    const catchBlock = HANDLE.slice(catchIdx, finallyIdx > -1 ? finallyIdx : HANDLE.length);
    expect(catchBlock).not.toMatch(/goNext\(\)/);
  });
});
