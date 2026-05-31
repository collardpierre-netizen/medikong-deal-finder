/**
 * Renderer générique du contrat à partir d'une payload jsonb (medikong_data + articles).
 * Utilisé par l'éditeur admin pour prévisualiser un brouillon sans dépendre des constantes
 * hard-codées dans `src/lib/contract/mandat-facturation-template.ts`.
 */

export interface PreviewMedikong {
  legal_form?: string;
  address?: string;
  bce?: string;
  vat?: string;
  representative_name?: string;
  representative_role?: string;
  jurisdiction_city?: string;
}

export type PreviewParagraph =
  | string
  | { type: "list"; items: string[] }
  | { type: "subarticle"; number: string; text: string };

export interface PreviewArticle {
  id: string;
  number: string;
  title: string;
  paragraphs: PreviewParagraph[];
}

interface Props {
  medikong: PreviewMedikong;
  articles: PreviewArticle[];
  version?: string;
}

export function ContractTemplatePreview({ medikong, articles, version }: Props) {
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-xl font-bold text-foreground my-0">Convention de mandat de facturation</h2>
        {version && <span className="text-xs text-muted-foreground">{version}</span>}
      </div>
      <p className="text-xs text-muted-foreground italic mt-0">
        Conformément à l'article 53 §2 du Code de la TVA belge — Circulaire AGFisc N° 53/2013
      </p>

      <h3 className="text-base font-semibold mt-6">Entre les soussignés</h3>

      <p className="font-semibold">Le Mandant (ci-après désigné « le Vendeur ») :</p>
      <div className="ml-2 space-y-1 text-sm text-muted-foreground italic">
        [Données vendeur — pré-remplies à la signature]
      </div>

      <p className="font-semibold mt-4">ET</p>
      <p className="font-semibold">Le Mandataire (ci-après désigné « MediKong ») :</p>
      <div className="ml-2 space-y-1 text-sm">
        <div>MediKong {medikong.legal_form ?? "—"}</div>
        <div>Siège social : {medikong.address ?? "—"}</div>
        <div>Numéro d'entreprise (BCE) : {medikong.bce ?? "—"}</div>
        <div>Numéro de TVA : {medikong.vat ?? "—"}</div>
        <div>
          Représenté par : {medikong.representative_name ?? "—"}, en qualité de{" "}
          {medikong.representative_role ?? "—"}
        </div>
        {medikong.jurisdiction_city && (
          <div>Juridiction : {medikong.jurisdiction_city}</div>
        )}
      </div>

      {articles.map((article) => (
        <section key={article.id} className="mt-6">
          <h3 className="text-base font-semibold">
            Article {article.number} — {article.title}
          </h3>
          {article.paragraphs.map((p, i) => {
            if (typeof p === "string") {
              return (
                <p key={i} className="text-sm leading-relaxed">
                  {p}
                </p>
              );
            }
            if (p.type === "list") {
              return (
                <ul key={i} className="text-sm list-disc pl-5 space-y-1">
                  {p.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed">
                <span className="font-semibold">{p.number}</span> — {p.text}
              </p>
            );
          })}
        </section>
      ))}
    </div>
  );
}
