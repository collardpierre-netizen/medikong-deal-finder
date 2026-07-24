import { Helmet } from "react-helmet-async";
import { ShieldCheck, FileCheck2, BadgeCheck, ScrollText, Truck, Building2, type LucideIcon } from "lucide-react";

/**
 * Page publique /confiance — traçabilité & confiance MediKong.
 *
 * Contenu factuel : ce que MediKong vérifie côté vendeur, quel document
 * régit chaque relation, quelle garantie s'applique. Aucune mention
 * marketing type "garantie MediKong 100 %".
 */
export default function ConfiancePage() {
  return (
    <>
      <Helmet>
        <title>Traçabilité & Confiance — MediKong</title>
        <meta
          name="description"
          content="Comment MediKong vérifie ses vendeurs, encadre la facturation self-billing et applique la garantie légale européenne de conformité (2 ans)."
        />
      </Helmet>

      <div className="mk-container py-10 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold text-mk-navy tracking-tight">
          Traçabilité &amp; Confiance
        </h1>
        <p className="mt-3 text-muted-foreground">
          MediKong est une marketplace B2B opérée par MediKong SRL (BE 1005.771.323).
          Cette page documente, sans marketing, comment nous vérifions les vendeurs, comment
          les factures sont émises et quelle garantie s'applique à vos achats.
        </p>

        <section className="mt-8 space-y-6">
          <TrustBlock
            icon={BadgeCheck}
            title="Distributeur autorisé"
            body="Avant de publier une offre active, chaque vendeur déclare être distributeur autorisé pour les marques qu'il référence. Cette déclaration est visible sous chaque offre. Un contrôle de cohérence par marque est réalisé par notre équipe et, le cas échéant, formalisé via des autorisations de marque enregistrées (référence de document + période de validité)."
          />

          <TrustBlock
            icon={ShieldCheck}
            title="KYC vendeur"
            body="Nous collectons et vérifions les documents d'identité et d'entreprise (RCS/BCE, TVA, représentant légal). Un vendeur dont le KYC n'est pas complété ne peut pas encaisser de commande."
          />

          <TrustBlock
            icon={FileCheck2}
            title="Mandat de facturation (self-billing)"
            body="Chaque vendeur signe un mandat de facturation autorisant MediKong SRL à émettre la facture « au nom et pour le compte de » son entreprise. La facture porte donc le nom, l'adresse et le numéro de TVA du vendeur, avec la mention légale correspondante, et est transmise le cas échéant via le réseau Peppol. Aucune offre ne peut être publiée sans mandat actif."
          />

          <TrustBlock
            icon={ScrollText}
            title="Garantie légale européenne de conformité — 2 ans"
            body="Les produits vendus sur MediKong bénéficient de la garantie légale européenne de conformité de 2 ans. Le vendeur reste responsable de la conformité, du SAV et du remboursement en cas de produit non conforme, conformément à la législation applicable dans son pays d'établissement."
          />

          <TrustBlock
            icon={Truck}
            title="Livraison &amp; SAV"
            body="Chaque commande précise le vendeur expéditeur, le mode d'expédition et le délai indicatif. Le SAV est assuré par le vendeur ; MediKong assiste l'acheteur en cas de litige et peut retenir les fonds jusqu'à résolution."
          />

          <TrustBlock
            icon={Building2}
            title="Émetteur légal"
            body="MediKong est édité par MediKong SRL, 23 rue de la Procession, 7822 Ath (Belgique) — TVA BE 1005.771.323. Les mentions légales, CGU, CGV et politique de confidentialité sont accessibles en pied de page."
          />
        </section>
      </div>
    </>
  );
}

function TrustBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
