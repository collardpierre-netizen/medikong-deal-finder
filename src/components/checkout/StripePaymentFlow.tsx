import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { getStripe, getStripeLoadError } from "@/lib/stripe";
import { formatPrice } from "@/data/mock";

export interface PaymentIntentInfo {
  vendor_id: string;
  payment_intent_id: string;
  client_secret: string | null;
  amount: number;      // cents TTC
  commission: number;  // cents
  bank_transfer_instructions?: any;
}

interface Props {
  orderId: string;
  paymentIntents: PaymentIntentInfo[];
  vendorLabelById?: Record<string, string>;
  onAllPaid: () => void;
}

/**
 * Séquentiel : un PaymentElement par vendeur.
 * Utilise confirmPayment({ redirect: 'if_required' }) pour rester dans la page
 * tant qu'un PI ne demande pas de redirection (3DS / bancontact / sepa).
 * Quand tous les PIs sont "succeeded" ou "processing", on appelle onAllPaid().
 */
export function StripePaymentFlow({ orderId, paymentIntents, vendorLabelById, onAllPaid }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, "pending" | "processing" | "succeeded" | "error">>(() => {
    const s: Record<string, "pending" | "processing" | "succeeded" | "error"> = {};
    for (const pi of paymentIntents) s[pi.payment_intent_id] = "pending";
    return s;
  });

  const current = paymentIntents[currentIdx];
  const allDone = paymentIntents.every(
    (pi) => statuses[pi.payment_intent_id] === "succeeded" || statuses[pi.payment_intent_id] === "processing",
  );

  useEffect(() => {
    if (allDone) onAllPaid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const stripePromise = useMemo(() => getStripe(), []);

  if (!current) return null;

  return (
    <div className="space-y-4">
      {paymentIntents.length > 1 && (
        <div className="border border-mk-line rounded-lg p-3 bg-mk-alt/40">
          <p className="text-xs font-semibold text-mk-navy mb-2">
            Paiement multi-fournisseurs — {paymentIntents.length} paiements séparés
          </p>
          <ol className="space-y-1">
            {paymentIntents.map((pi, i) => {
              const st = statuses[pi.payment_intent_id];
              const label = vendorLabelById?.[pi.vendor_id] || `Fournisseur ${i + 1}`;
              return (
                <li key={pi.payment_intent_id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      st === "succeeded" || st === "processing"
                        ? "bg-mk-green text-white"
                        : i === currentIdx
                        ? "bg-mk-blue text-white animate-pulse"
                        : "bg-mk-line text-mk-sec"
                    }`}
                  >
                    {st === "succeeded" || st === "processing" ? "✓" : i + 1}
                  </span>
                  <span className="text-mk-navy font-medium">{label}</span>
                  <span className="text-mk-sec">— {formatPrice(pi.amount / 100)} EUR TTC</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {current.client_secret ? (
        <Elements
          key={current.payment_intent_id}
          stripe={stripePromise}
          options={{ clientSecret: current.client_secret, locale: "fr" }}
        >
          <SinglePaymentForm
            orderId={orderId}
            pi={current}
            label={vendorLabelById?.[current.vendor_id] || `Fournisseur ${currentIdx + 1}`}
            onDone={(status) => {
              setStatuses((prev) => ({ ...prev, [current.payment_intent_id]: status }));
              if (status === "succeeded" || status === "processing") {
                if (currentIdx < paymentIntents.length - 1) {
                  setCurrentIdx(currentIdx + 1);
                }
              }
            }}
          />
        </Elements>
      ) : (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Client secret manquant pour ce PaymentIntent</p>
            <p className="text-xs text-mk-sec mt-1">{getStripeLoadError() || "Contactez le support."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SinglePaymentForm({
  orderId,
  pi,
  label,
  onDone,
}: {
  orderId: string;
  pi: PaymentIntentInfo;
  label: string;
  onDone: (status: "succeeded" | "processing" | "error") => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        setError(submitErr.message || "Erreur de validation du formulaire");
        setSubmitting(false);
        return;
      }
      const result = await stripe.confirmPayment({
        elements,
        clientSecret: pi.client_secret!,
        confirmParams: {
          return_url: `${window.location.origin}/commande/confirmation?order_id=${orderId}`,
        },
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message || "Paiement refusé");
        onDone("error");
        setSubmitting(false);
        return;
      }
      const status = result.paymentIntent?.status;
      if (status === "succeeded" || status === "processing") {
        setSucceeded(true);
        onDone(status === "succeeded" ? "succeeded" : "processing");
      } else {
        setError(`Statut inattendu : ${status ?? "inconnu"}`);
        onDone("error");
      }
    } catch (e: any) {
      setError(e?.message || "Erreur pendant le paiement");
      onDone("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (succeeded) {
    return (
      <div className="rounded-md border border-mk-green/40 bg-mk-green/5 p-3 flex items-center gap-2">
        <CheckCircle2 size={18} className="text-mk-green" />
        <span className="text-sm font-medium text-mk-navy">
          Paiement {label} accepté
        </span>
      </div>
    );
  }

  return (
    <div className="border border-mk-line rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-mk-navy">Paiement — {label}</p>
        <span className="text-sm font-bold text-mk-navy">{formatPrice(pi.amount / 100)} EUR</span>
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="text-xs text-destructive flex items-start gap-1.5">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}
      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !elements || submitting}
        className="w-full bg-mk-green text-white font-bold text-sm px-6 py-3 rounded-md flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting && <Loader2 size={16} className="animate-spin" />}
        {submitting ? "Traitement…" : `Payer ${formatPrice(pi.amount / 100)} EUR`}
      </button>
    </div>
  );
}
