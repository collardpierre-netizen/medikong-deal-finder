import { Layout } from "@/components/layout/Layout";
import { PageTransition } from "@/components/shared/PageTransition";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/data/mock";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Info, Loader2, Printer, XCircle } from "lucide-react";
import EpcPaymentQr from "@/components/payments/EpcPaymentQr";
import { MEDIKONG_BENEFICIARY, MEDIKONG_IBAN } from "@/lib/epc-qr";

/**
 * Page de paiement SEPA d'une commande : QR EPC (bénéficiaire, IBAN, montant TTC
 * et communication pré-remplis) + coordonnées bancaires MediKong.
 */
export default function OrderSepaPaymentPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order-sepa-payment", id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error: e } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total_incl_vat, subtotal_excl_vat, vat_amount")
        .eq("id", id!)
        .maybeSingle();
      if (e) throw e;
      return data;
    },
  });

  if (!user) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <p className="text-sm text-mk-sec">Connectez-vous pour payer votre commande.</p>
        </div>
      </Layout>
    );
  }

  const total = Number(order?.total_incl_vat || 0);
  const reference = order?.order_number || "";

  // Statut de paiement affiché en clair : l'acheteur doit savoir immédiatement
  // si le virement est encore attendu, déjà reçu, ou si la commande est annulée.
  const paymentStatus = order?.payment_status as string | undefined;
  const orderStatus = order?.status as string | undefined;
  const isCancelled = orderStatus === "cancelled";
  const isPaid = paymentStatus === "paid";
  const statusInfo = isCancelled
    ? {
        tone: "bg-destructive/10 border-destructive/30 text-destructive",
        icon: <XCircle size={18} className="shrink-0 mt-0.5" />,
        title: "Commande annulée",
        text: "Cette commande est annulée : n'effectuez pas de virement. Contactez-nous si vous avez déjà payé.",
      }
    : isPaid
      ? {
          tone: "bg-emerald-50 border-emerald-200 text-emerald-800",
          icon: <CheckCircle2 size={18} className="shrink-0 mt-0.5" />,
          title: "Paiement reçu",
          text: "Votre virement a bien été enregistré. Aucun nouveau paiement n'est nécessaire.",
        }
      : paymentStatus === "refunded"
        ? {
            tone: "bg-mk-alt border-mk-line text-mk-navy",
            icon: <Info size={18} className="shrink-0 mt-0.5" />,
            title: "Commande remboursée",
            text: "Cette commande a été remboursée : aucun virement n'est attendu.",
          }
        : {
            tone: "bg-amber-50 border-amber-200 text-amber-900",
            icon: <Clock size={18} className="shrink-0 mt-0.5" />,
            title: "En attente de votre virement",
            text: "Votre commande est enregistrée. Elle sera traitée dès réception du virement sur le compte MediKong.",
          };
  const showPaymentDetails = !isCancelled && !isPaid && paymentStatus !== "refunded";

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-10 max-w-2xl">
          <Link to={id ? `/commande/${id}` : "/compte?tab=commandes"} className="text-sm text-mk-blue inline-flex items-center gap-1.5 mb-5">
            <ArrowLeft size={14} /> Retour au bon de commande
          </Link>

          <h1 className="text-2xl font-bold text-mk-navy mb-1">Paiement par virement SEPA</h1>
          <p className="text-sm text-mk-sec mb-6">
            Scannez le QR avec votre application bancaire ou recopiez les coordonnées ci-dessous.
          </p>

          {isLoading && (
            <p className="text-sm text-mk-sec flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Chargement de la commande…
            </p>
          )}

          {!isLoading && (!order || error) && (
            <div className="border border-mk-line rounded-lg p-6 text-center">
              <AlertTriangle className="mx-auto text-destructive mb-2" size={36} />
              <p className="text-sm text-mk-sec">Commande introuvable.</p>
            </div>
          )}

          {order && (
            <>
              <div
                role="status"
                aria-live="polite"
                className={`border rounded-lg p-4 mb-5 flex gap-3 ${statusInfo.tone}`}
              >
                {statusInfo.icon}
                <div>
                  <p className="text-sm font-bold">{statusInfo.title}</p>
                  <p className="text-xs mt-0.5">{statusInfo.text}</p>
                </div>
              </div>

              <div className="border border-mk-line rounded-lg p-5 mb-5 bg-white">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-mk-sec">Commande</span>
                  <span className="font-mono text-mk-navy">{reference || "—"}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-mk-sec">Total HTVA</span>
                  <span className="text-mk-navy">{formatPrice(Number(order.subtotal_excl_vat || 0))} EUR</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-mk-sec">TVA</span>
                  <span className="text-mk-navy">{formatPrice(Number(order.vat_amount || 0))} EUR</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-mk-line">
                  <span className="font-bold text-mk-navy">Montant à payer (TTC)</span>
                  <span className="font-bold text-mk-navy">{formatPrice(total)} EUR</span>
                </div>
              </div>

              {showPaymentDetails && (
                <EpcPaymentQr className="mb-5" amountEur={total} reference={reference} />
              )}

              {showPaymentDetails && (
              <div className="border border-mk-line rounded-lg p-5 text-sm bg-white mb-6">
                <p className="text-[11px] uppercase text-mk-ter font-semibold mb-3">Coordonnées bancaires</p>
                <div className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-mk-sec">Bénéficiaire</span>
                    <span className="font-medium text-mk-navy">{MEDIKONG_BENEFICIARY}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-mk-sec">IBAN</span>
                    <span className="font-mono text-mk-navy break-all">{MEDIKONG_IBAN}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-mk-sec">Communication</span>
                    <span className="font-mono text-mk-navy">{reference || "—"}</span>
                  </div>
                </div>
                <p className="text-xs text-mk-ter mt-3">
                  Indiquez impérativement la communication : elle permet le rapprochement automatique du paiement.
                </p>
              </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="border border-mk-line text-mk-navy text-sm font-medium px-4 py-2.5 rounded-md inline-flex items-center gap-1.5 hover:bg-mk-alt"
                >
                  <Printer size={14} /> Imprimer
                </button>
                <Link
                  to="/compte?tab=commandes"
                  className="bg-mk-navy text-white font-bold text-sm px-5 py-2.5 rounded-md"
                >
                  Mes commandes
                </Link>
              </div>
            </>
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}
