/**
 * Historique des versions de la Convention de mandat de facturation.
 *
 * À chaque modification du template juridique (`mandat-facturation-template.ts`),
 * incrémenter `CONTRACT_VERSION` ET ajouter une entrée en tête de ce tableau
 * en décrivant précisément les changements (ajouts, retraits, clarifications).
 *
 * Cette source unique alimente :
 *   - Le bandeau de conformité TVA (ligne « Version signée vs. en vigueur »)
 *   - La page publique `/vendor/contract/changelog`
 *   - Les emails de re-signature envoyés aux vendeurs
 */

export interface ContractChangelogEntry {
  /** Version sémantique du contrat (doit correspondre à CONTRACT_VERSION quand active). */
  version: string;
  /** Date de publication / mise en vigueur (ISO yyyy-mm-dd). */
  publishedAt: string;
  /** Résumé d'une phrase affiché sous l'en-tête. */
  summary: string;
  /** Liste des changements détaillés (puces). */
  changes: ContractChange[];
}

export interface ContractChange {
  type: "added" | "modified" | "removed" | "clarified";
  /** Section ou article concerné (ex. « Article 4 — Rémunération »). */
  section: string;
  /** Description courte et claire du changement pour un vendeur non juriste. */
  description: string;
}

/** Du plus récent au plus ancien. La 1ʳᵉ entrée correspond à CONTRACT_VERSION. */
export const CONTRACT_CHANGELOG: ContractChangelogEntry[] = [
  {
    version: "v1.0",
    publishedAt: "2025-01-15",
    summary: "Première version officielle de la convention de mandat de facturation.",
    changes: [
      {
        type: "added",
        section: "Article 1 — Objet",
        description:
          "Définition du mandat de facturation conforme à l'article 53 §2 du Code TVA belge.",
      },
      {
        type: "added",
        section: "Article 3 — Acceptation des factures",
        description:
          "Mécanisme de présomption d'acceptation des factures émises par MediKong (8 jours).",
      },
      {
        type: "added",
        section: "Article 6 — Durée et résiliation",
        description: "Tacite reconduction annuelle, résiliation avec préavis de 30 jours.",
      },
    ],
  },
];

/**
 * Compare deux versions sémantiques simples (vX.Y[.Z]).
 * Retourne -1 si a < b, 0 si égales, 1 si a > b.
 */
export function compareContractVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

/**
 * Renvoie toutes les entrées strictement postérieures à `signedVersion`,
 * ordonnées de la plus récente à la plus ancienne. Utile pour expliquer au
 * vendeur ce qu'il doit re-lire avant de re-signer.
 */
export function getChangesSince(signedVersion: string | null | undefined): ContractChangelogEntry[] {
  if (!signedVersion) return CONTRACT_CHANGELOG;
  return CONTRACT_CHANGELOG.filter(
    (entry) => compareContractVersions(entry.version, signedVersion) > 0
  );
}
