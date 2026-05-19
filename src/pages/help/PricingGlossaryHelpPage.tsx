import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Tag, BarChart3, ShoppingBag, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
