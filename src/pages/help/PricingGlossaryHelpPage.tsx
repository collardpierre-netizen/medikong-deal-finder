import type * as React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Tag, BarChart3, ShoppingBag, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_ITEMS: { q: string; a: React.ReactNode; plain: string }[] = [
  {
    q: "Quelle est la différence entre PVP conseillé et prix marché ?",
    plain:
      "Le PVP conseillé est le prix public TTC recommandé pour la vente au comptoir (source APB/PMR ou fabricant). Le prix marché est le prix HTVA médian observé chez les autres grossistes B2B (Febelco, CERP, Medi-Market, Qogita). Le premier sert à calculer votre marge de revente, le second à benchmarker votre prix d'achat.",
    a: (
      <>
        <p>
          Le <strong>PVP conseillé</strong> est un prix <strong>TTC</strong>{" "}
          destiné au consommateur final (source APB / PMR ou fabricant).
          Vous l'utilisez pour calculer votre marge de revente.
        </p>
        <p>
          Le <strong>prix marché</strong> est un prix <strong>HTVA</strong>{" "}
          médian observé chez les autres grossistes B2B (Febelco, CERP,
          Medi-Market, Qogita…). Vous l'utilisez pour vérifier que votre
          prix d'achat MediKong est compétitif.
        </p>
      </>
    ),
  },
  {
    q: "HTVA ou TTC : quel prix vois-je par défaut sur MediKong ?",
    plain:
      "Par défaut, MediKong affiche tous les prix HTVA car la plateforme est strictement B2B. Un toggle HTVA/TTC est disponible sur la fiche produit pour basculer l'affichage. Le panier et le checkout affichent toujours le détail HTVA + TVA + TTC.",
    a: (
      <>
        <p>
          MediKong est une plateforme <strong>strictement B2B</strong> : par
          défaut, les prix de vente, MOV et économies sont affichés{" "}
          <strong>HTVA</strong>.
        </p>
        <p>
          Sur la fiche produit, un toggle <code>HTVA / TTC</code> permet de
          basculer l'affichage. Le panier et le checkout détaillent
          systématiquement HTVA + TVA + TTC.
        </p>
      </>
    ),
  },
  {
    q: "Comment savoir si un produit est à 6 % ou 21 % de TVA ?",
    plain:
      "La TVA est résolue automatiquement par MediKong selon la règle : override produit > CNK exact > préfixe CNK > catégorie > fallback 21 %. Les médicaments enregistrés sont à 6 %, la parapharmacie / OTC à 21 % en Belgique. Le taux appliqué est visible dans le détail du prix (panier, checkout, fiche produit).",
    a: (
      <>
        <p>
          MediKong applique la TVA belge :{" "}
          <strong>6 % pour les médicaments enregistrés</strong> et{" "}
          <strong>21 % pour la parapharmacie / OTC</strong>.
        </p>
        <p>
          La résolution est automatique selon l'ordre : override produit
          &gt; CNK exact &gt; préfixe CNK &gt; catégorie &gt; fallback 21 %.
          Le taux appliqué apparaît dans le détail du prix (panier,
          checkout, ligne facture).
        </p>
      </>
    ),
  },
  {
    q: "Comment lire les remises (–X %) affichées sur les produits ?",
    plain:
      "Le pourcentage de remise compare le prix MediKong HTVA à un prix de référence : PVP conseillé converti en HTVA, ou prix marché HTVA médian, selon le toggle 'Prix de référence' sur la page Bonnes affaires. Sur la fiche produit, le badge 'PVP économie' montre l'écart en € et en % entre votre prix d'achat HTVA et le PVP TTC.",
    a: (
      <>
        <p>
          Le pourcentage de remise compare le <strong>prix MediKong HTVA</strong>{" "}
          à un prix de référence configurable :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>PVP conseillé (converti en HTVA pour rester comparable)</li>
          <li>ou prix marché HTVA médian (autres grossistes B2B)</li>
        </ul>
        <p>
          Sur la page <Link to="/bonnes-affaires" className="text-primary underline">Bonnes affaires</Link>{" "}
          vous pouvez basculer entre les deux références. Sur la fiche
          produit, le badge « PVP économie » montre directement l'écart en
          € et en % entre votre achat et le PVP.
        </p>
      </>
    ),
  },
  {
    q: "Une promo flash modifie-t-elle le PVP ou seulement le prix MediKong ?",
    plain:
      "Une promo flash réduit uniquement le prix MediKong HTVA pendant la durée de l'opération. Le PVP conseillé reste inchangé : il sert toujours de référence officielle pour la revente au comptoir. La promo augmente donc mécaniquement votre marge brute sur le produit concerné.",
    a: (
      <>
        <p>
          Une promo flash réduit <strong>uniquement le prix MediKong HTVA</strong>{" "}
          pendant la durée de l'opération.
        </p>
        <p>
          Le PVP conseillé reste <strong>inchangé</strong> : il sert toujours
          de référence officielle pour la revente au comptoir. Votre marge
          brute augmente donc mécaniquement pendant la promo.
        </p>
      </>
    ),
  },
  {
    q: "Pourquoi le prix par unité (€/u.) diffère du prix affiché ?",
    plain:
      "Le prix affiché par défaut est le prix par pack (l'unité d'achat). Le €/u. divise ce prix par le nombre d'unités contenues dans le pack (ex. 4×125 ml = 4 unités) pour comparer plus facilement deux conditionnements différents. Le €/100u. normalise sur 100 unités pour les très petits formats.",
    a: (
      <>
        <p>
          Le prix par défaut est le <strong>prix par pack</strong> (l'unité
          d'achat livrée). MediKong propose deux normalisations
          complémentaires :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>€/u.</strong> : prix divisé par le nombre d'unités
            contenues dans le pack (ex. 4×125 ml = 4 unités).
          </li>
          <li>
            <strong>€/100u.</strong> : prix normalisé sur 100 unités, utile
            pour comparer des très petits formats.
          </li>
        </ul>
        <p>
          Voir aussi :{" "}
          <Link to="/aide/packs-et-prix-100" className="text-primary underline">
            Packs, unités et €/100
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    q: "« Votre prix » vs prix vitrine : que signifie ce badge ?",
    plain:
      "Le badge 'Votre prix' indique qu'un prix spécifique a été résolu pour votre profil professionnel (pharmacien, parapharmacie, grossiste…) ou qu'un vendeur a configuré un tarif différencié pour votre catégorie d'acheteur. Le prix vitrine est le prix HTVA par défaut visible par tous les acheteurs vérifiés.",
    a: (
      <>
        <p>
          Le badge <strong>« Votre prix »</strong> indique qu'un tarif
          spécifique a été résolu pour votre profil professionnel
          (pharmacien, parapharmacie, grossiste…) — soit par défaut global
          MediKong, soit configuré par le vendeur pour votre catégorie.
        </p>
        <p>
          Le <strong>prix vitrine</strong> est le prix HTVA par défaut
          visible par tous les acheteurs vérifiés sans condition de profil.
        </p>
      </>
    ),
  },
];

export default function PricingGlossaryHelpPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Glossaire des prix : PVP, prix marché, prix public — MediKong</title>
        <meta
          name="description"
          content="Comprendre les différentes notions de prix sur MediKong : PVP conseillé, prix marché HTVA et prix public TTC, avec exemples concrets."
        />
        <link rel="canonical" href="https://medikong.pro/aide/glossaire-prix" />
        <link rel="canonical" href="https://medikong.pro/aide/glossaire-prix" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((it) => ({
              "@type": "Question",
              name: it.q,
              acceptedAnswer: { "@type": "Answer", text: it.plain },
            })),
          })}
        </script>
      </Helmet>


      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/centre-aide">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Centre d'aide
        </Link>
      </Button>

      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Glossaire des prix : PVP, prix marché, prix public
      </h1>
      <p className="text-muted-foreground mb-8">
        Sur MediKong, plusieurs notions de prix coexistent. Voici à quoi
        elles correspondent exactement, et comment les lire dans une fiche
        produit.
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-primary" />
              PVP conseillé — Prix de Vente Public conseillé (TTC)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              C'est le <strong>prix public TTC officiel</strong> recommandé
              pour la vente au comptoir (pharmacie, parapharmacie). Il sert
              de référence pour calculer votre marge de revente.
            </p>
            <p>
              Source : bases officielles APB / PMR pour les médicaments, ou
              valeur communiquée par le fabricant / distributeur officiel
              pour les autres produits.
            </p>
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              Exemple : Dafalgan 500 mg 30 cp<br />
              PVP conseillé = 4,95 € TTC (APB)<br />
              → c'est ce que paye un patient au comptoir
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Prix marché (HTVA) — référence d'achat B2B
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Prix <strong>HTVA médian</strong> observé chez les autres
              grossistes et plateformes B2B (Febelco, CERP, Medi-Market,
              Qogita…). C'est la veille concurrentielle agrégée par MediKong
              pour vous indiquer le niveau de prix d'achat habituel pour un
              professionnel.
            </p>
            <p>
              Utilisé pour : positionner les offres MediKong, calculer
              l'écart « Prix marché vs MediKong », alimenter le cockpit
              admin et les alertes vendeurs.
            </p>
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              Exemple : même Dafalgan 500 mg 30 cp<br />
              Febelco 2,40 € · CERP 2,45 € · Medi-Market 2,38 €<br />
              → Prix marché = 2,40 € HTVA (médiane)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Prix public TTC — ce que paye le client final
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Terme générique pour désigner un prix <strong>toutes taxes
              comprises</strong> destiné au consommateur. Sur MediKong, le
              prix public TTC se confond le plus souvent avec le PVP
              conseillé quand il existe une source officielle, ou avec le
              prix de vente conseillé du fabricant pour les autres gammes.
            </p>
            <p>
              Il inclut la TVA applicable :{" "}
              <strong>6 %</strong> pour les médicaments,{" "}
              <strong>21 %</strong> pour la parapharmacie / OTC en
              Belgique.
            </p>
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              Exemple : un complément alimentaire à 12,00 € HTVA<br />
              + TVA 21 % = 2,52 €<br />
              → Prix public TTC = 14,52 €
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Récapitulatif — un même produit, trois prix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Pour un Dafalgan 500 mg 30 cp en Belgique, vous verrez par
              exemple :
            </p>
            <ul className="space-y-2">
              <li className="flex justify-between gap-4 border-b pb-2">
                <span><strong>Prix MediKong</strong> (votre achat HTVA)</span>
                <span className="font-mono">2,20 €</span>
              </li>
              <li className="flex justify-between gap-4 border-b pb-2">
                <span><strong>Prix marché</strong> (HTVA, médian B2B)</span>
                <span className="font-mono">2,40 €</span>
              </li>
              <li className="flex justify-between gap-4">
                <span><strong>PVP conseillé</strong> (TTC, comptoir)</span>
                <span className="font-mono">4,95 €</span>
              </li>
            </ul>
            <p className="pt-2">
              Lecture : vous achetez 8 % moins cher que le marché B2B, et
              votre marge brute potentielle face au PVP est de l'ordre de
              52 % (en tenant compte de la TVA 6 % à reverser).
            </p>
          </CardContent>
        </Card>

        <Card id="faq">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4 text-primary" />
              FAQ — Comment lire les prix sur MediKong
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`}>
                  <AccordionTrigger className="text-left text-sm font-medium">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voir aussi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <Link to="/aide/packs-et-prix-100" className="text-primary underline">
                  Packs, unités et €/100 — comment lire les prix
                </Link>
              </li>
              <li>
                <Link to="/centre-aide" className="text-primary underline">
                  Retour au centre d'aide
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
