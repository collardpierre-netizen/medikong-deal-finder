import { Layout } from "@/components/layout/Layout";
import { useParams, Link } from "react-router-dom";
import { Download } from "lucide-react";
import { formatPrice } from "@/data/mock";

const timeline = ["Confirmee", "En preparation", "Expediee", "Livree"];

export default function OrderDetailPage() {
  const { id } = useParams();
  const currentStep = 2;

  const items = [
    { name: "Gants nitrile Aurelia x200", qty: 2, price: 12.90 },
    { name: "Sekusept Aktiv 6kg", qty: 1, price: 33.59 },
    { name: "Masques FFP2 Kolmi x50", qty: 3, price: 18.50 },
  ];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <Layout>
      <div className="mk-container py-6 md:py-8">
        <div className="text-xs text-mk-sec mb-4">
          <Link to="/" className="hover:text-mk-blue">Accueil</Link> &gt; <Link to="/compte" className="hover:text-mk-blue">Mon compte</Link> &gt; Commandes &gt; #{id}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <h1 className="text-2xl md:text-[28px] font-bold text-mk-navy">Commande #{id}</h1>
          <button className="border border-mk-line text-sm px-4 py-2 rounded-md text-mk-sec flex items-center gap-1.5"><Download size={14} /> Telecharger facture</button>
        </div>

        {/* Timeline */}
        <div className="bg-mk-alt rounded-lg p-4 md:p-6 mb-8 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[400px]">
            {timeline.map((s, i) => (
              <div key={s} className="flex items-center gap-2 md:gap-3">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold ${i <= currentStep ? "bg-mk-green text-white" : "bg-mk-line text-mk-sec"}`}>
                  {i + 1}
                </div>
                <span className={`text-xs md:text-sm ${i <= currentStep ? "font-bold text-mk-navy" : "text-mk-sec"}`}>{s}</span>
                {i < 3 && <div className={`w-6 md:w-12 h-0.5 ${i < currentStep ? "bg-mk-green" : "bg-mk-line"}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Articles */}
        <div className="border border-mk-line rounded-lg overflow-x-auto mb-8">
          <div className="grid grid-cols-4 gap-3 px-4 py-2 bg-mk-alt text-xs font-semibold text-mk-sec min-w-[400px]">
            <span>Produit</span><span>Quantite</span><span>Prix/u</span><span>Montant</span>
          </div>
          {items.map(i => (
            <div key={i.name} className="grid grid-cols-4 gap-3 px-4 py-3 border-t border-mk-line text-sm items-center min-w-[400px]">
              <span className="font-medium text-mk-navy">{i.name}</span>
              <span className="text-mk-sec">{i.qty}</span>
              <span className="text-mk-sec">{formatPrice(i.price)} EUR</span>
              <span className="font-bold text-mk-navy">{formatPrice(i.qty * i.price)} EUR</span>
            </div>
          ))}
          <div className="grid grid-cols-4 gap-3 px-4 py-3 border-t border-mk-line bg-mk-alt min-w-[400px]">
            <span className="col-span-3 text-right font-bold text-mk-navy text-sm">Total</span>
            <span className="font-bold text-mk-navy text-sm">{formatPrice(total)} EUR</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="border border-mk-line rounded-lg p-5">
            <p className="text-xs text-mk-sec mb-1">Adresse de livraison</p>
            <p className="text-sm text-mk-navy">23 rue de la Procession<br />B-7822 Ath, Belgique</p>
          </div>
          <div className="border border-mk-line rounded-lg p-5">
            <p className="text-xs text-mk-sec mb-1">Paiement</p>
            <p className="text-sm text-mk-navy">Carte bancaire ****4567</p>
            <p className="text-sm font-bold text-mk-navy mt-1">{formatPrice(total)} EUR</p>
          </div>
        </div>

        <button className="border border-mk-red text-mk-red text-sm px-4 py-2 rounded-md">Signaler un probleme</button>
      </div>
    </Layout>
  );
}
