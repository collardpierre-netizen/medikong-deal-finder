// @ts-nocheck — Deno runtime
// QR de paiement EPC (SEPA Credit Transfer) — miroir serveur de src/lib/epc-qr.ts.
// Dessiné directement dans le PDF (modules noirs via doc.rect) : pas de canvas
// requis côté Deno, contrairement à QRCode.toDataURL().
import QRCode from "npm:qrcode@1.5.4";

export const MEDIKONG_IBAN = "BE86 7320 7305 0650";
export const MEDIKONG_BENEFICIARY = "MediKong";

export function buildEpcPayload({
  amountEur,
  reference,
  beneficiary = MEDIKONG_BENEFICIARY,
  iban = MEDIKONG_IBAN,
  bic = "",
}: {
  amountEur: number;
  reference: string;
  beneficiary?: string;
  iban?: string;
  bic?: string;
}): string {
  const amount = Number.isFinite(amountEur) && amountEur > 0 ? `EUR${amountEur.toFixed(2)}` : "";
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    String(bic).replace(/\s+/g, "").toUpperCase(),
    String(beneficiary).slice(0, 70),
    String(iban).replace(/\s+/g, "").toUpperCase(),
    amount,
    "",
    "",
    String(reference || "").slice(0, 140),
    "",
  ].join("\n");
}

/**
 * Dessine le QR EPC dans un document jsPDF.
 * @param size Côté du QR en mm.
 */
export function drawEpcQr(
  doc: any,
  params: { amountEur: number; reference: string },
  x: number,
  y: number,
  size: number,
) {
  const qr = QRCode.create(buildEpcPayload(params), { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 1; // modules de marge blanche
  const total = count + quiet * 2;
  const cell = size / total;

  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, "F");
  doc.setFillColor(0, 0, 0);
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (data[row * count + col]) {
        doc.rect(
          x + (col + quiet) * cell,
          y + (row + quiet) * cell,
          cell + 0.02,
          cell + 0.02,
          "F",
        );
      }
    }
  }
}
