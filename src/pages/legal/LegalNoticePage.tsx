import { LegalContent } from "@/components/legal/LegalContent";
import { Link } from "react-router-dom";

export default function LegalNoticePage() {
  return (
    <LegalContent title="Mentions légales" lastUpdated="28 mars 2026">
      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">1. Éditeur du site</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Le site MediKong.pro est édité par <strong>Balooh SRL</strong>, société de droit belge inscrite à la Banque-Carrefour des Entreprises sous le numéro BCE 1005.771.323.
      </p>
      <ul className="ml-6 mt-3 mb-5 space-y-1.5">
        <li className="text-sm text-muted-foreground leading-[1.8]">Siège social : 23 rue de la Procession, B-7822 Ath, Belgique</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">TVA : BE 1005.771.323</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Email : contact@medikong.pro</li>
      </ul>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">2. Directeur de la publication</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Le directeur de la publication est le gérant de la société Balooh SRL.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">3. Hébergement</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">4. Propriété intellectuelle</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        L'ensemble du contenu du site (textes, images, logos, marques, code source) est protégé par le droit d'auteur et le droit des marques. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">5. Données personnelles</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Pour en savoir plus sur la collecte et le traitement de vos données, consultez notre <Link to="/politique-confidentialite" className="text-mk-blue hover:underline">Politique de confidentialité</Link>.
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">6. Cookies</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Ce site utilise des cookies. Pour en savoir plus, consultez notre <Link to="/cookies" className="text-mk-blue hover:underline">Politique de cookies</Link>.
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">7. Loi applicable</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Le présent site est soumis au droit belge. En cas de litige, les tribunaux de l'arrondissement de Tournai seront seuls compétents.
      </p>
    </LegalContent>
  );
}
