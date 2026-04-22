import { CONTRACT_ARTICLES, ContractMediKongData, ContractVendorData, MEDIKONG_DEFAULTS } from "@/lib/contract/mandat-facturation-template";

interface ContractDocumentProps {
  vendor: ContractVendorData;
  medikong?: ContractMediKongData;
  highlightFilled?: boolean;
}

/** Affichage HTML lisible du contrat avec mise en évidence des champs pré-remplis. */
export function ContractDocument({ vendor, medikong = MEDIKONG_DEFAULTS, highlightFilled = true }: ContractDocumentProps) {
  const Filled = ({ value }: { value?: string | null }) =>
    highlightFilled ? (
      <span className="inline-block px-1.5 rounded bg-primary/10 text-foreground font-medium">
        {value || <span className="italic text-destructive">[à compléter]</span>}
      </span>
    ) : (
      <span>{value || "—"}</span>
    );

  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <h2 className="text-xl font-bold text-foreground mb-1">Convention de mandat de facturation</h2>
      <p className="text-xs text-muted-foreground italic mt-0">
        Conformément à l'article 53 §2 du Code de la TVA belge — Circulaire AGFisc N° 53/2013
      </p>

      <h3 className="text-base font-semibold mt-6">Entre les soussignés</h3>

      <p className="font-semibold">Le Mandant (ci-après désigné « le Vendeur ») :</p>
      <div className="ml-2 space-y-1 text-sm">
        <div><Filled value={vendor.company_name} /></div>
        {vendor.legal_form && <div>Forme juridique : <Filled value={vendor.legal_form} /></div>}
        <div>Siège social : <Filled value={vendor.address} /></div>
        <div>Numéro d'entreprise (BCE) : <Filled value={vendor.bce} /></div>
        <div>Numéro de TVA : <Filled value={vendor.vat} /></div>
        <div>
          Représenté par : <Filled value={vendor.representative_name} />
          {vendor.representative_role && <>, en qualité de <Filled value={vendor.representative_role} /></>}
        </div>
      </div>

      <p className="font-semibold mt-4">ET</p>

      <p className="font-semibold">Le Mandataire (ci-après désigné « MediKong ») :</p>
      <div className="ml-2 space-y-1 text-sm">
        <div>MediKong {medikong.legal_form}</div>
        <div>Siège social : {medikong.address}</div>
        <div>Numéro d'entreprise (BCE) : {medikong.bce}</div>
        <div>Numéro de TVA : {medikong.vat}</div>
        <div>Représenté par : {medikong.representative_name}, en qualité de {medikong.representative_role}</div>
      </div>

      {CONTRACT_ARTICLES.map((article) => (
        <section key={article.id} id={article.id} className="mt-6">
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
