import { Link } from "react-router-dom";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export function Footer() {
  return (
    <footer className="border-t border-mk-line mt-10">
      <div className="mk-container py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <img src={logoDark} alt="MediKong.pro" className="h-[58px]" />
            </div>
            <p className="text-sm text-mk-sec mb-3">La marketplace B2B pour les fournitures medicales en Belgique.</p>
            <p className="text-xs text-mk-ter">Balooh SRL · TVA: BE 1005.771.323</p>
            <p className="text-xs text-mk-ter">23 rue de la Procession, B-7822 Ath</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Nos solutions</h4>
            {["Catalogue", "Verification fournisseurs", "Comment commander", "Garantie qualite"].map(l => (
              <Link key={l} to="#" className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Comment on travaille</h4>
            {["Partenariats fournisseurs", "Paiement differe", "Logistique", "Temoignages"].map(l => (
              <Link key={l} to="#" className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Entreprise</h4>
            {["A propos", "Carrieres", "Devenir vendeur", "Contact", "Investir", "Centre d'aide"].map(l => (
              <Link key={l} to="#" className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-mk-line py-4">
        <div className="mk-container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-mk-ter">
          <span className="text-center md:text-left">MediKong 2026 — Plateforme B2B reservee aux professionnels de sante — Conformite FAGG/AFMPS</span>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {["Visa", "Mastercard", "Bancontact", "SEPA", "Mondu", "Stripe"].map(p => (
              <span key={p} className="px-2 py-1 border border-mk-line rounded text-[10px] font-medium text-mk-sec">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
