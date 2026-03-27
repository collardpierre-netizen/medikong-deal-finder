import { Layout } from "@/components/layout/Layout";
import { formatPrice } from "@/data/mock";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function CheckoutPage() {
  const [step, setStep] = useState(1);
  const [selectedAddr, setSelectedAddr] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [payment, setPayment] = useState(0);

  const addresses = [
    { label: "Adresse principale", addr: "23 rue de la Procession, B-7822 Ath" },
    { label: "Siege social", addr: "15 avenue Louise, B-1050 Bruxelles" },
  ];
  const shippingOpts = [
    { name: "Standard", delay: "5-7 jours", price: 0 },
    { name: "Express", delay: "2-3 jours", price: 15 },
    { name: "Economique", delay: "7-10 jours", price: -2.5 },
  ];
  const paymentMethods = ["Carte bancaire", "Virement SEPA", "Paiement differe Mondu"];

  return (
    <Layout>
      <div className="mk-container py-6 md:py-8">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-3 md:gap-6 mb-8 md:mb-10">
          {["Livraison", "Paiement", "Verification"].map((s, i) => (
            <div key={s} className="flex items-center gap-2 md:gap-3">
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold ${step > i ? "bg-mk-green text-white" : step === i + 1 ? "bg-mk-navy text-white" : "bg-mk-alt text-mk-sec"}`}>
                {i + 1}
              </div>
              <span className={`text-xs md:text-sm hidden sm:inline ${step === i + 1 ? "font-bold text-mk-navy" : "text-mk-sec"}`}>{s}</span>
              {i < 2 && <div className="w-8 md:w-16 h-px bg-mk-line" />}
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Adresse de livraison</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {addresses.map((a, i) => (
                    <button key={i} onClick={() => setSelectedAddr(i)} className={`border rounded-lg p-4 text-left ${selectedAddr === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}>
                      <p className="text-sm font-bold text-mk-navy mb-1">{a.label}</p>
                      <p className="text-sm text-mk-sec">{a.addr}</p>
                    </button>
                  ))}
                </div>
                <h3 className="text-lg font-bold text-mk-navy mb-4">Options de livraison</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {shippingOpts.map((s, i) => (
                    <button key={i} onClick={() => setShipping(i)} className={`border rounded-lg p-4 text-center ${shipping === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}>
                      <p className="text-sm font-bold text-mk-navy">{s.name}</p>
                      <p className="text-xs text-mk-sec">{s.delay}</p>
                      <p className="text-sm font-bold text-mk-navy mt-1">{s.price === 0 ? "Gratuit" : `${s.price > 0 ? "+" : ""}${formatPrice(s.price)} EUR`}</p>
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep(2)} className="w-full sm:w-auto bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md">Continuer vers le paiement</button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Methode de paiement</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {paymentMethods.map((m, i) => (
                    <button key={i} onClick={() => setPayment(i)} className={`border rounded-lg p-4 text-left ${payment === i ? "border-mk-blue border-2 bg-blue-50" : "border-mk-line"}`}>
                      <p className="text-sm font-bold text-mk-navy">{m}</p>
                    </button>
                  ))}
                </div>
                <div className="mb-6">
                  <label className="text-xs text-mk-sec mb-1 block">Code promo</label>
                  <div className="flex gap-2">
                    <input placeholder="Entrez votre code" className="flex-1 border border-mk-line rounded-md px-3 py-2 text-sm" />
                    <button className="border border-mk-line text-sm px-4 py-2 rounded-md text-mk-sec">Appliquer</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md">Retour</button>
                  <button onClick={() => setStep(3)} className="bg-mk-navy text-white font-bold text-sm px-6 py-3 rounded-md">Confirmer la commande</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold text-mk-navy mb-5">Verification</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="border border-mk-line rounded-lg p-4">
                    <p className="text-xs text-mk-sec mb-1">Adresse</p>
                    <p className="text-sm font-medium text-mk-navy">{addresses[selectedAddr].addr}</p>
                  </div>
                  <div className="border border-mk-line rounded-lg p-4">
                    <p className="text-xs text-mk-sec mb-1">Livraison</p>
                    <p className="text-sm font-medium text-mk-navy">{shippingOpts[shipping].name}</p>
                  </div>
                  <div className="border border-mk-line rounded-lg p-4">
                    <p className="text-xs text-mk-sec mb-1">Paiement</p>
                    <p className="text-sm font-medium text-mk-navy">{paymentMethods[payment]}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="border border-mk-navy text-mk-navy font-bold text-sm px-6 py-3 rounded-md">Retour</button>
                  <Link to="/confirmation" className="bg-mk-green text-white font-bold text-sm px-6 py-3 rounded-md flex items-center gap-2">Passer la commande</Link>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-[320px] shrink-0">
            <div className="border border-mk-line rounded-lg p-5 lg:sticky lg:top-20">
              <h3 className="text-lg font-bold text-mk-navy mb-4">Recapitulatif</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-mk-sec">Sous-total</span><span className="text-mk-navy">77,94 EUR</span></div>
                <div className="flex justify-between"><span className="text-mk-sec">Livraison</span><span className="text-mk-navy">{shippingOpts[shipping].price === 0 ? "Incluse" : `${formatPrice(shippingOpts[shipping].price)} EUR`}</span></div>
              </div>
              <div className="border-t border-mk-line pt-3">
                <div className="flex justify-between font-bold text-base text-mk-navy">
                  <span>Total TTC</span><span>{formatPrice(77.94 + shippingOpts[shipping].price)} EUR</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
