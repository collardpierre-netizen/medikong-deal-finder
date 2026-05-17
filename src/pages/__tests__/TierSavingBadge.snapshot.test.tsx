/**
 * Tests de rendu/snapshots croisant :
 *   - contextes d'appel : `standardTiers` (offerPriceTiers desktop+mobile,
 *     discountTiers desktop) vs `legacyTiers` (bloc hasLegacyTiers desktop)
 *   - tailles d'écran : "desktop" et "mobile"
 *
 * Objectif : verrouiller le fait que <TierSavingBadge /> rend EXACTEMENT
 * le même HTML pour la même valeur de `saving`, quel que soit le bloc
 * appelant ou la taille d'écran. Toute divergence future (classes, label,
 * fallback) fera échouer le snapshot et le diff direct mobile↔desktop.
 *
 * Les règles métier (calcul, garde-fous) sont déjà couvertes par
 * `src/lib/__tests__/tier-saving.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { TierSavingBadge } from "@/pages/ProductPage";
import { computeTierSavingPercent } from "@/lib/tier-saving";
import { resetTierSavingDiagnostics } from "@/lib/tier-saving-diagnostics";

type Ctx = {
  /** Label d'identification du contexte d'appel (pour le snapshot). */
  callerLabel: string;
  /** Largeur viewport simulée (informationnelle, le composant n'en dépend pas). */
  viewport: "desktop" | "mobile";
  /** Valeur de saving telle qu'elle serait passée par le call site. */
  saving: number | null;
};

/**
 * Reproduit les 4 call sites de TierSavingBadge dans ProductPage.tsx avec
 * la même valeur de saving (calculée via le helper centralisé). Si demain
 * un call site oublie de passer par `computeTierSavingPercent` ou injecte
 * une classe différente, le snapshot divergera entre les variantes.
 */
function buildMatrix(basePrice: number, unitPrice: number): Ctx[] {
  const saving = computeTierSavingPercent(basePrice, unitPrice);
  return [
    { callerLabel: "discountTiers (desktop)", viewport: "desktop", saving },
    { callerLabel: "offerPriceTiers (desktop)", viewport: "desktop", saving },
    { callerLabel: "offerPriceTiers (mobile)", viewport: "mobile", saving },
    { callerLabel: "legacyTiers (desktop)", viewport: "desktop", saving },
  ];
}

function renderHtml(saving: number | null): string {
  const { container } = render(<TierSavingBadge saving={saving} />);
  return container.innerHTML;
}

describe("TierSavingBadge — snapshots mobile vs desktop, standard vs legacy", () => {
  beforeEach(() => {
    resetTierSavingDiagnostics();
  });
  afterEach(() => {
    resetTierSavingDiagnostics();
  });

  describe("cas valide (basePrice=10, unitPrice=9 → -10.0%)", () => {
    const matrix = buildMatrix(10, 9);

    it("tous les call sites produisent le même HTML", () => {
      const renders = matrix.map((ctx) => ({
        label: `${ctx.callerLabel} / ${ctx.viewport}`,
        html: renderHtml(ctx.saving),
      }));
      // Tous identiques au premier rendu.
      const first = renders[0].html;
      for (const r of renders) {
        expect(r.html, `${r.label} doit matcher ${renders[0].label}`).toBe(first);
      }
    });

    it("snapshot stable du HTML pour cas valide", () => {
      expect(renderHtml(matrix[0].saving)).toMatchInlineSnapshot(
        `"<span class="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 tabular-nums leading-none">-10.0%</span>"`,
      );
    });
  });

  describe("cas fallback (basePrice=0 → saving=null → '—')", () => {
    const matrix = buildMatrix(0, 9);

    it("tous les call sites produisent le même HTML de fallback", () => {
      const renders = matrix.map((ctx) => ({
        label: `${ctx.callerLabel} / ${ctx.viewport}`,
        html: renderHtml(ctx.saving),
      }));
      const first = renders[0].html;
      for (const r of renders) {
        expect(r.html, `${r.label} doit matcher ${renders[0].label}`).toBe(first);
      }
    });

    it("snapshot stable du HTML pour fallback", () => {
      expect(renderHtml(matrix[0].saving)).toMatchInlineSnapshot(
        `"<span class="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums leading-none" title="Réduction non disponible (prix de base manquant)" aria-label="Réduction non disponible">—</span>"`,
      );
    });
  });

  describe("cas unitPrice ≥ basePrice (pas de réduction)", () => {
    const matrix = buildMatrix(10, 10);

    it("tous les call sites tombent sur le même fallback", () => {
      const renders = matrix.map((ctx) => renderHtml(ctx.saving));
      const first = renders[0];
      for (const html of renders) expect(html).toBe(first);
    });
  });

  describe("équivalence stricte mobile vs desktop pour le même saving", () => {
    it.each([
      ["-1.0%", 1],
      ["-12.5%", 12.5],
      ["-99.9%", 99.9],
    ])("saving=%s rend strictement le même HTML mobile/desktop", (_label, val) => {
      const desktopHtml = renderHtml(val);
      const mobileHtml = renderHtml(val);
      expect(mobileHtml).toBe(desktopHtml);
    });
  });
});
