import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordTierSavingIssue,
  getTierSavingDiagnostics,
  resetTierSavingDiagnostics,
} from "../tier-saving-diagnostics";

describe("tier-saving-diagnostics", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetTierSavingDiagnostics();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    resetTierSavingDiagnostics();
  });

  it("returns empty stats initially", () => {
    const diag = getTierSavingDiagnostics();
    expect(diag.total).toBe(0);
    expect(diag.badge_fallback_invalid_saving).toBeNull();
    expect(diag.compute_returned_null).toBeNull();
  });

  it("increments counter and stores context per reason", () => {
    recordTierSavingIssue("badge_fallback_invalid_saving", { saving: "abc" });
    recordTierSavingIssue("badge_fallback_invalid_saving", { saving: NaN });
    recordTierSavingIssue("compute_returned_null", {
      where: "discountTiers",
      basePrice: 0,
      unitPrice: 1,
    });

    const diag = getTierSavingDiagnostics();
    expect(diag.total).toBe(3);
    expect(diag.badge_fallback_invalid_saving?.count).toBe(2);
    expect(diag.badge_fallback_invalid_saving?.lastContext).toEqual({
      saving: NaN,
    });
    expect(diag.compute_returned_null?.count).toBe(1);
    expect(diag.compute_returned_null?.lastContext?.where).toBe("discountTiers");
  });

  it("warns at most 5 times per reason then suppresses", () => {
    for (let i = 0; i < 10; i++) {
      recordTierSavingIssue("compute_returned_null", { basePrice: i });
    }
    expect(warnSpy).toHaveBeenCalledTimes(5);
    // Compteur global non affecté par la suppression des warns.
    expect(getTierSavingDiagnostics().compute_returned_null?.count).toBe(10);
  });

  it("counts warn quotas separately per reason", () => {
    for (let i = 0; i < 6; i++) {
      recordTierSavingIssue("badge_fallback_invalid_saving", { saving: i });
      recordTierSavingIssue("compute_returned_null", { basePrice: i });
    }
    // 5 (badge) + 5 (compute) = 10
    expect(warnSpy).toHaveBeenCalledTimes(10);
  });

  it("exposes diagnostics on window for manual inspection", () => {
    recordTierSavingIssue("badge_fallback_invalid_saving", { saving: "x" });
    const win = window as unknown as { __tierSavingDiagnostics?: { total: number } };
    expect(win.__tierSavingDiagnostics?.total).toBe(1);
  });

  it("reset clears counters, warn quotas and window state", () => {
    for (let i = 0; i < 10; i++) {
      recordTierSavingIssue("compute_returned_null", { basePrice: i });
    }
    resetTierSavingDiagnostics();
    warnSpy.mockClear();

    expect(getTierSavingDiagnostics().total).toBe(0);
    expect(
      (window as unknown as { __tierSavingDiagnostics?: unknown })
        .__tierSavingDiagnostics,
    ).toBeUndefined();

    // Le quota doit aussi être réinitialisé.
    for (let i = 0; i < 3; i++) {
      recordTierSavingIssue("compute_returned_null", { basePrice: i });
    }
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});
