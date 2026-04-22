import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Download,
  FileText,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  GitCompare,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTRACT_VERSION } from "@/lib/contract/mandat-facturation-template";
import {
  getContractSignedUrl,
  CONTRACT_SIGNED_URL_TTL_SECONDS,
} from "@/lib/contract/contract-storage";
import { compareContractVersions } from "@/lib/contract/contract-changelog";
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
  /**
   * Mode lecture seule : la signature et la re-signature sont désactivées
   * (vue admin, impersonation, page d'archive). Les actions documentaires
   * (consultation, téléchargement du PDF signé) restent accessibles.
   */
  readOnly?: boolean;
}

/**
 * Bandeau de conformité TVA (article 53 §2 CTVA) à afficher en tête de la page
 * "Convention de mandat de facturation".
 *
 * Affiche l'état de signature, les prochaines actions et un accès direct au
 * document à signer ou téléchargeable. Si la convention est marquée signée
 * mais que le PDF n'est plus accessible (chemin manquant ou 404 storage),
 * un message d'erreur inline propose de rouvrir le document pour le
 * re-générer / re-consulter.
 */
export function VatComplianceBanner({
  status,
  signedAt,
  signedVersion,
  pdfStoragePath,
  onOpenDocument,
  documentHref,
  readOnly = false,
}: VatComplianceBannerProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;
  const [downloading, setDownloading] = useState(false);

  // Availability state of the signed PDF for status="signed".
  // - "unknown": not yet probed
  // - "ok": last attempt succeeded (or not yet attempted but path looks present)
  // - "missing": no storage path persisted on the contract row
  // - "unreachable": signed URL generation failed or remote returned 404
  type PdfState = "unknown" | "ok" | "missing" | "unreachable";
  const [pdfState, setPdfState] = useState<PdfState>(
    status === "signed" && !pdfStoragePath ? "missing" : "unknown"
  );
  const [probing, setProbing] = useState(false);

  // Passive probe when the banner mounts in "signed" mode: try to obtain a
  // short-lived signed URL and HEAD it. Failures surface the inline error
  // without forcing the vendor to click "Download" first.
  useEffect(() => {
    let cancelled = false;
    if (status !== "signed") return;
    if (!pdfStoragePath) {
      setPdfState("missing");
      return;
    }
    setProbing(true);
    (async () => {
      try {
        const url = await getContractSignedUrl(pdfStoragePath, CONTRACT_SIGNED_URL_TTL_SECONDS);
        if (cancelled) return;
        if (!url) {
          setPdfState("unreachable");
          return;
        }
        // HEAD probe — Supabase storage signed URLs accept HEAD; treat any
        // non-2xx (in particular 404 if the object was deleted) as unreachable.
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (cancelled) return;
          setPdfState(res.ok ? "ok" : "unreachable");
        } catch {
          if (!cancelled) setPdfState("unreachable");
        }
      } finally {
        if (!cancelled) setProbing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, pdfStoragePath]);

  const handleDownload = async () => {
    if (!pdfStoragePath || downloading) {
      if (!pdfStoragePath) setPdfState("missing");
      return;
    }
    setDownloading(true);
    try {
      const url = await getContractSignedUrl(pdfStoragePath, CONTRACT_SIGNED_URL_TTL_SECONDS);
      if (!url) {
        setPdfState("unreachable");
        toast.error("Lien de téléchargement indisponible. Ouvrez le document pour le re-générer.");
        return;
      }
      // Final HEAD check before opening — catches objects deleted between probe
      // and click (e.g. admin purge during a long-lived banner session).
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) {
          setPdfState("unreachable");
          toast.error("Le PDF signé n'est plus accessible (404). Ouvrez le document pour le re-générer.");
          return;
        }
      } catch {
        // Network errors → treat as unreachable but still let the user try opening.
      }
      setPdfState("ok");
      window.open(url, "_blank", "noopener,noreferrer");
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

  const showPdfError = status === "signed" && (pdfState === "missing" || pdfState === "unreachable");
  const errorMessage =
    pdfState === "missing"
      ? "Aucun PDF signé n'est associé à cette convention. Le document peut être re-généré depuis la page de la convention."
      : "Le PDF signé est temporairement indisponible (lien expiré ou fichier introuvable). Vous pouvez ouvrir le document pour le re-consulter ou le re-générer.";

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

          {/* Comparaison de version : version signée vs. version en vigueur */}
          {(status === "signed" || status === "outdated") && signedVersion && (() => {
            const cmp = compareContractVersions(signedVersion, CONTRACT_VERSION);
            const upToDate = cmp >= 0;
            return (
              <p className="text-xs mt-1.5 flex flex-wrap items-center gap-1.5">
                {upToDate ? (
                  <CheckCircle2 className="w-3 h-3 text-mk-green flex-shrink-0" />
                ) : (
                  <GitCompare className="w-3 h-3 text-mk-amber flex-shrink-0" />
                )}
                <span className="text-muted-foreground">
                  Version signée{" "}
                  <strong className="text-foreground">{signedVersion}</strong> · Version en vigueur{" "}
                  <strong className="text-foreground">{CONTRACT_VERSION}</strong>
                </span>
                {upToDate ? (
                  <span className="text-mk-green font-medium">— à jour</span>
                ) : (
                  <>
                    <span className="text-mk-amber font-medium">— mise à jour disponible</span>
                    <Link
                      to={`/vendor/contract/changelog?from=${encodeURIComponent(signedVersion)}`}
                      className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                    >
                      Voir ce qui a changé
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </>
                )}
              </p>
            );
          })()}

          {/* Inline error when signed PDF is unavailable */}
          {showPdfError && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
            >
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-destructive">
                  PDF signé indisponible
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Prochaines actions — masquées en lecture seule pour ne pas inviter
              à des actions (signature) qui ne sont pas disponibles dans ce contexte. */}
          {!readOnly ? (
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
          ) : (
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Mode consultation — la signature est désactivée
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {/* Mode lecture seule : la signature est désactivée. On expose
                à la place une consultation explicite quand un href est fourni. */}
            {readOnly && status !== "signed" && (
              <>
                {documentHref ? (
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <Link to={documentHref}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Consulter le document
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  className="h-8"
                  disabled
                  title="Signature désactivée en mode lecture seule"
                  aria-disabled="true"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  {status === "outdated" ? "Re-signer la nouvelle version" : "Signer le document"}
                </Button>
              </>
            )}

            {!readOnly && status !== "signed" &&
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

            {/* Fallback CTA when signed but PDF unreachable.
                - Mode normal : ouvre la page de la convention pour re-générer.
                - Mode readOnly : libellé "Consulter" et action limitée à l'ouverture
                  du document, sans déclencher de re-génération. */}
            {showPdfError &&
              (documentHref ? (
                <Button asChild size="sm" variant={readOnly ? "outline" : "default"} className="h-8">
                  <Link to={documentHref}>
                    {readOnly ? (
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {readOnly ? "Consulter le document" : "Accéder au document pour le re-générer"}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              ) : !readOnly && onOpenDocument ? (
                <Button size="sm" variant="default" className="h-8" onClick={onOpenDocument}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Accéder au document pour le re-générer
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : null)}

            {pdfStoragePath && !showPdfError && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleDownload}
                disabled={downloading || probing}
                title="Le lien expire au bout de 5 minutes pour votre sécurité"
              >
                {downloading || probing ? (
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
