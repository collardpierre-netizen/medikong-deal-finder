import { isEuCountry } from "@/lib/countries-iso";

/** Pays d'établissement du vendeur (MediKong SRL). */
export const SELLER_COUNTRY = "BE";

export type VatExemptionReason = "export" | "intracom";

export interface VatExemption {
  exempt: boolean;
  reason: VatExemptionReason | null;
  /** Mention légale à reprendre sur les documents (facture, bon de commande, PDF). */
  mention: string | null;
  /** Libellé court pour l'UI. */
  label: string | null;
}

const NO_EXEMPTION: VatExemption = { exempt: false, reason: null, mention: null, label: null };

export const VAT_MENTIONS: Record<VatExemptionReason, string> = {
  export:
    "Exonération de TVA — exportation hors Union européenne (art. 146 de la Directive 2006/112/CE).",
  intracom:
    "Autoliquidation — livraison intracommunautaire exonérée de TVA (art. 138 de la Directive 2006/112/CE). TVA due par le preneur.",
};

const VAT_LABELS: Record<VatExemptionReason, string> = {
  export: "Export hors UE — TVA non due",
  intracom: "Intracommunautaire — TVA non due (autoliquidation)",
};

/**
 * Détermine si la TVA est due pour un client donné.
 * - Pays hors UE → exportation exonérée (aucun n° TVA requis).
 * - Pays UE ≠ BE avec n° TVA intracommunautaire → autoliquidation.
 * - Belgique, ou client UE sans n° TVA → TVA belge applicable.
 */
export function resolveVatExemption(input: {
  countryCode?: string | null;
  vatNumber?: string | null;
}): VatExemption {
  const country = (input.countryCode || "").toUpperCase();
  if (!country) return NO_EXEMPTION;
  if (country === SELLER_COUNTRY) return NO_EXEMPTION;

  if (!isEuCountry(country)) {
    return { exempt: true, reason: "export", mention: VAT_MENTIONS.export, label: VAT_LABELS.export };
  }

  const vat = (input.vatNumber || "").replace(/\s+/g, "").toUpperCase();
  const looksValid = /^[A-Z]{2}[A-Z0-9]{2,15}$/.test(vat);
  if (looksValid) {
    return { exempt: true, reason: "intracom", mention: VAT_MENTIONS.intracom, label: VAT_LABELS.intracom };
  }
  return NO_EXEMPTION;
}
