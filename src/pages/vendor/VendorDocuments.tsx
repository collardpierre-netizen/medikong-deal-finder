import { Link } from "react-router-dom";
import { FileText, ExternalLink } from "lucide-react";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { ContractHistoryTable } from "@/components/vendor/ContractHistoryTable";
import { Button } from "@/components/ui/button";

/**
 * Espace Documents & Conventions du vendeur — toujours accessible, quelles que
 * soient les données légales encore manquantes sur la fiche. Permet au vendeur
 * de retrouver ses conventions signées et de relancer la signature.
 */
export default function VendorDocuments() {
  const { data: vendor } = useCurrentVendor();
  const vendorId = vendor?.id;

  return (
    <div className="max-w-5xl mx-auto px-1 md:px-2 py-2 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Documents &amp; Conventions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Retrouvez ici toutes vos conventions signées (mandat de facturation, etc.) et
            téléchargez le PDF horodaté à tout moment.
          </p>
        </div>
        <Button asChild variant="default" size="sm">
          <Link to="/vendor/contract">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Convention de mandat de facturation
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Historique des conventions signées
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Date · Statut · Empreinte SHA-256
          </span>
        </div>
        <ContractHistoryTable vendorId={vendorId} />
      </div>
    </div>
  );
}
