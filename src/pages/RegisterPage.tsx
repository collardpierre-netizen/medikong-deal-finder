import { Link } from "react-router-dom";
import { useState } from "react";

export default function RegisterPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <span className="text-mk-navy font-bold text-2xl">MediKong</span>
            <span className="text-mk-blue font-bold text-2xl">.pro</span>
          </div>
          <h1 className="text-xl font-bold text-mk-navy">Creer votre compte professionnel</h1>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div><label className="text-xs text-mk-sec mb-1 block">Nom complet</label><input className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Email</label><input type="email" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Telephone</label><input type="tel" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" placeholder="+32" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Mot de passe</label><input type="password" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <button onClick={() => setStep(2)} className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm">Continuer</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><label className="text-xs text-mk-sec mb-1 block">Nom entreprise</label><input className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Numero TVA</label><input className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" placeholder="BE 0XXX.XXX.XXX" /></div>
            <div><label className="text-xs text-mk-sec mb-1 block">Pays</label>
              <select className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm"><option>Belgique</option><option>France</option><option>Suisse</option></select>
            </div>
            <div><label className="text-xs text-mk-sec mb-1 block">Secteur d'activite</label>
              <select className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm"><option>Pharmacie</option><option>Hopital</option><option>Maison de repos</option><option>Distributeur</option><option>Autre</option></select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-mk-navy text-mk-navy font-bold py-3 rounded-md text-sm">Retour</button>
              <button className="flex-1 bg-mk-navy text-white font-bold py-3 rounded-md text-sm">Creer mon compte</button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-mk-sec mt-6">
          Deja inscrit ? <Link to="/connexion" className="text-mk-blue font-medium">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
