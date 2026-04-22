import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, AlertTriangle, ArrowRight, Download, FileText, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTRACT_VERSION } from "@/lib/contract/mandat-facturation-template";
import { openContractPdf } from "@/lib/contract/contract-storage";
import { toast } from "sonner";

export type VatComplianceStatus = "unsigned" | "in_progress" | "signed" | "outdated";

interface VatComplianceBannerProps {
  status: VatComplianceStatus;
  signedAt?: string | null;
  signedVersion?: string | null;
  /**
   * Chemin de stockage du PDF dans le bucket privé `seller-contracts`.
   * Le lien de téléchargement est généré à la demande (signed URL courte, 5 min)
   * pour limiter la fenêtre d'exposition.
   */
  pdfStoragePath?: string | null;
  /** Lien direct vers le document à signer (déclencheur du wizard). */
  onOpenDocument?: () => void;
  /** Si fourni, rend un Link react-router au lieu d'un bouton. */
  documentHref?: string;
}

/**
 * Bandeau de conformité TVA (article 53 §2 CTVA) à afficher en tête de la page
 * "Convention de mandat de facturation".
 *
 * Affiche l'état de signature, les prochaines actions et un accès direct au
 * document à signer ou téléchargeable.
 */
export function VatComplianceBanner({
  status,
  signedAt,
  signedVersion,
  pdfStoragePath,
  onOpenDocument,
  documentHref,
}: VatComplianceBannerProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!pdfStoragePath || downloading) return;
    setDownloading(true);
    try {
      const ok = await openContractPdf(pdfStoragePath);
      if (!ok) {
        toast.error("Impossible de générer le lien de téléchargement. Réessayez.");
      }
    } finally {
      setDownloading(false);
    }
  };

  const formattedSignedAt = signedAt
    ? new Date(signedAt).toLocaleDateString("fr-BE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-4 md:p-5 font-sans`}
      role="region"
      aria-label="Statut de conformité TVA"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${config.iconBg} ${config.iconColor} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className={`text-sm font-semibold ${config.titleColor}`}>{config.title}</h3>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${config.badgeBg} ${config.badgeText}`}
            >
              {config.badgeLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Article 53 §2 — Code TVA belge
            </span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{config.description}</p>

          {status === "signed" && formattedSignedAt && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Signée le <strong className="text-foreground">{formattedSignedAt}</strong>
              {signedVersion && (
                <>
                  {" · "}
                  Version <strong className="text-foreground">{signedVersion}</strong>
                </>
              )}
            </p>
          )}

          {/* Prochaines actions */}
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Prochaines actions
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {config.nextSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {status !== "signed" &&
              (documentHref ? (
                <Button asChild size="sm" className="h-8">
                  <Link to={documentHref}>
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Accéder au document
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" className="h-8" onClick={onOpenDocument}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  {status === "outdated" ? "Re-signer la nouvelle version" : "Signer le document"}
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ))}

            {pdfStoragePath && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleDownload}
                disabled={downloading}
                title="Le lien expire au bout de 5 minutes pour votre sécurité"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Télécharger le PDF signé
              </Button>
            )}

            <span className="text-[11px] text-muted-foreground ml-auto">
              Version en vigueur : <strong>{CONTRACT_VERSION}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusConfig(status: VatComplianceStatus) {
  switch (status) {
    case "signed":
      return {
        icon: ShieldCheck,
        title: "Conformité TVA validée",
        description:
          "Votre convention de mandat de facturation est en vigueur. MediKong peut émettre vos factures de vente en votre nom et pour votre compte.",
        badgeLabel: "Signée",
        bg: "bg-mk-green/5",
        border: "border-mk-green/30",
        iconBg: "bg-mk-green/10",
        iconColor: "text-mk-green",
        titleColor: "text-foreground",
        badgeBg: "bg-mk-green/15",
        badgeText: "text-mk-green",
        nextSteps: [
          "Aucune action requise — vous pouvez publier vos offres et recevoir des commandes.",
          "Conservez une copie PDF de votre convention pour vos archives comptables.",
        ],
      };
    case "outdated":
      return {
        icon: AlertTriangle,
        title: "Nouvelle version de la convention disponible",
        description:
          "Une version mise à jour de la convention de mandat de facturation a été publiée. Vous devez la re-signer pour continuer à recevoir des commandes.",
        badgeLabel: "À re-signer",
        bg: "bg-mk-amber/5",
        border: "border-mk-amber/30",
        iconBg: "bg-mk-amber/10",
        iconColor: "text-mk-amber",
        titleColor: "text-foreground",
        badgeBg: "bg-mk-amber/15",
        badgeText: "text-mk-amber",
        nextSteps: [
          "Consultez la nouvelle version du document.",
          "Apposez votre signature électronique pour valider la mise à jour.",
          "Téléchargez la nouvelle version pour vos archives.",
        ],
      };
    case "in_progress":
      return {
        icon: Clock,
        title: "Signature en cours",
        description:
          "Vous avez commencé le processus de signature mais ne l'avez pas finalisé. Vos offres restent bloquées tant que la convention n'est pas signée.",
        badgeLabel: "En cours",
        bg: "bg-primary/5",
        border: "border-primary/30",
        iconBg: "bg-primary/10",
        iconColor: "text-primary",
        titleColor: "text-foreground",
        badgeBg: "bg-primary/15",
        badgeText: "text-primary",
        nextSteps: [
          "Reprenez le processus de signature là où vous l'avez laissé.",
          "Confirmez votre identité et apposez votre signature électronique.",
        ],
      };
    case "unsigned":
    default:
      return {
        icon: AlertTriangle,
        title: "Convention non signée — action requise",
        description:
          "Avant votre première vente, vous devez autoriser MediKong à émettre vos factures via cette convention obligatoire (article 53 §2 du Code TVA belge).",
        badgeLabel: "Non signée",
        bg: "bg-destructive/5",
        border: "border-destructive/30",
        iconBg: "bg-destructive/10",
        iconColor: "text-destructive",
        titleColor: "text-foreground",
        badgeBg: "bg-destructive/15",
        badgeText: "text-destructive",
        nextSteps: [
          "Vérifiez que votre profil entreprise est complet (raison sociale, BCE, TVA, représentant).",
          "Consultez l'intégralité du document juridique.",
          "Apposez votre signature électronique (eIDAS).",
        ],
      };
  }
}
