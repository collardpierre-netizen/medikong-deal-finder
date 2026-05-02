/**
 * Nettoie et reformate les descriptions produit issues d'imports hétérogènes
 * (Qogita, scrapers, XLSX vendeurs…) où le texte est souvent fragmenté :
 * - retours à la ligne au milieu des phrases
 * - parenthèses/virgules isolées sur leur propre ligne
 * - espaces multiples
 *
 * Stratégie : on fusionne les lignes courtes/orphelines en une phrase continue,
 * puis on découpe en paragraphes logiques sur les vrais marqueurs
 * (double saut de ligne, fin de phrase suivie d'un titre court type "Saveur X :").
 */

export function normalizeDescription(raw: string): string {
  if (!raw) return "";

  let text = raw
    // Normalise CRLF
    .replace(/\r\n?/g, "\n")
    // Supprime espaces en fin de ligne
    .replace(/[ \t]+\n/g, "\n");

  // Étape 1 : fusionner les lignes fragmentées.
  // Un vrai saut de paragraphe = double \n. Sinon on rejoint avec un espace
  // si la ligne suivante ne commence pas par une majuscule + ":" (titre type "Saveur Vanille :").
  const lines = text.split("\n");
  const merged: string[] = [];
  let buffer = "";

  const isHeading = (s: string) =>
    /^[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ' -]{1,40}\s*:$/.test(s.trim());

  const flush = () => {
    if (buffer.trim()) merged.push(buffer.trim());
    buffer = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flush();
      continue;
    }

    if (isHeading(trimmed)) {
      flush();
      merged.push(trimmed);
      continue;
    }

    if (buffer === "") {
      buffer = trimmed;
    } else {
      // Recolle : gère ponctuation orpheline (",", ")", "(")
      const needsNoSpace = /^[,;:.!?)\]]/.test(trimmed) || /[(\[]$/.test(buffer);
      buffer += needsNoSpace ? trimmed : " " + trimmed;
    }
  }
  flush();

  // Étape 2 : nettoyage typographique
  return merged
    .map((p) =>
      p
        .replace(/\s+/g, " ")
        .replace(/\s+([,;:.!?)\]])/g, "$1")
        .replace(/([(\[])\s+/g, "$1")
        .replace(/\(\s*\)/g, "")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Découpe la description normalisée en blocs typés pour rendu structuré.
 */
export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string };

export function parseDescriptionBlocks(raw: string): DescriptionBlock[] {
  const normalized = normalizeDescription(raw);
  if (!normalized) return [];

  return normalized.split("\n\n").map((chunk) => {
    const t = chunk.trim();
    if (/^[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ' -]{1,40}\s*:$/.test(t)) {
      return { type: "heading", text: t.replace(/\s*:$/, "") };
    }
    return { type: "paragraph", text: t };
  });
}
