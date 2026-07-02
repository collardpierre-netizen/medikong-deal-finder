import { Fragment, type ReactNode } from "react";

/**
 * Mini-formatter inline pour titres/sous-titres bandeaux hero.
 * Supporte uniquement :
 *   - **gras**  → <strong>
 *   - [texte](url)  → <a> (interne si url commence par "/", sinon externe target=_blank)
 * Tout le reste est rendu en texte brut (échappé par React).
 */

type Token =
  | { type: "text"; value: string }
  | { type: "bold"; children: Token[] }
  | { type: "link"; label: string; href: string };

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/;
const BOLD_RE = /\*\*([^*]+)\*\*/;

function tokenize(input: string): Token[] {
  if (!input) return [];
  const tokens: Token[] = [];
  let rest = input;
  // Boucle : on cherche la 1ʳᵉ occurrence bold OU link, puis on continue sur le reste.
  while (rest.length > 0) {
    const bold = rest.match(BOLD_RE);
    const link = rest.match(LINK_RE);
    const boldIdx = bold?.index ?? -1;
    const linkIdx = link?.index ?? -1;
    if (boldIdx === -1 && linkIdx === -1) {
      tokens.push({ type: "text", value: rest });
      break;
    }
    const useBold =
      boldIdx !== -1 && (linkIdx === -1 || boldIdx < linkIdx);
    const idx = useBold ? boldIdx : linkIdx;
    if (idx > 0) tokens.push({ type: "text", value: rest.slice(0, idx) });
    if (useBold && bold) {
      tokens.push({ type: "bold", children: tokenize(bold[1]) });
      rest = rest.slice(idx + bold[0].length);
    } else if (link) {
      tokens.push({ type: "link", label: link[1], href: link[2] });
      rest = rest.slice(idx + link[0].length);
    }
  }
  return tokens;
}

function renderTokens(tokens: Token[], keyPrefix = ""): ReactNode {
  return tokens.map((t, i) => {
    const key = `${keyPrefix}${i}`;
    if (t.type === "text") return <Fragment key={key}>{t.value}</Fragment>;
    if (t.type === "bold") {
      return <strong key={key}>{renderTokens(t.children, key + "-")}</strong>;
    }
    // link
    const isInternal = t.href.startsWith("/");
    return isInternal ? (
      <a
        key={key}
        href={t.href}
        className="underline decoration-white/60 hover:decoration-white"
      >
        {t.label}
      </a>
    ) : (
      <a
        key={key}
        href={t.href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-white/60 hover:decoration-white"
      >
        {t.label}
      </a>
    );
  });
}

export function formatHeroInline(input: string | null | undefined): ReactNode {
  if (!input) return null;
  return renderTokens(tokenize(input));
}
