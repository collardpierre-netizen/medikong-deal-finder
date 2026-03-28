import { Link } from "react-router-dom";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export function Footer() {
  return (
    <footer className="border-t border-mk-line mt-10">
      <div className="mk-container py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <img src={logoDark} alt="MediKong.pro" className="h-[72px]" />
            </div>
            <p className="text-sm text-mk-sec mb-3">La marketplace B2B pour les fournitures médicales en Belgique.</p>
            <p className="text-xs text-mk-ter">Balooh SRL · TVA: BE 1005.771.323</p>
            <p className="text-xs text-mk-ter">23 rue de la Procession, B-7822 Ath</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Nos solutions</h4>
            {[
              { label: "Catalogue", to: "/categories" },
              { label: "Vérification fournisseurs", to: "/verification-fournisseurs" },
              { label: "Garantie qualité", to: "/garantie-qualite" },
              { label: "Comment commander", to: "/comment-commander" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Comment on travaille</h4>
            {[
              { label: "Logistique", to: "/logistique" },
              { label: "Paiement différé", to: "/paiement-differe" },
              { label: "Devenir vendeur", to: "/devenir-vendeur" },
              { label: "Témoignages", to: "/temoignages" },
            ].map(l => (
              <Link key={l.label} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Entreprise</h4>
            {[
              { label: "À propos", to: "/a-propos" },
              { label: "Équipe", to: "/equipe" },
              { label: "Carrières", to: "/carrieres" },
              { label: "Presse", to: "/presse" },
              { label: "Investir", to: "/investir" },
              { label: "Contact", to: "/contact" },
              { label: "Centre d'aide", to: "/centre-aide" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">Légal</h4>
            {[
              { label: "Mentions légales", to: "/mentions-legales" },
              { label: "CGV", to: "/cgv" },
              { label: "Confidentialité", to: "/politique-confidentialite" },
              { label: "Cookies", to: "/cookies" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-mk-line py-4">
        <div className="mk-container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-mk-ter">
          <span className="text-center md:text-left">MediKong 2026 — Plateforme B2B réservée aux professionnels de santé — Conformité FAGG/AFMPS</span>
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
