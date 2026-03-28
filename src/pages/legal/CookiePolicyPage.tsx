import { LegalContent } from "@/components/legal/LegalContent";
import { CookieTable } from "@/components/legal/CookieTable";
import { essentialCookies, analyticsCookies, marketingCookies } from "@/data/legal-data";
import { Link } from "react-router-dom";

export default function CookiePolicyPage() {
  return (
    <LegalContent title="Politique de cookies" lastUpdated="28 mars 2026">
      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Qu'est-ce qu'un cookie ?</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Un cookie est un petit fichier texte stocké sur votre appareil lorsque vous visitez un site web. Les cookies nous permettent de reconnaître votre navigateur et de mémoriser certaines informations pour améliorer votre expérience.
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Cookies essentiels</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Ces cookies sont nécessaires au fonctionnement du site. Ils ne peuvent pas être désactivés.
      </p>
      <CookieTable cookies={essentialCookies} />

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Cookies analytiques</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Ces cookies nous aident à comprendre comment les visiteurs utilisent notre site, ce qui nous permet de l'améliorer.
      </p>
      <CookieTable cookies={analyticsCookies} />

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Cookies marketing</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Ces cookies sont utilisés pour suivre les visiteurs sur les sites web afin de proposer des publicités pertinentes.
      </p>
      <CookieTable cookies={marketingCookies} />

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Gérer vos préférences</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Vous pouvez modifier vos préférences de cookies à tout moment en cliquant sur le bouton ci-dessous ou en ajustant les paramètres de votre navigateur.
      </p>
      <button className="px-6 py-3 bg-mk-navy text-white text-sm font-semibold rounded-xl hover:bg-mk-navy/90 transition-colors mb-6">
        ⚙️ Gérer mes cookies
      </button>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Plus d'informations</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Pour plus d'informations sur les cookies et la protection de vos données, vous pouvez consulter le site de l'<a href="https://www.autoriteprotectiondonnees.be" target="_blank" rel="noopener noreferrer" className="text-mk-blue hover:underline">Autorité de protection des données (APD)</a> ou notre <Link to="/politique-confidentialite" className="text-mk-blue hover:underline">Politique de confidentialité</Link>.
      </p>
    </LegalContent>
  );
}
