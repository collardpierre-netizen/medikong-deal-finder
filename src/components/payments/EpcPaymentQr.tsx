import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { buildEpcQrDataUrl, MEDIKONG_BENEFICIARY, MEDIKONG_IBAN } from "@/lib/epc-qr";

interface Props {
  /** Montant TTC en euros */
  amountEur: number;
  /** Communication (numéro de commande) */
  reference: string;
  className?: string;
}

/**
 * QR de paiement SEPA (norme EPC) à scanner avec l'app bancaire :
 * IBAN MediKong + montant + communication pré-remplis.
 */
export default function EpcPaymentQr({ amountEur, reference, className }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    buildEpcQrDataUrl({ amountEur, reference })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [amountEur, reference]);

  if (!src) return null;

  return (
    <div className={`bg-white border border-slate-200 rounded p-4 ${className || ""}`}>
      <div className="text-[11px] uppercase text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
        <QrCode size={13} /> Payer par QR (virement SEPA)
      </div>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <img
          src={src}
          alt={`QR code de paiement SEPA pour la commande ${reference}`}
          className="w-[150px] h-[150px] shrink-0"
          width={150}
          height={150}
        />
        <div className="text-xs text-slate-600 space-y-1 text-center sm:text-left">
          <p>
            Scannez ce QR avec votre application bancaire : le bénéficiaire, l'IBAN, le montant et
            la communication sont pré-remplis. Il ne reste qu'à valider.
          </p>
          <div className="pt-1 space-y-0.5">
            <div>
              <span className="text-slate-500">Bénéficiaire :</span>{" "}
              <span className="font-medium text-slate-900">{MEDIKONG_BENEFICIARY}</span>
            </div>
            <div>
              <span className="text-slate-500">IBAN :</span>{" "}
              <span className="font-mono text-slate-900 break-all">{MEDIKONG_IBAN}</span>
            </div>
            <div>
              <span className="text-slate-500">Communication :</span>{" "}
              <span className="font-mono text-slate-900">{reference}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
