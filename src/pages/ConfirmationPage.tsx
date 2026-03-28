import { Layout } from "@/components/layout/Layout";
import { Check, Truck, Shield } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/shared/PageTransition";
import { formatPrice } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("order") || "";
  const { user } = useAuth();

  const { data: order } = useQuery({
    queryKey: ["order-confirmation", orderNumber],
    enabled: !!user && !!orderNumber,
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
            className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-mk-green flex items-center justify-center mx-auto mb-6"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <Check size={32} className="text-white" strokeWidth={3} />
          </motion.div>

          <motion.h1 className="text-2xl md:text-[32px] font-bold text-mk-green mb-2"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            Commande confirmée !
          </motion.h1>
          <p className="text-sm text-mk-sec mb-8">Votre commande a été enregistrée. Vous recevrez un email de confirmation sous peu.</p>

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
