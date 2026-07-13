import { Landmark, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { formatPrice } from "@/data/mock";
import type { PaymentIntentInfo } from "./StripePaymentFlow";

interface Props {
  paymentIntents: PaymentIntentInfo[];
  vendorLabelById?: Record<string, string>;
}

/**
 * Flux B — SEPA Bank Transfer.
 * Affiche les coordonnées IBAN générées par Stripe (next_action
 * .display_bank_transfer_instructions) pour chaque PaymentIntent vendeur.
 * L'acheteur exécute le virement depuis sa banque en citant la référence.
 * Le webhook payment_intent.succeeded confirme la commande à réception.
 */
export function BankTransferInstructions({ paymentIntents, vendorLabelById }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-mk-blue/30 bg-mk-blue/5 p-3 text-sm text-mk-navy">
        <p className="font-semibold">Virement bancaire — instructions</p>
        <p className="text-xs text-mk-sec mt-1">
          Effectuez {paymentIntents.length > 1 ? "les virements ci-dessous" : "le virement ci-dessous"} depuis votre banque en citant la <strong>référence exacte</strong>.
          Votre commande sera confirmée automatiquement à réception des fonds (généralement sous 1 à 2 jours ouvrés).
        </p>
      </div>

      {paymentIntents.map((pi, i) => {
        const label = vendorLabelById?.[pi.vendor_id] || `Fournisseur ${i + 1}`;
        return (
          <VendorInstructions key={pi.payment_intent_id} pi={pi} label={label} />
        );
      })}
    </div>
  );
}

function VendorInstructions({ pi, label }: { pi: PaymentIntentInfo; label: string }) {
  const instr = pi.bank_transfer_instructions;
  const fin = instr?.financial_addresses?.[0];
  const iban = fin?.iban;
  const ref = instr?.reference;

  return (
    <div className="border border-mk-line rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-mk-blue" />
          <p className="text-sm font-semibold text-mk-navy">Virement — {label}</p>
        </div>
        <span className="text-sm font-bold text-mk-navy">{formatPrice(pi.amount / 100)} EUR</span>
      </div>

      {!instr ? (
        <p className="text-xs text-mk-sec">
          Instructions de virement en cours de génération. Rechargez la page dans quelques secondes.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {iban?.iban && <CopyField label="IBAN" value={iban.iban} />}
          {iban?.bic && <CopyField label="BIC / SWIFT" value={iban.bic} />}
          {iban?.account_holder_name && <CopyField label="Bénéficiaire" value={iban.account_holder_name} />}
          {ref && <CopyField label="Référence (obligatoire)" value={ref} highlight />}
          <CopyField label="Montant" value={`${(pi.amount / 100).toFixed(2)} EUR`} />
          {iban?.country && <div className="text-mk-sec">Pays du compte : {iban.country}</div>}
        </div>
      )}
    </div>
  );
}

function CopyField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`rounded border ${highlight ? "border-mk-blue/40 bg-mk-blue/5" : "border-mk-line bg-mk-alt/40"} p-2`}>
      <p className="text-[10px] uppercase tracking-wide text-mk-sec">{label}</p>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <p className="font-mono text-[12px] text-mk-navy break-all">{value}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* noop */
            }
          }}
          className="shrink-0 text-mk-blue hover:text-mk-navy"
          aria-label={`Copier ${label}`}
        >
          {copied ? <CheckCircle2 size={14} className="text-mk-green" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
