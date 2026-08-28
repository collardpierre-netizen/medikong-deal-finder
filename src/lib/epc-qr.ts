import QRCode from "qrcode";

/**
 * QR de paiement EPC (SEPA Credit Transfer) — norme européenne lue par les
 * apps bancaires BE/FR/LU. Le client scanne, l'IBAN + montant + communication
 * se pré-remplissent, il n'a qu'à valider.
 */
export const MEDIKONG_IBAN = "BE86 7320 7305 0650";
export const MEDIKONG_BENEFICIARY = "MediKong";

export interface EpcPaymentParams {
  /** Montant en euros (TTC) */
  amountEur: number;
  /** Communication libre (ex. numéro de commande) */
  reference: string;
  /** Bénéficiaire — défaut MediKong */
  beneficiary?: string;
  /** IBAN — défaut compte MediKong */
  iban?: string;
  /** BIC optionnel */
  bic?: string;
}

/** Construit le payload texte EPC 002 (max 331 octets). */
export function buildEpcPayload({
  amountEur,
  reference,
  beneficiary = MEDIKONG_BENEFICIARY,
  iban = MEDIKONG_IBAN,
  bic = "",
}: EpcPaymentParams): string {
  const amount = Number.isFinite(amountEur) && amountEur > 0 ? `EUR${amountEur.toFixed(2)}` : "";
  const lines = [
    "BCD",
    "002",
    "1",
    "SCT",
    bic.replace(/\s+/g, "").toUpperCase(),
    beneficiary.slice(0, 70),
    iban.replace(/\s+/g, "").toUpperCase(),
    amount,
    "", // purpose
    "", // structured reference (non utilisée)
    reference.slice(0, 140), // unstructured remittance info
    "", // beneficiary to originator information
  ];
  return lines.join("\n");
}

/** Génère le QR EPC en data-URL PNG. */
export async function buildEpcQrDataUrl(params: EpcPaymentParams, width = 240): Promise<string> {
  return QRCode.toDataURL(buildEpcPayload(params), {
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
