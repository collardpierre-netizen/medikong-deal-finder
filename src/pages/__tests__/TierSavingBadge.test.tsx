/**
 * Tests unitaires pour <TierSavingBadge /> (desktop + mobile).
 * Les règles de validation sont déléguées à `src/lib/tier-saving.ts` —
 * ces tests vérifient uniquement l'intégration : pastille verte vs
 * fallback "—", classes, attributs accessibilité.
 *
 * Pour la couverture exhaustive des règles, voir
 * `src/lib/__tests__/tier-saving.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierSavingBadge } from "@/pages/ProductPage";
import { computeTierSavingPercent } from "@/lib/tier-saving";

const FALLBACK = "—";

describe("TierSavingBadge — valeurs valides", () => {
  it("affiche -4.5% pour saving='4.5'", () => {
    render(<TierSavingBadge saving="4.5" />);
    expect(screen.getByText("-4.5%")).toBeInTheDocument();
  });

  it("affiche -6.8% pour saving=6.8 (number)", () => {
    render(<TierSavingBadge saving={6.8} />);
    expect(screen.getByText("-6.8%")).toBeInTheDocument();
  });

  it("force toujours 1 décimale (-3.0% pour saving=3)", () => {
    render(<TierSavingBadge saving={3} />);
    expect(screen.getByText("-3.0%")).toBeInTheDocument();
  });

  it("applique les classes vertes sur cas valide", () => {
    const { container } = render(<TierSavingBadge saving={5} />);
    const span = container.querySelector("span");
    expect(span?.className).toMatch(/bg-green-50/);
    expect(span?.className).toMatch(/text-green-700/);
  });
});

describe("TierSavingBadge — fallback quand saving manquant/invalide", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["chaîne vide", ""],
    ["chaîne non numérique", "abc"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["zéro", 0],
    ["zéro string", "0"],
    ["zéro formaté", "0.0"],
    ["négatif", -5],
    ["négatif string", "-2.3"],
  ])("affiche le fallback « — » pour %s", (_label, value) => {
    const { container } = render(
      <TierSavingBadge saving={value as string | number | null | undefined} />,
    );
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-label")).toBe("Réduction non disponible");
    expect(span?.getAttribute("title")).toMatch(/prix de base manquant/i);
    expect(span?.className).toMatch(/bg-muted/);
    expect(span?.className).toMatch(/text-muted-foreground/);
  });
});

describe("Intégration computeTierSavingPercent → TierSavingBadge", () => {
  it("basePrice=10, unit=9 → -10.0%", () => {
    const saving = computeTierSavingPercent(10, 9);
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText("-10.0%")).toBeInTheDocument();
  });

  it.each([
    ["basePrice null", null, 9],
    ["basePrice undefined", undefined, 9],
    ["basePrice zéro", 0, 9],
    ["basePrice NaN", NaN, 9],
    ["unitPrice NaN", 10, NaN],
    ["unit ≥ base (saving ≤ 0)", 10, 10],
  ])("%s → fallback", (_label, base, unit) => {
    const saving = computeTierSavingPercent(
      base as number | null | undefined,
      unit as number | null | undefined,
    );
    expect(saving).toBeNull();
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });
});

describe("TierSavingBadge — équivalence desktop / mobile", () => {
  it("même markup pour deux rendus de la même valeur", () => {
    const { container: a } = render(<TierSavingBadge saving="4.5" />);
    const { container: b } = render(<TierSavingBadge saving="4.5" />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });

  it("même markup fallback pour deux rendus invalides", () => {
    const { container: a } = render(<TierSavingBadge saving={null} />);
    const { container: b } = render(<TierSavingBadge saving={undefined} />);
    expect(a.innerHTML).toBe(b.innerHTML);
  });
});
