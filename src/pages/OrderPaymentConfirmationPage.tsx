import { Layout } from "@/components/layout/Layout";
import { PageTransition } from "@/components/shared/PageTransition";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, AlertTriangle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/data/mock";
import { useVendorLabels } from "@/hooks/useVendorLabels";

type PIStatus = "succeeded" | "processing" | "requires_payment_method" | "requires_action" | "canceled" | string;

export default function OrderPaymentConfirmationPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const orderId = params.get("order_id") || "";
  const piClientSecret = params.get("payment_intent_client_secret") || "";
  const redirectStatus = params.get("redirect_status") || "";

  const { data, isFetching, error } = useQuery({
    queryKey: ["order-payment-status", orderId],
    enabled: !!user && !!orderId,
    refetchInterval: (q) => {
      const d: any = q.state.data;
      if (!d) return 3000;
      // stop polling once all PI have a terminal status
      const allTerminal = (d.payment_intents || []).every((pi: any) =>
        ["succeeded", "processing", "canceled", "requires_payment_method"].includes(pi.status),
      );
      return allTerminal ? false : 3000;
    },
    queryFn: async () => {
      const { data: order, error: e1 } = await supabase
        .from("orders")
        .select("id, order_number, status, total_incl_vat, created_at")
        .eq("id", orderId)
        .maybeSingle();
      if (e1) throw e1;
      const { data: lines } = await supabase
        .from("order_lines")
        .select("id, vendor_id, stripe_payment_intent_id, line_total_incl_vat")
        .eq("order_id", orderId);

      // Regroupe par PI id
      const byPi = new Map<string, { vendor_id: string | null; amount: number }>();
      for (const l of lines || []) {
        const pid = (l as any).stripe_payment_intent_id;
        if (!pid) continue;
        const cur = byPi.get(pid) || { vendor_id: l.vendor_id, amount: 0 };
        cur.amount += Number(l.line_total_incl_vat || 0);
        byPi.set(pid, cur);
      }

      // Récupère le statut Stripe via edge function (best-effort)
      const piIds = Array.from(byPi.keys());
      let piStatuses: Record<string, PIStatus> = {};
      if (piIds.length > 0) {
        const { data: resp } = await supabase.functions.invoke("stripe-checkout", {
          body: { action: "get-payment-intents-status", payment_intent_ids: piIds },
        });
        if (resp?.statuses) piStatuses = resp.statuses;
      }

      const payment_intents = piIds.map((pid) => ({
        id: pid,
        vendor_id: byPi.get(pid)!.vendor_id,
        amount: byPi.get(pid)!.amount,
        status: piStatuses[pid] || "unknown",
      }));

      return { order, payment_intents };
    },
  });

  if (!user) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <p className="text-sm text-mk-sec">Connectez-vous pour voir votre commande.</p>
        </div>
      </Layout>
    );
  }

  if (!orderId) {
    return (
      <Layout>
        <div className="mk-container py-20 text-center">
          <AlertTriangle className="mx-auto text-destructive mb-2" size={40} />
          <p className="text-sm text-mk-sec">Paramètre <code>order_id</code> manquant.</p>
        </div>
      </Layout>
    );
  }

  const order = (data as any)?.order;
  const pis = ((data as any)?.payment_intents || []) as Array<{ id: string; vendor_id: string | null; amount: number; status: PIStatus }>;
  const allSucceeded = pis.length > 0 && pis.every((p) => p.status === "succeeded");
  const anyFailed = pis.some((p) => p.status === "requires_payment_method" || p.status === "canceled");

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-10 max-w-2xl">
          <div className="text-center mb-8">
            {allSucceeded ? (
              <>
                <CheckCircle2 className="mx-auto text-mk-green mb-3" size={56} />
                <h1 className="text-2xl font-bold text-mk-navy mb-1">Paiement confirmé</h1>
                <p className="text-sm text-mk-sec">Merci ! Votre commande a bien été enregistrée.</p>
              </>
            ) : anyFailed ? (
              <>
                <AlertTriangle className="mx-auto text-destructive mb-3" size={56} />
                <h1 className="text-2xl font-bold text-mk-navy mb-1">Paiement incomplet</h1>
                <p className="text-sm text-mk-sec">Certains paiements n'ont pas abouti. Contactez le support si besoin.</p>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto text-mk-blue mb-3 animate-spin" size={56} />
                <h1 className="text-2xl font-bold text-mk-navy mb-1">Traitement en cours…</h1>
                <p className="text-sm text-mk-sec">Nous vérifions l'état de votre paiement.</p>
              </>
            )}
          </div>

          <div className="border border-mk-line rounded-lg p-5 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-mk-sec">Commande</span>
              <span className="font-mono text-mk-navy">{order?.order_number || orderId.slice(0, 8)}</span>
            </div>
            {order?.total_incl_vat != null && (
              <div className="flex justify-between text-sm mb-2">
                <span className="text-mk-sec">Total TTC</span>
                <span className="font-semibold text-mk-navy">{formatPrice(Number(order.total_incl_vat))} EUR</span>
              </div>
            )}
            {redirectStatus && (
              <div className="flex justify-between text-xs text-mk-sec mt-2">
                <span>Retour Stripe</span>
                <span>{redirectStatus}</span>
              </div>
            )}
          </div>

          {pis.length > 0 && (
            <div className="border border-mk-line rounded-lg mb-6">
              <div className="px-4 py-2 border-b border-mk-line">
                <p className="text-xs font-semibold text-mk-navy">
                  Paiements ({pis.length}{pis.length > 1 ? " — un par fournisseur" : ""})
                </p>
              </div>
              {pis.map((pi) => (
                <div key={pi.id} className="px-4 py-3 border-b border-mk-line last:border-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-mk-navy truncate">{formatPrice(pi.amount)} EUR</p>
                    <p className="text-[11px] text-mk-sec font-mono truncate">{pi.id}</p>
                  </div>
                  <StatusBadge status={pi.status} />
                </div>
              ))}
            </div>
          )}

          {isFetching && (
            <p className="text-xs text-mk-sec text-center flex items-center justify-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Actualisation…
            </p>
          )}
          {!!error && (
            <p className="text-xs text-destructive text-center">
              Erreur : {(error as any).message || "Impossible de charger la commande"}
            </p>
          )}

          <div className="flex justify-center gap-3 mt-8">
            <Link to="/account/orders" className="border border-mk-navy text-mk-navy font-bold text-sm px-5 py-2.5 rounded-md">
              Mes commandes
            </Link>
            <Link to="/" className="bg-mk-navy text-white font-bold text-sm px-5 py-2.5 rounded-md">
              Retour à l'accueil
            </Link>
          </div>
          {/* payment_intent_client_secret consommé côté URL uniquement, no-op */}
          {piClientSecret ? null : null}
        </div>
      </PageTransition>
    </Layout>
  );
}

function StatusBadge({ status }: { status: PIStatus }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    succeeded: { label: "Payé", cls: "bg-mk-green/10 text-mk-green border-mk-green/30", icon: CheckCircle2 },
    processing: { label: "En traitement", cls: "bg-blue-50 text-mk-blue border-mk-blue/30", icon: Clock },
    requires_action: { label: "Action requise", cls: "bg-amber-50 text-amber-700 border-amber-300", icon: AlertTriangle },
    requires_payment_method: { label: "Refusé", cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
    canceled: { label: "Annulé", cls: "bg-mk-alt text-mk-sec border-mk-line", icon: AlertTriangle },
  };
  const meta = map[status] || { label: status, cls: "bg-mk-alt text-mk-sec border-mk-line", icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}
