/**
 * Régression React #310 (« Rendered more/fewer hooks than during the previous
 * render ») sur ProductPriceHistory.
 *
 * Le composant reçoit un `gtin` qui peut basculer entre `null | undefined` et
 * une chaîne définie (chargement produit → produit chargé, ou l'inverse en
 * navigation). Si un early return est placé au milieu des hooks (par ex.
 * `if (!enabled) return null;` avant des `useCallback`), le nombre de hooks
 * change entre les rendus et React lève l'erreur #310 puis démonte l'arbre.
 *
 * Ce test rend le composant en alternant `gtin = null` ↔ `gtin = "…"` et
 * vérifie que React ne journalise AUCUNE erreur d'ordre de hooks pendant les
 * rerenders.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Supabase client — on renvoie des résultats vides pour éviter toute fetch réelle.
vi.mock("@/integrations/supabase/client", () => {
  const queryBuilder = {
    select: () => queryBuilder,
    eq: () => queryBuilder,
    order: () => queryBuilder,
    limit: () => Promise.resolve({ data: [], error: null }),
  };
  return {
    supabase: {
      from: () => queryBuilder,
      rpc: () => Promise.resolve({ data: null, error: null }),
    },
  };
});

// Recharts + ResponsiveContainer nécessite ResizeObserver et un layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { ProductPriceHistory } from "../ProductPriceHistory";

function wrap(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const HOOK_ORDER_PATTERNS = [
  /Rendered more hooks than during the previous render/i,
  /Rendered fewer hooks than expected/i,
  /change in the order of Hooks/i,
  /Minified React error #310/i,
];

describe("ProductPriceHistory — ordre des hooks stable", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let captured: string[] = [];

  beforeEach(() => {
    captured = [];
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    cleanup();
  });

  function expectNoHookOrderError() {
    const offending = captured.filter((line) =>
      HOOK_ORDER_PATTERNS.some((p) => p.test(line)),
    );
    expect(
      offending,
      `Erreur d'ordre de hooks détectée dans ProductPriceHistory :\n${offending.join("\n")}`,
    ).toEqual([]);
  }

  it("gtin: null → défini ne modifie pas l'ordre des hooks", () => {
    const { rerender } = render(wrap(<ProductPriceHistory gtin={null} />));
    rerender(wrap(<ProductPriceHistory gtin="5410063001234" />));
    expectNoHookOrderError();
  });

  it("gtin: défini → null ne modifie pas l'ordre des hooks", () => {
    const { rerender } = render(wrap(<ProductPriceHistory gtin="5410063001234" />));
    rerender(wrap(<ProductPriceHistory gtin={null} />));
    expectNoHookOrderError();
  });

  it("bascules multiples null ↔ défini ↔ undefined restent stables", () => {
    const { rerender } = render(wrap(<ProductPriceHistory gtin={null} />));
    rerender(wrap(<ProductPriceHistory gtin="5410063001234" />));
    rerender(wrap(<ProductPriceHistory gtin={undefined} />));
    rerender(wrap(<ProductPriceHistory gtin="5410063009999" />));
    rerender(wrap(<ProductPriceHistory gtin={null} />));
    expectNoHookOrderError();
  });
});
