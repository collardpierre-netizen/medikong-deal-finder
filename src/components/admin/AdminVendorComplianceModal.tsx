import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, FileSignature, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatUpdatedAtFull } from "@/lib/format-date";

interface Props {
  vendorId: string | null;
  vendorName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ComplianceRow {
  id: string;
  is_authorized_distributor: boolean | null;
  mandate_signed_at: string | null;
  distributor_updated_at: string | null;
  distributor_updated_by: string | null;
  mandate_updated_by: string | null;
}

// Convert ISO -> value valid for <input type="datetime-local">
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminVendorComplianceModal({ vendorId, vendorName, open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vendor-compliance", vendorId],
    enabled: open && !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, is_authorized_distributor, mandate_signed_at, distributor_updated_at, distributor_updated_by, mandate_updated_by")
        .eq("id", vendorId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ComplianceRow | null;
    },
  });

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mandateSigned, setMandateSigned] = useState(false);
  const [mandateAt, setMandateAt] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!data) return;
    setIsAuthorized(!!data.is_authorized_distributor);
    setMandateSigned(!!data.mandate_signed_at);
    setMandateAt(toLocalInputValue(data.mandate_signed_at));
    setReason("");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error("vendor_id manquant");
      let mandateIso: string | null = null;
      if (mandateSigned) {
        const source = mandateAt || new Date().toISOString();
        const d = new Date(source);
        if (Number.isNaN(d.getTime())) throw new Error("Date de signature invalide");
        mandateIso = d.toISOString();
      }
      const { data: res, error } = await supabase.rpc("admin_set_vendor_compliance" as any, {
        _vendor_id: vendorId,
        _is_authorized_distributor: isAuthorized,
        _mandate_signed_at: mandateIso,
        _reason: reason.trim() || null,
      } as any);
      if (error) throw error;
      return res;
    },
    onSuccess: () => {
      toast.success("Conformité vendeur mise à jour");
      qc.invalidateQueries({ queryKey: ["admin-vendor-compliance", vendorId] });
      qc.invalidateQueries({ queryKey: ["admin-vendors-stripe"] });
      qc.invalidateQueries({ queryKey: ["admin-vendors-compliance"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erreur", { description: e?.message ?? String(e) }),
  });

  const currentlyBlocking = !(data?.is_authorized_distributor && data?.mandate_signed_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Conformité — {vendorName ?? "vendeur"}
          </DialogTitle>
          <DialogDescription>
            Débloquer la publication d'offres : distributeur autorisé + mandat de facturation signé.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {currentlyBlocking && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Ce vendeur est actuellement <strong>non conforme</strong> : ses offres actives sont
                  bloquées côté base (trigger de publication).
                </p>
              </div>
            )}

            {/* Distributeur autorisé */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Distributeur autorisé</h3>
                  <p className="text-xs text-muted-foreground">
                    Active `is_authorized_distributor`.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isAuthorized}
                    onChange={(e) => setIsAuthorized(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="font-medium">{isAuthorized ? "Activé" : "Désactivé"}</span>
                </label>
              </div>
              {data.distributor_updated_at && (
                <p className="text-[11px] text-muted-foreground">
                  Dernière modif : {formatUpdatedAtFull(data.distributor_updated_at)}
                  {data.distributor_updated_by ? ` · admin ${data.distributor_updated_by.slice(0, 8)}…` : ""}
                </p>
              )}
            </div>

            {/* Mandat de facturation */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start gap-2">
                <FileSignature className="w-4 h-4 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Mandat de facturation signé</h3>
                  <p className="text-xs text-muted-foreground">
                    Renseigne `mandate_signed_at` (donc `billing_mandate_signed = true`).
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={mandateSigned}
                    onChange={(e) => {
                      setMandateSigned(e.target.checked);
                      if (e.target.checked && !mandateAt) {
                        setMandateAt(toLocalInputValue(new Date().toISOString()));
                      }
                    }}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="font-medium">{mandateSigned ? "Signé" : "Non signé"}</span>
                </label>
              </div>

              {mandateSigned && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Date de signature</Label>
                  <Input
                    type="datetime-local"
                    value={mandateAt}
                    onChange={(e) => setMandateAt(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Laisser vide = maintenant. À n'utiliser que pour rétro-documenter une
                    signature papier / hors-plateforme.
                  </p>
                </div>
              )}

              {data.mandate_updated_by && (
                <p className="text-[11px] text-muted-foreground">
                  Dernière modif admin : {data.mandate_updated_by.slice(0, 8)}…
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs">Raison / commentaire (audit)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex : contrat papier reçu le 14/07, scanné dans Notion / correction erreur onboarding, etc."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => onOpenChange(false)}
                className="text-sm px-4 py-2 rounded-md border border-border hover:bg-muted"
              >
                Annuler
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
