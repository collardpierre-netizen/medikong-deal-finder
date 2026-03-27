import { Layout } from "@/components/layout/Layout";
import { Check, Truck, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function ConfirmationPage() {
  return (
    <Layout>
      <div className="mk-container py-16 max-w-[800px] mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-mk-green flex items-center justify-center mx-auto mb-6">
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>
        <h1 className="text-[32px] font-bold text-mk-green mb-2">Commande confirmee !</h1>
        <p className="text-sm text-mk-sec mb-8">Votre commande a ete confirmee. Vous recevrez un email de confirmation sous peu.</p>

        <div className="bg-mk-alt rounded-lg p-6 mb-6 text-left">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-xs text-mk-sec">Numero commande</span><div className="text-xl font-bold text-mk-navy">MK-2026-00847</div></div>
            <div><span className="text-xs text-mk-sec">Date</span><div className="text-sm font-medium text-mk-navy">25/03/2026</div></div>
            <div><span className="text-xs text-mk-sec">Articles</span><div className="text-sm font-medium text-mk-navy">5 produits</div></div>
            <div><span className="text-xs text-mk-sec">Montant total</span><div className="text-sm font-bold text-mk-navy">234,50 EUR</div></div>
            <div className="col-span-2"><span className="text-xs text-mk-sec">Livraison prevue</span><div className="text-sm font-medium text-mk-green flex items-center gap-1"><Truck size={14} /> 28-30 mars 2026</div></div>
          </div>
        </div>

        <div className="border border-mk-line rounded-lg p-4 mb-6 text-left">
          <p className="text-xs text-mk-sec mb-1">Adresse de livraison</p>
          <p className="text-sm text-mk-navy">23 rue de la Procession, B-7822 Ath, Belgique</p>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          <Link to="/commande/MK-2026-00847" className="bg-mk-blue text-white text-sm font-semibold px-5 py-2.5 rounded-md">Suivre ma commande</Link>
          <Link to="/recherche" className="border border-mk-navy text-mk-navy text-sm font-semibold px-5 py-2.5 rounded-md">Retour aux achats</Link>
        </div>

        <div className="flex justify-center gap-8">
          {[
            { icon: Shield, text: "Plateforme securisee" },
            { icon: Truck, text: "Livraison garantie" },
            { icon: Check, text: "Support 24/7" },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-2 text-xs text-mk-sec">
              <t.icon size={14} className="text-mk-green" /> {t.text}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
