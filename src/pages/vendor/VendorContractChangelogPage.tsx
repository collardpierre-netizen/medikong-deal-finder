import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FilePlus2, FileText, FileMinus2, Wand2, ShieldCheck } from "lucide-react";
import { CONTRACT_VERSION } from "@/lib/contract/mandat-facturation-template";
import {
  CONTRACT_CHANGELOG,
  compareContractVersions,
  type ContractChange,
} from "@/lib/contract/contract-changelog";

/**
 * Page publique listant l'historique des versions de la Convention de mandat
 * de facturation. Référencée depuis le bandeau de conformité TVA via le lien
 * « Voir ce qui a changé ».
 */
export default function VendorContractChangelogPage() {
  const [searchParams] = useSearchParams();
  const fromVersion = searchParams.get("from");
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <Link
        to="/vendor/contract"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la convention
      </Link>

      <header>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Convention de mandat de facturation
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Historique des versions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Version en vigueur :{" "}
          <strong className="text-foreground">{CONTRACT_VERSION}</strong>. Chaque modification
          du document juridique est listée ici pour vous permettre d'identifier précisément ce
          qui a changé avant de re-signer.
        </p>
        {fromVersion && (
          <div className="mt-3 rounded-md border border-mk-amber/30 bg-mk-amber/5 px-3 py-2 text-xs text-foreground">
            Comparaison demandée depuis votre version signée{" "}
            <strong>{fromVersion}</strong>. Les entrées plus récentes que cette version sont
            mises en évidence ci-dessous.
          </div>
        )}
      </header>

      <ol className="space-y-5">
        {CONTRACT_CHANGELOG.map((entry, idx) => {
          const isCurrent = entry.version === CONTRACT_VERSION;
          const isNewerThanSigned =
            !!fromVersion && compareContractVersions(entry.version, fromVersion) > 0;
          return (
            <li
              key={entry.version}
              className={`rounded-xl border p-4 md:p-5 ${
                isNewerThanSigned
                  ? "border-mk-amber/40 bg-mk-amber/5 ring-1 ring-mk-amber/20"
                  : isCurrent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-2 mb-2">
                <h2 className="text-base font-semibold text-foreground">
                  Version {entry.version}
                </h2>
                {isCurrent && (
                  <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    En vigueur
                  </span>
                )}
                {idx === 0 && !isCurrent && (
                  <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-mk-amber/15 text-mk-amber">
                    Dernière publication
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Publiée le{" "}
                  {new Date(entry.publishedAt).toLocaleDateString("fr-BE", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{entry.summary}</p>

              <ul className="space-y-2">
                {entry.changes.map((change, i) => (
                  <ChangeRow key={i} change={change} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ChangeRow({ change }: { change: ContractChange }) {
  const meta = TYPE_META[change.type];
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`w-6 h-6 rounded-md ${meta.bg} ${meta.color} flex items-center justify-center flex-shrink-0 mt-0.5`}
        title={meta.label}
        aria-label={meta.label}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="text-sm">
        <span className="font-medium text-foreground">{change.section}</span>
        <span className="text-muted-foreground"> — {change.description}</span>
      </div>
    </li>
  );
}

const TYPE_META: Record<
  ContractChange["type"],
  { label: string; icon: typeof FilePlus2; bg: string; color: string }
> = {
  added: {
    label: "Ajouté",
    icon: FilePlus2,
    bg: "bg-mk-green/10",
    color: "text-mk-green",
  },
  modified: {
    label: "Modifié",
    icon: FileText,
    bg: "bg-primary/10",
    color: "text-primary",
  },
  removed: {
    label: "Retiré",
    icon: FileMinus2,
    bg: "bg-destructive/10",
    color: "text-destructive",
  },
  clarified: {
    label: "Clarifié",
    icon: Wand2,
    bg: "bg-mk-amber/10",
    color: "text-mk-amber",
  },
};
