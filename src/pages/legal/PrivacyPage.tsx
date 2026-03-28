import { LegalContent } from "@/components/legal/LegalContent";

export default function PrivacyPage() {
  return (
    <LegalContent title="Politique de confidentialité" lastUpdated="28 mars 2026">
      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">1. Responsable du traitement</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Le responsable du traitement des données personnelles est Balooh SRL, 23 rue de la Procession, B-7822 Ath, Belgique. BCE : 1005.771.323.
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">2. Données collectées</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Nous collectons les catégories de données suivantes :</p>
      <ul className="ml-6 mt-3 mb-5 space-y-1.5">
        <li className="text-sm text-muted-foreground leading-[1.8]"><strong>Données d'identification</strong> : nom, prénom, email, téléphone</li>
        <li className="text-sm text-muted-foreground leading-[1.8]"><strong>Données professionnelles</strong> : entreprise, numéro BCE, numéro TVA, fonction</li>
        <li className="text-sm text-muted-foreground leading-[1.8]"><strong>Données de commande</strong> : historique d'achats, panier, adresses de livraison</li>
        <li className="text-sm text-muted-foreground leading-[1.8]"><strong>Données techniques</strong> : adresse IP, navigateur, cookies, données de navigation</li>
      </ul>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">3. Finalités du traitement</h2>
      <ul className="ml-6 mt-3 mb-5 space-y-1.5">
        <li className="text-sm text-muted-foreground leading-[1.8]">Gestion de votre compte et identification</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Traitement des commandes et facturation</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Vérification BCE et conformité réglementaire</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Communications commerciales (avec consentement)</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Amélioration de nos services et analyses statistiques</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Respect des obligations légales</li>
      </ul>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">4. Base légale</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Le traitement de vos données repose sur les bases légales suivantes (Art. 6.1 RGPD) : votre consentement (a), l'exécution d'un contrat (b), le respect d'obligations légales (c) et nos intérêts légitimes (f).
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">5. Durée de conservation</h2>
      <ul className="ml-6 mt-3 mb-5 space-y-1.5">
        <li className="text-sm text-muted-foreground leading-[1.8]">Données de compte : durée de vie du compte + 5 ans</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Données de navigation : 13 mois maximum</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Données de facturation : 10 ans (obligation légale belge)</li>
      </ul>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">6. Destinataires des données</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Vos données peuvent être partagées avec : les vendeurs de la marketplace (uniquement les données nécessaires à l'exécution de la commande), nos prestataires techniques, les autorités compétentes (sur demande légale) et notre partenaire Mondu (en cas de paiement différé).
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">7. Vos droits</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul className="ml-6 mt-3 mb-5 space-y-1.5">
        <li className="text-sm text-muted-foreground leading-[1.8]">Droit d'accès à vos données</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Droit de rectification</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Droit à l'effacement (« droit à l'oubli »)</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Droit à la limitation du traitement</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Droit à la portabilité</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Droit d'opposition</li>
      </ul>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Pour exercer vos droits, contactez-nous à : <strong>privacy@medikong.pro</strong>
      </p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">8. Autorité de contrôle</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">
        Vous avez le droit d'introduire une réclamation auprès de l'Autorité de protection des données (APD), rue de la Presse 35, 1000 Bruxelles. Site web : www.autoriteprotectiondonnees.be
      </p>
    </LegalContent>
  );
}
