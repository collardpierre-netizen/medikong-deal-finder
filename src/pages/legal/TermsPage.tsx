import { LegalContent } from "@/components/legal/LegalContent";

export default function TermsPage() {
  return (
    <LegalContent title="Conditions Générales de Vente" lastUpdated="28 mars 2026">
      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 1 — Objet</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Les présentes conditions générales de vente régissent les relations contractuelles entre Balooh SRL (ci-après « MediKong ») et tout acheteur professionnel inscrit sur la plateforme MediKong.pro.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 2 — Inscription et accès</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">L'accès à la marketplace est réservé aux professionnels de santé disposant d'un numéro BCE et d'un numéro de TVA intracommunautaire valide. L'inscription est gratuite et soumise à validation.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 3 — Commandes</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">MediKong agit en qualité d'intermédiaire entre les acheteurs et les vendeurs. Chaque commande constitue un contrat de vente entre l'acheteur et le vendeur concerné. MediKong n'est pas partie à ce contrat.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 4 — Prix et paiement</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Les prix sont affichés hors TVA (HT) par défaut. La TVA est calculée au checkout selon le taux applicable. Moyens de paiement acceptés : Visa, Mastercard, Bancontact, virement SEPA, Mondu (paiement différé 30/60 jours).</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 5 — Livraison</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Les commandes sont expédiées sous 24-48h. Le délai de livraison maximal est de 5 jours ouvrables en Belgique. Les frais de livraison sont indiqués au moment du checkout.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 6 — Droit de rétractation</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Conformément à la législation B2B belge, les achats professionnels ne bénéficient pas du droit de rétractation. Toutefois, en cas de produit non conforme, l'acheteur dispose de 14 jours pour signaler le problème.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 7 — Garantie</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">MediKong offre une garantie de 14 jours sur la conformité des produits livrés. En cas de non-conformité avérée, le retour et le remboursement sont pris en charge.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 8 — Responsabilité</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">En tant que marketplace, MediKong agit comme intermédiaire technique et ne peut être tenu responsable des produits vendus par les vendeurs tiers. MediKong s'engage cependant à vérifier l'identité et la conformité de chaque vendeur.</p>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 9 — Commissions vendeurs</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Les commissions sont dégressives selon le volume de ventes :</p>
      <ul className="ml-6 mt-3 mb-5 space-y-1.5">
        <li className="text-sm text-muted-foreground leading-[1.8]">Bronze : 14% (0 – 5 000 €/mois)</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Silver : 13% (5 000 – 15 000 €/mois)</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Gold : 12% (15 000 – 50 000 €/mois)</li>
        <li className="text-sm text-muted-foreground leading-[1.8]">Platinum : 10% (50 000 €+/mois)</li>
      </ul>

      <h2 className="text-2xl font-bold text-mk-navy mt-10 mb-4">Article 10 — Loi applicable</h2>
      <p className="text-sm text-muted-foreground leading-[1.8] mb-4">Les présentes CGV sont soumises au droit belge. Tout litige sera soumis aux tribunaux de l'arrondissement de Tournai.</p>
    </LegalContent>
  );
}
