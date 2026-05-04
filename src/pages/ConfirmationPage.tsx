import { Layout } from "@/components/layout/Layout";
import { Check, Truck, Shield, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { formatPrice } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("order") || "";
  const isTest = searchParams.get("test") === "1";
  const { user } = useAuth();
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  // Cache local du dernier statut connu (sessionStorage) pour éviter le clignotement
  // au retour via back/forward et permettre un affichage immédiat
  const cacheKey = orderNumber ? `mk:order-confirmation:${orderNumber}` : "";
  const cached = (() => {
    if (!cacheKey) return undefined;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch {
      return undefined;
    }
  })();

  const cachedStatus = (cached?.data as any)?.status as string | undefined;
  const cachedIsFinal =
    !!cachedStatus &&
    ["confirmed", "paid", "shipped", "delivered", "cancelled", "failed"].includes(cachedStatus);

  const { data: order, isFetching, refetch, dataUpdatedAt, error, failureCount, errorUpdatedAt } = useQuery({
    queryKey: ["order-confirmation", orderNumber],
    enabled: !!user && !!orderNumber,
    // Hydrate immédiatement avec la dernière valeur connue → pas de flash "Initialisation"
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
    // Si le statut en cache est déjà final, on considère la donnée fraîche 30s
    // → pas de refetch automatique au remount (back/forward)
    staleTime: cachedIsFinal ? 30_000 : 0,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      // Stop polling once final state reached
      if (status && ["confirmed", "paid", "shipped", "delivered", "cancelled", "failed"].includes(status)) {
        return false;
      }
      return 5000;
    },
    // Pas de refetch on focus si on a déjà un statut final
    refetchOnWindowFocus: !cachedIsFinal,
    refetchOnMount: cachedIsFinal ? false : "always",
    // Auto-retry exponentiel jusqu'à 5 tentatives en cas d'échec réseau/DB
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastChecked(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Persiste la dernière donnée fraîche dans sessionStorage pour le prochain montage
  useEffect(() => {
    if (!cacheKey || !order || !dataUpdatedAt) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: order, updatedAt: dataUpdatedAt }));
    } catch {
      /* quota / private mode : ignorer */
    }
  }, [cacheKey, order, dataUpdatedAt]);

  // Considère une erreur "active" uniquement si on n'a pas encore de data fraîche
  const hasFetchError = !!error && !order;

  const status = (order as any)?.status as string | undefined;
  const paymentDone = isTest || (!!status && !["pending", "pending_payment", "draft"].includes(status));
  const confirmed = !!status && ["confirmed", "paid", "shipped", "delivered"].includes(status);
  const failed = status === "failed" || status === "cancelled";

  // Étape courante : 0 = créée, 1 = paiement en cours, 2 = confirmée
  const currentStep = failed ? -1 : confirmed ? 2 : paymentDone ? 2 : status ? 1 : 0;

  const headline = failed
    ? status === "cancelled"
      ? "Commande annulée"
      : "Paiement échoué"
    : confirmed
    ? "Commande confirmée !"
    : paymentDone
    ? "Paiement reçu, finalisation en cours…"
    : status
    ? "Paiement en cours de traitement…"
    : "Commande créée, en attente du paiement…";

  const subline = failed
    ? "Aucun montant n'a été débité. Vous pouvez réessayer depuis votre panier."
    : confirmed
    ? "Votre commande a été enregistrée. Vous recevrez un email de confirmation sous peu."
    : paymentDone
    ? "Nous validons les derniers détails avec le vendeur, cela ne prend que quelques secondes."
    : status
    ? "Votre paiement est en cours de vérification. Cette page se met à jour automatiquement."
    : "Nous attendons la confirmation du paiement. Merci de ne pas fermer cette page.";

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 7);
  const formattedDate = deliveryDate.toLocaleDateString("fr-BE");

  const shippingStr = order?.shipping_address
    ? typeof order.shipping_address === "object" && order.shipping_address !== null
      ? (order.shipping_address as any).line1 || JSON.stringify(order.shipping_address)
      : String(order.shipping_address)
    : "";

  return (
    <Layout>
      <PageTransition>
        <div className="mk-container py-12 md:py-16 max-w-[800px] mx-auto text-center px-4">
          <motion.div
            className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${failed ? "bg-destructive" : confirmed ? "bg-mk-green" : "bg-mk-blue"}`}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            {confirmed || failed ? (
              <Check size={32} className="text-white" strokeWidth={3} />
            ) : (
              <RefreshCw size={28} className="text-white animate-spin" strokeWidth={3} />
            )}
          </motion.div>

          <motion.h1 className={`text-2xl md:text-[32px] font-bold mb-2 ${failed ? "text-destructive" : confirmed ? "text-mk-green" : "text-mk-navy"}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            {headline}
          </motion.h1>
          <p className="text-sm text-mk-sec mb-6">{subline}</p>

          {/* Statut commande */}
          <motion.div
            className="border border-mk-line rounded-lg p-3 mb-6 bg-mk-alt/40 text-left"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          >
            <ol className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
              {[
                { label: "Commande créée", idx: 0 },
                { label: isTest ? "Paiement simulé" : "Paiement en cours", idx: 1 },
                { label: "Confirmée", idx: 2 },
              ].map((s, i, arr) => {
                const done = currentStep > s.idx || (s.idx === 2 && confirmed) || (s.idx === 0 && !!orderNumber);
                const active = currentStep === s.idx && !confirmed && !failed;
                return (
                  <li key={s.label} className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? "bg-mk-green text-white" : active ? "bg-mk-blue text-white animate-pulse" : "bg-mk-line text-mk-sec"}`}>
                      {done ? "✓" : active ? "…" : ""}
                    </span>
                    <span className={`font-medium ${done ? "text-mk-navy" : active ? "text-mk-blue" : "text-mk-sec"}`}>{s.label}</span>
                    {i < arr.length - 1 && <span className="text-mk-sec">→</span>}
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-mk-sec">
              <span>Dernière vérification : {lastChecked.toLocaleTimeString("fr-BE")}</span>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-1 underline hover:text-mk-navy disabled:opacity-50"
              >
                <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
                Actualiser
              </button>
            </div>
            {hasFetchError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] text-destructive">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-semibold">Impossible de rafraîchir le statut</p>
                  <p className="text-destructive/80">
                    {(error as any)?.message || "La connexion au serveur a échoué."} Nouvelle tentative automatique en cours
                    {failureCount > 0 ? ` (essai ${failureCount}/5)` : ""}…
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="mt-1 inline-flex items-center gap-1 font-semibold underline hover:no-underline disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
                    Réessayer maintenant
                  </button>
                </div>
              </div>
            )}
            {isTest && (
              <p className="text-[11px] text-mk-sec mt-2 text-center">Mode test : aucun paiement carte n'a été effectué.</p>
            )}
          </motion.div>

          <motion.div className="bg-mk-alt rounded-lg p-5 md:p-6 mb-6 text-left"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><span className="text-xs text-mk-sec">Numéro commande</span><div className="text-lg md:text-xl font-bold text-mk-navy">{orderNumber || "N/A"}</div></div>
              <div><span className="text-xs text-mk-sec">Date</span><div className="text-sm font-medium text-mk-navy">{new Date().toLocaleDateString("fr-BE")}</div></div>
              {order && (
                <>
                  <div><span className="text-xs text-mk-sec">Méthode de paiement</span><div className="text-sm font-medium text-mk-navy">{order.payment_method}</div></div>
                  <div><span className="text-xs text-mk-sec">Montant total</span><div className="text-sm font-bold text-mk-navy">{formatPrice(Number(order.total_incl_vat))} EUR</div></div>
                </>
              )}
              <div className="sm:col-span-2"><span className="text-xs text-mk-sec">Livraison prévue</span><div className="text-sm font-medium text-mk-green flex items-center gap-1"><Truck size={14} /> {formattedDate}</div></div>
            </div>
          </motion.div>

          {order && shippingStr && (
            <motion.div className="border border-mk-line rounded-lg p-4 mb-6 text-left"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <p className="text-xs text-mk-sec mb-1">Adresse de livraison</p>
              <p className="text-sm text-mk-navy">{shippingStr}</p>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-8">
            <Link to="/compte" className="bg-mk-blue text-white text-sm font-semibold px-5 py-2.5 rounded-md">Mes commandes</Link>
            <Link to="/recherche" className="border border-mk-navy text-mk-navy text-sm font-semibold px-5 py-2.5 rounded-md">Retour aux achats</Link>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8">
            {[
              { icon: Shield, text: "Plateforme sécurisée" },
              { icon: Truck, text: "Livraison garantie" },
              { icon: Check, text: "Support 24/7" },
            ].map(t => (
              <div key={t.text} className="flex items-center justify-center gap-2 text-xs text-mk-sec">
                <t.icon size={14} className="text-mk-green" /> {t.text}
              </div>
            ))}
          </div>
        </div>
      </PageTransition>
    </Layout>
  );
}
