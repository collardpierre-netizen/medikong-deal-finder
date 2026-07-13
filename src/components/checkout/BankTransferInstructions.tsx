import { Landmark, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { formatPrice } from "@/data/mock";
import type { PaymentIntentInfo } from "./StripePaymentFlow";

interface Props {
  paymentIntents: PaymentIntentInfo[];
  vendorLabelById?: Record<string, string>;
}

/**
 * Flux B — SEPA Bank Transfer, architecture mandataire.
 * UN SEUL PaymentIntent customer_balance est créé pour le total du panier
 * (côté edge function stripe-checkout). L'acheteur voit donc UN SEUL bloc
 * IBAN à créditer, quel que soit le nombre de fournisseurs. Après réception
 * du virement, le webhook payment_intent.succeeded crée N Transfers séparés
 * vers les connected accounts des vendeurs.
 */
export function BankTransferInstructions({ paymentIntents, vendorLabelById }: Props) {
  // Flux B garantit un seul PI (aggregated). On prend le premier par sécurité.
  const pi = paymentIntents[0];
  if (!pi) return null;

  const vendorNames: string[] =
    (pi as any).vendor_names && Array.isArray((pi as any).vendor_names)
      ? (pi as any).vendor_names
      : paymentIntents
          .map((p) => vendorLabelById?.[p.vendor_id])
          .filter((s): s is string => Boolean(s));

  const instr = pi.bank_transfer_instructions;
  const fin = instr?.financial_addresses?.[0];
  const iban = fin?.iban;
  const ref = instr?.reference;
  const holder = iban?.account_holder_name || "MediKong";

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-mk-blue/30 bg-mk-blue/5 p-3 text-sm text-mk-navy">
        <p className="font-semibold">Virement bancaire — un seul virement à effectuer</p>
        <p className="text-xs text-mk-sec mt-1">
          Effectuez <strong>un unique virement</strong> vers MediKong en citant la <strong>référence exacte</strong> ci-dessous.
          Votre commande {vendorNames.length > 0 && (
            <>auprès de <strong>{vendorNames.join(", ")}</strong> </>
          )}
          sera traitée automatiquement dès réception des fonds (généralement sous 1 à 2 jours ouvrés).
        </p>
      </div>

      <div className="border border-mk-line rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-mk-blue" />
            <p className="text-sm font-semibold text-mk-navy">Bénéficiaire : {holder}</p>
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
            {holder && <CopyField label="Bénéficiaire" value={holder} />}
            {ref && <CopyField label="Référence (obligatoire)" value={ref} highlight />}
            <CopyField label="Montant total" value={`${(pi.amount / 100).toFixed(2)} EUR`} highlight />
            {iban?.country && <div className="text-mk-sec">Pays du compte : {iban.country}</div>}
          </div>
        )}
      </div>
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
