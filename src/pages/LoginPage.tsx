import { Link } from "react-router-dom";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-mk-alt">
      <div className="w-full max-w-[400px] p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <span className="text-mk-navy font-bold text-2xl">MediKong</span>
            <span className="text-mk-blue font-bold text-2xl">.pro</span>
          </div>
          <h1 className="text-xl font-bold text-mk-navy">Connectez-vous a votre compte</h1>
        </div>

        <div className="space-y-4">
          <div><label className="text-xs text-mk-sec mb-1 block">Email</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" /></div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-mk-sec">Mot de passe</label>
              <Link to="#" className="text-xs text-mk-blue">Mot de passe oublie ?</Link>
            </div>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" className="w-full border border-mk-line rounded-md px-3 py-2.5 text-sm" />
          </div>
          <button className="w-full bg-mk-navy text-white font-bold py-3 rounded-md text-sm">Se connecter</button>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-mk-line" /><span className="text-xs text-mk-ter">ou</span><div className="flex-1 h-px bg-mk-line" />
        </div>

        <Link to="/inscription" className="block w-full text-center border border-mk-navy text-mk-navy font-bold py-3 rounded-md text-sm">
          Creer un compte professionnel
        </Link>

        <div className="mt-6 bg-mk-deal rounded-lg p-4">
          <p className="text-xs text-mk-green font-medium">Plateforme B2B reservee aux professionnels</p>
          <p className="text-xs text-mk-sec mt-1">Donnees securisees et conformes RGPD</p>
        </div>
      </div>
    </div>
  );
}
