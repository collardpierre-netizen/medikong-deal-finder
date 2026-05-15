import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Package, Calculator, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PricingBasisHelpPage() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <Helmet>
        <title>Aide : packs et €/100 — MediKong</title>
        <meta
          name="description"
          content="Comprendre les bases de comparaison de prix sur MediKong : €/pack, €/unité et €/100 unités, avec les formules détaillées."
        />
        <link rel="canonical" href="https://medikong.pro/aide/packs-et-prix-100" />
      </Helmet>

      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/centre-aide">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Centre d'aide
        </Link>
      </Button>

      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Packs, unités et €/100 : comment lire les prix
      </h1>
      <p className="text-muted-foreground mb-8">
        Sur chaque fiche produit, vous pouvez basculer entre trois bases de
        comparaison. Voici exactement ce qu'elles représentent et comment elles
        sont calculées.
      </p>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              €/pack — le prix tel qu'il est vendu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              C'est le prix total du conditionnement vendu, exactement comme
              affiché par le vendeur ou la source externe. La{" "}
              <strong>taille du pack</strong> indique combien d'unités
              (flacons, boîtes, capsules, ml…) sont contenues dans ce
              conditionnement.
            </p>
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              Exemple : pack de 4 flacons à 12,00 € → €/pack = 12,00 €
            </p>
            <p>
              La taille du pack provient en priorité d'une valeur définie sur
              l'offre, sinon de la fiche produit, sinon d'une détection
              automatique sur le libellé (ex. « 4×125 ml », « 30 caps »).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              €/unité — pour comparer à pack égal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Le prix unitaire ramène le pack à une seule unité contenue. Utile
              pour comparer deux offres avec des conditionnements différents.
            </p>
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              €/unité = €/pack ÷ taille du pack
              <br />
              Exemple : 12,00 € ÷ 4 = 3,00 € / unité
            </p>
            <p>
              Si la taille du pack n'est pas connue, la base unité retombe sur
              le prix pack (équivalent à un pack de 1).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-primary" />
              €/100 u. — la base normalisée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Standard utilisé en pharmacie et grande distribution pour
              comparer rapidement des produits aux conditionnements très
              variables.
            </p>
            <p className="rounded-md bg-muted p-3 font-mono text-xs text-foreground">
              €/100 u. = €/unité × 100
              <br />
              Exemple : 3,00 € × 100 = 300,00 € / 100 unités
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Où s'applique la base sélectionnée ?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Le sélecteur affiché en haut de chaque bloc (Marketplace, Offres
              externes, Prix marché) modifie en temps réel :
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>les prix affichés sur les cartes d'offres,</li>
              <li>les écarts et économies calculés,</li>
              <li>le calculateur de marge.</li>
            </ul>
            <p>
              Votre choix est mémorisé dans votre navigateur et restauré à la
              prochaine visite.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
