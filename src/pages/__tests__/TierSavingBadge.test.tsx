/**
 * Tests unitaires pour TierSavingBadge (desktop + mobile).
 * Couvre :
 *   - rendu de la pastille -X.X% pour des valeurs valides
 *   - rendu du fallback "—" quand `saving` est manquant/invalide
 *   - équivalence du résultat pour les valeurs que la page calcule en amont
 *     selon le formule `((basePrice - tier.unit_price) / basePrice) * 100`
 *     avec gardes basePrice manquant / nul / invalide.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TierSavingBadge } from "@/pages/ProductPage";

/** Reproduit le calcul inline réalisé côté page pour chaque palier i > 0. */
function computeSaving(
  basePrice: number | null | undefined,
  unitPrice: number | null | undefined,
  guarded: boolean = true,
): string | null {
  // Block 1 (line ~395) : pas de garde basePrice
  // Blocks 2 & 3 (lines ~421, ~646) : guarded = basePrice > 0 && Number.isFinite(unitPrice)
  if (guarded) {
    if (
      typeof basePrice !== "number" ||
      !Number.isFinite(basePrice) ||
      basePrice <= 0 ||
      typeof unitPrice !== "number" ||
      !Number.isFinite(unitPrice)
    ) {
      return null;
    }
  } else {
    if (typeof basePrice !== "number" || typeof unitPrice !== "number") {
      return null;
    }
  }
  return (((basePrice as number) - (unitPrice as number)) / (basePrice as number) * 100).toFixed(1);
}

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

describe("computeSaving (formule inline) + TierSavingBadge — intégration", () => {
  it("basePrice=10, unit=9 → -10.0%", () => {
    const saving = computeSaving(10, 9);
    expect(saving).toBe("10.0");
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText("-10.0%")).toBeInTheDocument();
  });

  it("basePrice manquant (null) → garde renvoie null → fallback", () => {
    const saving = computeSaving(null, 9);
    expect(saving).toBeNull();
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("basePrice undefined → garde renvoie null → fallback", () => {
    const saving = computeSaving(undefined, 9);
    expect(saving).toBeNull();
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("basePrice=0 (nul) → garde renvoie null → fallback", () => {
    const saving = computeSaving(0, 9);
    expect(saving).toBeNull();
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("basePrice=NaN (invalide) → garde renvoie null → fallback", () => {
    const saving = computeSaving(NaN, 9);
    expect(saving).toBeNull();
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("unitPrice invalide (NaN) → garde renvoie null → fallback", () => {
    const saving = computeSaving(10, NaN);
    expect(saving).toBeNull();
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("unitPrice >= basePrice → saving <= 0 → fallback (pas une vraie réduction)", () => {
    const saving = computeSaving(10, 10); // → "0.0"
    expect(saving).toBe("0.0");
    render(<TierSavingBadge saving={saving} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("bloc non gardé + basePrice=0 produit 'Infinity'/'NaN' → badge fallback (sécurité côté composant)", () => {
    // Reproduit le block 1 (line ~395) qui ne garde pas basePrice.
    const savingInfinity = computeSaving(0, 5, /* guarded */ false);
    // ((0 - 5) / 0) * 100 = -Infinity ; toFixed(1) → "-Infinity"
    expect(savingInfinity).toBe("-Infinity");
    render(<TierSavingBadge saving={savingInfinity} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("bloc non gardé + basePrice=0 et unit=0 produit 'NaN' → fallback", () => {
    const savingNaN = computeSaving(0, 0, /* guarded */ false);
    expect(savingNaN).toBe("NaN");
    render(<TierSavingBadge saving={savingNaN} />);
    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });
});

describe("TierSavingBadge — équivalence desktop / mobile", () => {
  // Desktop et mobile utilisent le MÊME composant avec les mêmes classes.
  // Ce test verrouille l'invariant : pour une valeur donnée, le markup
  // (text + classes) est identique d'un rendu à l'autre.
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
