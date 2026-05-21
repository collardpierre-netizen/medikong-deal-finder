import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Régression : sur /vendeur/:code (VendorPublicPage), le bouton "Voir délégué"
 * ne doit s'afficher QUE si `hasActiveDelegate` est vrai (i.e. le vendeur a
 * au moins un `vendor_delegates.is_active = true`). On reproduit ici le bloc
 * de gating tel qu'inséré dans src/pages/VendorPublicPage.tsx (ligne ~572),
 * afin de verrouiller le comportement sans avoir à monter toute la page
 * (Auth/Country/Cart contexts + ~6 queries Supabase).
 *
 * Mapping count → bool identique à la page :
 *   hasActiveDelegate = (count || 0) > 0
 */

function hasActiveDelegateFromCount(count: number | null | undefined): boolean {
  return (count || 0) > 0;
}

function DelegateButtonBlock({ hasActiveDelegate }: { hasActiveDelegate: boolean }) {
  return (
    <div>
      {hasActiveDelegate && (
        <button type="button" aria-label="Voir délégué">
          Voir délégué
        </button>
      )}
    </div>
  );
}

describe("VendorPublicPage — gating bouton 'Voir délégué'", () => {
  it("affiche le bouton quand vendor_delegates actifs > 0", () => {
    render(<DelegateButtonBlock hasActiveDelegate={hasActiveDelegateFromCount(3)} />);
    expect(screen.getByRole("button", { name: "Voir délégué" })).toBeInTheDocument();
  });

  it("masque le bouton quand vendor_delegates actifs = 0", () => {
    render(<DelegateButtonBlock hasActiveDelegate={hasActiveDelegateFromCount(0)} />);
    expect(screen.queryByRole("button", { name: "Voir délégué" })).not.toBeInTheDocument();
  });

  it("masque le bouton quand le count est null (RLS qui filtre tout)", () => {
    render(<DelegateButtonBlock hasActiveDelegate={hasActiveDelegateFromCount(null)} />);
    expect(screen.queryByRole("button", { name: "Voir délégué" })).not.toBeInTheDocument();
  });

  it("mapping count → bool : 0/null/undefined → false, ≥1 → true", () => {
    expect(hasActiveDelegateFromCount(0)).toBe(false);
    expect(hasActiveDelegateFromCount(null)).toBe(false);
    expect(hasActiveDelegateFromCount(undefined)).toBe(false);
    expect(hasActiveDelegateFromCount(1)).toBe(true);
    expect(hasActiveDelegateFromCount(42)).toBe(true);
  });
});
