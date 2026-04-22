/**
 * Lightweight client-side marker for an "in-progress" contract signature.
 *
 * The signature flow is fully client-side until submission, so we persist
 * a small marker in localStorage to detect when a vendor opened the
 * Convention de mandat de facturation but did not finalize signing.
 *
 * Stored shape per vendor:
 *   mk:contract-draft:<vendorId> = { screen: "read" | "sign", updatedAt: ISO }
 */

export type ContractDraftScreen = "read" | "sign";

export interface ContractDraftMarker {
  screen: ContractDraftScreen;
  updatedAt: string;
}

const KEY_PREFIX = "mk:contract-draft:";

function key(vendorId: string) {
  return `${KEY_PREFIX}${vendorId}`;
}

export function getContractDraft(vendorId: string | undefined | null): ContractDraftMarker | null {
  if (!vendorId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(vendorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContractDraftMarker;
    if (parsed.screen !== "read" && parsed.screen !== "sign") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setContractDraft(vendorId: string, screen: ContractDraftScreen): void {
  if (!vendorId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key(vendorId),
      JSON.stringify({ screen, updatedAt: new Date().toISOString() })
    );
    // Notify other tabs/components in the same session
    window.dispatchEvent(new CustomEvent("mk:contract-draft-changed", { detail: { vendorId } }));
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function clearContractDraft(vendorId: string | undefined | null): void {
  if (!vendorId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(vendorId));
    window.dispatchEvent(new CustomEvent("mk:contract-draft-changed", { detail: { vendorId } }));
  } catch {
    /* ignore */
  }
}
