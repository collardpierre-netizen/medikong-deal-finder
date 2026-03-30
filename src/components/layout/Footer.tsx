import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_CONFIG, type SupportedLanguage } from "@/i18n";
import logoDark from "@/assets/Logo_horizontal_sombre2.png";

export function Footer() {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.substring(0, 2) || "fr") as SupportedLanguage;

  return (
    <footer className="border-t border-mk-line mt-10">
      <div className="mk-container py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <img src={logoDark} alt="MediKong.pro" className="h-[72px]" />
            </div>
            <p className="text-sm text-mk-sec mb-3">{t("footer.description")}</p>
            <p className="text-xs text-mk-ter">Balooh SRL · TVA: BE 1005.771.323</p>
            <p className="text-xs text-mk-ter">23 rue de la Procession, B-7822 Ath</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">{t("footer.solutions")}</h4>
            {[
              { label: t("footer.catalog"), to: "/categories" },
              { label: t("footer.supplierVerification"), to: "/verification-fournisseurs" },
              { label: t("footer.qualityGuarantee"), to: "/garantie-qualite" },
              { label: t("footer.howToOrder"), to: "/comment-commander" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">{t("footer.howWeWork")}</h4>
            {[
              { label: t("footer.logistics"), to: "/logistique" },
              { label: t("footer.deferredPayment"), to: "/paiement-differe" },
              { label: t("footer.becomeSeller"), to: "/devenir-vendeur" },
              { label: t("footer.testimonials"), to: "/temoignages" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">{t("footer.company")}</h4>
            {[
              { label: t("footer.about"), to: "/entreprise/a-propos" },
              { label: t("footer.team"), to: "/entreprise/equipe" },
              { label: t("footer.invest"), to: "/invest" },
              { label: t("footer.contact"), to: "/contact" },
              { label: t("footer.helpCenter"), to: "/centre-aide" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-mk-navy mb-3">{t("footer.legal")}</h4>
            {[
              { label: t("footer.legalNotice"), to: "/mentions-legales" },
              { label: t("footer.terms"), to: "/cgv" },
              { label: t("footer.privacy"), to: "/politique-confidentialite" },
              { label: t("footer.cookies"), to: "/cookies" },
            ].map(l => (
              <Link key={l.to} to={l.to} className="block text-sm text-mk-sec hover:text-mk-blue mb-2">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-mk-line py-4">
        <div className="mk-container flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-mk-ter">
          <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start">
            <span className="text-center md:text-left">{t("footer.copyright", { year: new Date().getFullYear() })}</span>
            <button className="flex items-center gap-1.5 text-mk-ter hover:text-mk-blue transition-colors">
              <Globe size={14} />
              <span>{LANGUAGE_CONFIG[currentLang].nativeName} ({LANGUAGE_CONFIG[currentLang].region})</span>
            </button>
          </div>
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
