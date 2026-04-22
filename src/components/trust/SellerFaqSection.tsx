import { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  UserPlus,
  Banknote,
  FileText,
  Package,
  Boxes,
  MessageSquare,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type FaqItem = {
  id: string;
  q: string;
  a: React.ReactNode;
  searchText: string;
};

type FaqCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  important?: boolean;
  intro?: string;
  items: FaqItem[];
};

const Callout = ({ children }: { children: React.ReactNode }) => (
  <div className="my-3 border-l-4 border-primary bg-primary/5 rounded-r-md px-4 py-3 text-sm text-foreground/90">
    {children}
  </div>
);

const CATEGORIES: FaqCategory[] = [
  {
    id: "inscription",
    label: "Inscription",
    icon: UserPlus,
    items: [
      {
        id: "qui-peut-vendre",
        q: "Qui peut vendre sur MediKong ?",
        searchText:
          "professionnels médical paramédical grossistes distributeurs fabricants dispositifs médicaux EPI BCE TVA",
        a: (
          <p>
            MediKong est réservé aux professionnels du secteur médical et paramédical : grossistes,
            distributeurs, fabricants de dispositifs médicaux, fournisseurs de produits paramédicaux,
            d'hygiène professionnelle, d'EPI, de matériel de soins, de mobilier médical. Vous devez
            disposer d'un numéro d'entreprise valide (BCE en Belgique, équivalent européen ailleurs)
            et être assujetti à la TVA.
          </p>
        ),
      },
      {
        id: "cout-inscription",
        q: "Combien coûte l'inscription ?",
        searchText: "gratuit abonnement frais commission 20% HTVA",
        a: (
          <>
            <p>
              <strong>L'inscription est 100% gratuite.</strong> Aucun abonnement mensuel, aucun frais
              fixe, aucun frais caché. MediKong se rémunère uniquement à la commission sur les ventes
              réalisées (20% HTVA).
            </p>
          </>
        ),
      },
      {
        id: "documents-necessaires",
        q: "Quels documents sont nécessaires ?",
        searchText: "BCE K-bis TVA mandat facturation marquage CE AFMPS RIB",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Extrait BCE (ou K-bis / équivalent européen)</li>
            <li>Attestation d'assujettissement TVA</li>
            <li>Convention de mandat de facturation signée (fournie par MediKong)</li>
            <li>
              Certifications spécifiques selon vos produits (marquage CE pour dispositifs médicaux,
              autorisation AFMPS pour distribution pharmaceutique, etc.)
            </li>
            <li>RIB professionnel pour les reversements</li>
          </ul>
        ),
      },
      {
        id: "delai-validation",
        q: "Combien de temps prend la validation ?",
        searchText: "délai validation 2 5 jours ouvrables conformité",
        a: (
          <p>
            2 à 5 jours ouvrables après réception du dossier complet. Nous vérifions la conformité
            réglementaire, la qualité des fiches produits et l'éligibilité du vendeur avant
            activation.
          </p>
        ),
      },
    ],
  },
  {
    id: "commission",
    label: "Commission & paiement",
    icon: Banknote,
    items: [
      {
        id: "taux-commission",
        q: "Quelle est la commission prélevée ?",
        searchText: "20% HTVA commission marketing paiement support",
        a: (
          <p>
            <strong>20% HTVA sur chaque vente.</strong> Cette commission couvre : l'hébergement du
            catalogue, l'acquisition client, le marketing, le traitement des paiements, l'émission
            des factures en votre nom, le support de premier niveau et la médiation en cas de
            litige.
          </p>
        ),
      },
      {
        id: "fixer-prix",
        q: "Comment fixer mes prix ?",
        searchText: "prix HTVA TTC client final calcul 0,80",
        a: (
          <>
            <p>
              Vous fixez librement vos prix de vente HTVA. Le prix affiché au client est votre prix
              TTC client final, commission intégrée.
            </p>
            <Callout>
              <strong>Exemple :</strong> pour encaisser 100 € net, affichez 125 € HTVA (calcul :
              100 € ÷ 0,80).
            </Callout>
          </>
        ),
      },
      {
        id: "quand-paye",
        q: "Quand et comment suis-je payé ?",
        searchText: "J+15 reversement SEPA virement décompte",
        a: (
          <p>
            <strong>Reversement à J+15 après confirmation de livraison</strong>, par virement SEPA
            sur votre compte professionnel. Vous recevez un décompte détaillé par période (ventes
            brutes, commissions, TVA, net versé) disponible dans votre espace vendeur.
          </p>
        ),
      },
      {
        id: "frais-caches",
        q: "Y a-t-il des frais cachés ?",
        searchText: "Stripe frais cachés inscription abonnement transaction",
        a: (
          <p>
            Non. La commission de 20% HTVA inclut les frais de paiement Stripe. Pas de frais
            d'inscription, pas d'abonnement, pas de frais par transaction supplémentaires.
          </p>
        ),
      },
    ],
  },
  {
    id: "facturation",
    label: "Facturation & TVA",
    icon: FileText,
    important: true,
    intro:
      "Le modèle MediKong repose sur un mandat de facturation. Voici ce que ça change concrètement pour votre comptabilité et votre TVA.",
    items: [
      {
        id: "facture-client-final",
        q: "Est-ce que j'émets la facture au client final ?",
        searchText: "mandat facturation autofacturation article 53 §2 Code TVA belge",
        a: (
          <p>
            <strong>Non.</strong> MediKong fonctionne en mandat de facturation (autofacturation,
            article 53 §2 du Code TVA belge). C'est MediKong qui émet la facture <strong>au nom et
            pour votre compte</strong>, directement au client final. Cette facture a la même valeur
            juridique et fiscale que si vous l'aviez émise vous-même — elle EST votre facture.
          </p>
        ),
      },
      {
        id: "double-facturation",
        q: "Pourquoi ne dois-je surtout pas émettre ma propre facture en parallèle ?",
        searchText: "double facturation TVA contrôle fiscal irrégularité",
        a: (
          <>
            <p>
              Parce que ce serait une <strong>double facturation</strong> de la même opération.
              Juridiquement, la facture émise par MediKong est déjà votre facture. Émettre un second
              document depuis votre système créerait :
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Une double collecte de TVA (irrégularité fiscale)</li>
              <li>Une non-déductibilité pour le client final</li>
              <li>Un risque majeur en cas de contrôle TVA</li>
            </ul>
          </>
        ),
      },
      {
        id: "ecriture-comptable",
        q: "Comment je justifie alors la sortie de marchandise et l'écriture comptable ?",
        searchText:
          "bon livraison interne facturier sortie Peppol XML commission TVA récupérable",
        a: (
          <>
            <p>Voici le flux à mettre en place :</p>
            <ol className="list-decimal pl-5 space-y-3 mt-2">
              <li>
                <strong>Sortie de stock</strong> : vous émettez un simple <strong>bon de livraison
                interne</strong> (document de gestion, sans mentions TVA, sans numérotation de
                facturation) pour accompagner le colis et tracer le mouvement physique dans votre
                compta matière.
              </li>
              <li>
                <strong>Enregistrement comptable</strong> : MediKong vous transmet le double de la
                facture (via Peppol si votre système est raccordé, sinon par email avec PDF +
                fichier XML structuré). Vous l'enregistrez dans votre <strong>facturier de
                sortie</strong> en conservant la numérotation MediKong. C'est votre chiffre
                d'affaires, votre TVA à déclarer.
              </li>
              <li>
                <strong>Commission MediKong</strong> : facture séparée pour les 20% de commission, à
                enregistrer dans votre facturier d'entrée (TVA récupérable).
              </li>
            </ol>
          </>
        ),
      },
      {
        id: "convention-mandat",
        q: "Qu'est-ce que la convention de mandat de facturation ?",
        searchText: "convention mandat facturation article 53 CTVA signature électronique",
        a: (
          <p>
            Document obligatoire signé entre vous et MediKong <strong>avant la première vente</strong>
            {" "}(exigence légale article 53 §2 CTVA). Il autorise MediKong à émettre des factures en
            votre nom et précise : périmètre du mandat, procédure d'acceptation/contestation, canal
            de transmission du double, obligations TVA respectives. Modèle fourni lors de
            l'onboarding, signature électronique.
          </p>
        ),
      },
      {
        id: "qui-declare-tva",
        q: "Qui déclare et reverse la TVA au fisc ?",
        searchText: "déclaration TVA SPF Finances assujetti mandataire",
        a: (
          <p>
            <strong>Vous.</strong> MediKong facture en votre nom, mais vous restez l'assujetti TVA :
            vous déclarez cette TVA dans vos déclarations périodiques et la reversez au SPF
            Finances. MediKong n'est qu'un mandataire technique, pas un substitut fiscal.
          </p>
        ),
      },
      {
        id: "double-facture",
        q: "Comment je reçois le double de la facture ?",
        searchText: "Peppol BIS 3.0 EN 16931 PDF XML email espace vendeur CSV",
        a: (
          <>
            <p>Trois canaux simultanés :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Via Peppol</strong> (format EN 16931 / Peppol BIS 3.0) si votre système est
                raccordé — chargement automatique dans votre logiciel de compta
              </li>
              <li>
                <strong>Par email</strong> : PDF lisible + fichier XML structuré joint
              </li>
              <li>
                <strong>Dans votre espace vendeur MediKong</strong> : consultation + export CSV/XML à
                tout moment pour votre comptable
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "contester-facture",
        q: "Puis-je contester une facture émise en mon nom ?",
        searchText: "contestation facture 5 jours ouvrables erreur prix quantité produit TVA",
        a: (
          <p>
            Oui. Vous disposez d'un <strong>délai de 5 jours ouvrables</strong> après émission pour
            contester (erreur de prix, quantité, produit, TVA). Procédure via votre espace vendeur
            ou par email à{" "}
            <a
              href="mailto:vendor-support@medikong.pro"
              className="text-primary underline underline-offset-2"
            >
              vendor-support@medikong.pro
            </a>
            . Passé ce délai, la facture est réputée acceptée.
          </p>
        ),
      },
    ],
  },
  {
    id: "logistique",
    label: "Commandes & logistique",
    icon: Package,
    items: [
      {
        id: "recevoir-commandes",
        q: "Comment je reçois les nouvelles commandes ?",
        searchText: "notification email espace vendeur API webhook ERP WMS",
        a: (
          <p>
            Notification email instantanée + alerte dans votre espace vendeur. Intégration disponible
            avec votre ERP/WMS via API REST ou webhook pour synchronisation automatique.
          </p>
        ),
      },
      {
        id: "delai-expedition",
        q: "Quel est le délai d'expédition attendu ?",
        searchText: "48 heures ouvrables expédition retard ranking",
        a: (
          <p>
            <strong>48 heures ouvrables maximum</strong> à partir de la confirmation de commande.
            Les vendeurs présentant des retards répétés sont déclassés dans le ranking des résultats
            de recherche.
          </p>
        ),
      },
      {
        id: "gestion-livraison",
        q: "Qui gère la livraison ?",
        searchText: "transporteur tarifs zone poids franco port tracking",
        a: (
          <p>
            Le vendeur. Vous choisissez votre transporteur et configurez vos tarifs d'expédition
            (par zone géographique, par poids, franco de port à partir d'un montant). MediKong
            transmet automatiquement le numéro de tracking au client final.
          </p>
        ),
      },
      {
        id: "retours-remboursements",
        q: "Comment fonctionnent les retours et remboursements ?",
        searchText: "retour 14 jours note crédit médiation litige B2B",
        a: (
          <p>
            Le client B2B a 14 jours ouvrables pour signaler un retour (hors produits personnalisés
            ou conformes à la commande). MediKong joue le rôle de médiateur en cas de litige. Les
            remboursements sont traités via une note de crédit émise par MediKong en votre nom et
            compensée sur le prochain reversement.
          </p>
        ),
      },
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue produits",
    icon: Boxes,
    items: [
      {
        id: "ajouter-produits",
        q: "Comment ajouter mes produits ?",
        searchText: "ajout manuel CSV API REST sync stock prix",
        a: (
          <>
            <p>Trois options selon votre volume :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Ajout manuel</strong> via l'interface vendeur (moins de 50 références)
              </li>
              <li>
                <strong>Import CSV</strong> selon notre template standardisé (50 à plusieurs milliers
                de références)
              </li>
              <li>
                <strong>Synchronisation API</strong> via notre endpoint REST pour les catalogues
                dynamiques et les gros volumes (mise à jour stock / prix en temps réel)
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "moderation-fiches",
        q: "Y a-t-il une modération des fiches produits ?",
        searchText: "modération marquage CE notices allergènes 48h",
        a: (
          <p>
            Oui. Nous vérifions avant publication : conformité réglementaire (marquage CE, notices,
            allergènes, classification des dispositifs médicaux), qualité des photos, exactitude des
            fiches techniques, cohérence des prix. Validation sous 48h ouvrables.
          </p>
        ),
      },
      {
        id: "vendre-medicaments",
        q: "Puis-je vendre des médicaments sur MediKong ?",
        searchText: "médicaments AFMPS distribution gros pharmacies hôpitaux vétérinaires",
        a: (
          <p>
            Uniquement si vous êtes titulaire d'une <strong>autorisation de distribution en gros de
            médicaments délivrée par l'AFMPS</strong> (pour la Belgique), et que la vente est
            destinée à des professionnels habilités (pharmacies, hôpitaux, médecins, vétérinaires).
            Dossier réglementaire renforcé à fournir lors de l'onboarding.
          </p>
        ),
      },
    ],
  },
  {
    id: "support",
    label: "Support & litiges",
    icon: MessageSquare,
    items: [
      {
        id: "service-client",
        q: "Qui gère le service client ?",
        searchText: "support 24h vendeur 48h niveau 1 niveau 2",
        a: (
          <p>
            Premier niveau : <strong>MediKong</strong> (réponse client sous 24h ouvrables). Deuxième
            niveau (questions techniques spécifiques au produit) : transmis au vendeur concerné, qui
            s'engage à répondre sous 48h ouvrables.
          </p>
        ),
      },
      {
        id: "litige-client",
        q: "Que se passe-t-il en cas de litige avec un client ?",
        searchText: "médiation litige arbitrage 10 jours CGV vendeur",
        a: (
          <p>
            Procédure de médiation interne MediKong. Si pas de résolution amiable sous 10 jours,
            arbitrage basé sur les éléments objectifs (bon de commande, bon de livraison, preuves
            photos, échanges). MediKong tranche équitablement. Procédure complète décrite dans les
            CGV vendeur.
          </p>
        ),
      },
      {
        id: "contacter-medikong",
        q: "Comment contacter MediKong ?",
        searchText: "contact email support vendeur admin",
        a: (
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Support vendeur</strong> (opérationnel, commandes, facturation, litiges) :{" "}
              <a
                href="mailto:vendor-support@medikong.pro"
                className="text-primary underline underline-offset-2"
              >
                vendor-support@medikong.pro
              </a>
            </li>
            <li>
              <strong>Support général</strong> (clients finaux, questions produits) :{" "}
              <a
                href="mailto:support@medikong.pro"
                className="text-primary underline underline-offset-2"
              >
                support@medikong.pro
              </a>
            </li>
            <li>
              <strong>Administration</strong> (contrats, partenariats stratégiques, questions
              juridiques) :{" "}
              <a
                href="mailto:admin@medikong.pro"
                className="text-primary underline underline-offset-2"
              >
                admin@medikong.pro
              </a>
            </li>
            <li>Via votre espace vendeur : ticket de support avec suivi en temps réel</li>
          </ul>
        ),
      },
    ],
  },
];

function highlight(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  try {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "ig");
    const parts = text.split(re);
    return parts.map((part, i) =>
      re.test(part) ? (
        <mark key={i} className="bg-yellow-200/70 rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  } catch {
    return text;
  }
}

export function SellerFaqSection() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>(CATEGORIES[0].id);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});

  // Deep-linking : ouvrir l'accordion ciblé par le hash et scroller
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#faq-", "");
      if (!hash) return;
      for (const cat of CATEGORIES) {
        const found = cat.items.find((i) => i.id === hash);
        if (found) {
          setActiveCat(cat.id);
          setOpenItems((prev) => (prev.includes(found.id) ? prev : [...prev, found.id]));
          setTimeout(() => {
            const el = document.getElementById(`faq-${found.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
          break;
        }
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Par défaut : la première question de chaque catégorie est ouverte
  useEffect(() => {
    setOpenItems((prev) => {
      const firsts = CATEGORIES.map((c) => c.items[0]?.id).filter(Boolean) as string[];
      const merged = Array.from(new Set([...firsts, ...prev]));
      return merged;
    });
  }, []);

  const term = search.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!term) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) =>
          it.q.toLowerCase().includes(term) ||
          it.searchText.toLowerCase().includes(term)
      ),
    })).filter((c) => c.items.length > 0);
  }, [term]);

  // En mode recherche : ouvrir tous les résultats
  useEffect(() => {
    if (term) {
      const allMatchIds = filteredCategories.flatMap((c) => c.items.map((i) => i.id));
      setOpenItems(allMatchIds);
      if (filteredCategories.length > 0 && !filteredCategories.find((c) => c.id === activeCat)) {
        setActiveCat(filteredCategories[0].id);
      }
    }
  }, [term, filteredCategories, activeCat]);

  const visibleCat = filteredCategories.find((c) => c.id === activeCat) ?? filteredCategories[0];

  const handleFeedback = (itemId: string, value: "yes" | "no") => {
    setFeedback((prev) => ({ ...prev, [itemId]: value }));
  };

  const copyAnchor = (itemId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#faq-${itemId}`;
    window.history.replaceState(null, "", `#faq-${itemId}`);
    navigator.clipboard?.writeText(url).catch(() => {});
  };

  return (
    <section className="py-20 bg-background" id="faq-vendeurs">
      <div className="container max-w-[960px] mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Questions fréquentes des vendeurs
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Tout ce que vous devez savoir avant de rejoindre MediKong
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Rechercher une question, un mot-clé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl border-border"
            aria-label="Rechercher dans la FAQ vendeurs"
          />
        </div>

        {/* Category nav — desktop pills */}
        <div className="sticky top-16 z-20 -mx-4 px-4 mb-6 hidden md:block">
          <div className="bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 border border-border rounded-2xl p-1.5 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = visibleCat?.id === cat.id;
              const disabled = term.length > 0 && !filteredCategories.find((c) => c.id === cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    disabled && "opacity-40 cursor-not-allowed",
                    cat.important && !active && "text-amber-700"
                  )}
                >
                  <Icon size={16} className={cn(cat.important && !active && "text-amber-600")} />
                  <span>{cat.label}</span>
                  {cat.important && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-amber-400 text-[10px] px-1.5 py-0 h-4",
                        active ? "bg-white/20 text-primary-foreground border-white/40" : "bg-amber-50 text-amber-700"
                      )}
                    >
                      Important
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category nav — mobile select */}
        <div className="md:hidden mb-6 sticky top-16 z-20 bg-background/90 backdrop-blur py-2">
          <Select value={visibleCat?.id} onValueChange={setActiveCat}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Choisir une catégorie" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const disabled = term.length > 0 && !filteredCategories.find((c) => c.id === cat.id);
                return (
                  <SelectItem key={cat.id} value={cat.id} disabled={disabled}>
                    <div className="flex items-center gap-2">
                      <Icon size={14} />
                      <span>{cat.label}</span>
                      {cat.important && (
                        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700 text-[10px] ml-1">
                          Important
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-2xl">
            Aucun résultat pour « <strong>{search}</strong> ». Essayez un autre mot-clé.
          </div>
        )}

        {/* Active category */}
        {visibleCat && (
          <div>
            {/* Important intro */}
            {visibleCat.important && visibleCat.intro && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900 leading-relaxed">{visibleCat.intro}</p>
              </div>
            )}

            <Accordion
              type="multiple"
              value={openItems}
              onValueChange={setOpenItems}
              className="space-y-2"
            >
              {visibleCat.items.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  id={`faq-${item.id}`}
                  className={cn(
                    "border border-border rounded-xl overflow-hidden px-5 bg-card scroll-mt-32",
                    visibleCat.important && "border-amber-200/70"
                  )}
                >
                  <AccordionTrigger className="py-4 text-left text-[15px] font-semibold text-foreground hover:no-underline gap-3">
                    <span className="flex-1">{highlight(item.q, term)}</span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm text-foreground/85 leading-relaxed">
                    <div className="prose prose-sm max-w-none [&_p]:my-2 [&_strong]:text-foreground">
                      {item.a}
                    </div>

                    {/* Feedback + anchor */}
                    <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Cette réponse vous a-t-elle été utile ?</span>
                        <button
                          onClick={() => handleFeedback(item.id, "yes")}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition-colors",
                            feedback[item.id] === "yes"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "border-border hover:bg-muted"
                          )}
                          aria-label="Réponse utile"
                        >
                          <ThumbsUp size={13} /> Oui
                        </button>
                        <button
                          onClick={() => handleFeedback(item.id, "no")}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition-colors",
                            feedback[item.id] === "no"
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "border-border hover:bg-muted"
                          )}
                          aria-label="Réponse non utile"
                        >
                          <ThumbsDown size={13} /> Non
                        </button>
                        {feedback[item.id] && (
                          <span className="text-emerald-600">Merci pour votre retour !</span>
                        )}
                      </div>
                      <button
                        onClick={() => copyAnchor(item.id)}
                        className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
                      >
                        Copier le lien
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl border border-border bg-muted/30 p-6 md:p-8 text-center">
          <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
            Vous ne trouvez pas votre réponse ?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Notre équipe vendeurs vous répond sous 24h ouvrables.
          </p>
          <a
            href="mailto:vendor-support@medikong.pro"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Mail size={16} /> Contactez-nous
          </a>
        </div>
      </div>
    </section>
  );
}
