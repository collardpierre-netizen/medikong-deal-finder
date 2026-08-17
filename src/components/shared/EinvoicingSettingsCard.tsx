import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Search, Save } from "lucide-react";
import {
  isValidAnyPeppolId,
  normalizeAnyPeppolId,
  suggestBePeppolId,
  PEPPOL_DIRECTORY_LABEL,
  type PeppolDirectoryStatus,
} from "@/lib/peppol";

interface Props {
  customerId: string;
  /** Buyer self-service view shows an explanatory banner when no Peppol ID is set. */
  variant?: "admin" | "buyer";
}

type CustomerEinvoicing = {
  id: string;
  email: string | null;
  vat_number: string | null;
  peppol_id: string | null;
  peppol_directory_status: PeppolDirectoryStatus | null;
  peppol_last_checked_at: string | null;
  einvoicing_channel: "peppol" | "email" | "both" | null;
  einvoicing_email: string | null;
};

const STATUS_STYLE: Record<PeppolDirectoryStatus, { bg: string; color: string; Icon: any }> = {
  found: { bg: "#F0FDF4", color: "#059669", Icon: CheckCircle2 },
  not_found: { bg: "#FFFBEB", color: "#B45309", Icon: AlertTriangle },
  error: { bg: "#FEF2F2", color: "#B91C1C", Icon: XCircle },
  unknown: { bg: "#F1F5F9", color: "#64748B", Icon: HelpCircle },
};

export function EinvoicingSettingsCard({ customerId, variant = "admin" }: Props) {
  const qc = useQueryClient();
  const [peppolId, setPeppolId] = useState("");
  const [channel, setChannel] = useState<"peppol" | "email" | "both">("email");
  const [billingEmail, setBillingEmail] = useState("");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const { data: customer } = useQuery({
    queryKey: ["customer-einvoicing", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, email, vat_number, peppol_id, peppol_directory_status, peppol_last_checked_at, einvoicing_channel, einvoicing_email")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CustomerEinvoicing;
    },
  });

  useEffect(() => {
    if (!customer) return;
    setPeppolId(customer.peppol_id || "");
    setChannel((customer.einvoicing_channel as any) || "email");
    setBillingEmail(customer.einvoicing_email || "");
  }, [customer?.id, customer?.peppol_id, customer?.einvoicing_channel, customer?.einvoicing_email]);

  const status: PeppolDirectoryStatus = (customer?.peppol_directory_status as PeppolDirectoryStatus) || "unknown";
  const style = STATUS_STYLE[status];
  const peppolReady = status === "found";
  const suggestion = !peppolId ? suggestBePeppolId(customer?.vat_number) : null;

  const saveMut = useMutation({
    mutationFn: async () => {
      const normalized = peppolId ? normalizeAnyPeppolId(peppolId) : null;
      if (normalized && !isValidAnyPeppolId(normalized)) {
        throw new Error("Identifiant Peppol invalide — format attendu : 0208:0123456789");
      }
      const patch: Record<string, unknown> = {
        peppol_id: normalized,
        einvoicing_channel: normalized ? channel : "email",
        einvoicing_email: billingEmail.trim() || null,
      };
      if (normalized !== (customer?.peppol_id || null)) {
        patch.peppol_directory_status = "unknown";
        patch.peppol_verified_at = null;
      }
      const { error } = await supabase.from("customers").update(patch as any).eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres de facturation électronique enregistrés");
      qc.invalidateQueries({ queryKey: ["customer-einvoicing", customerId] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e: any) => toast.error(e?.message || "Échec de l'enregistrement"),
  });

  const lookupMut = useMutation({
    mutationFn: async () => {
      const normalized = normalizeAnyPeppolId(peppolId);
      if (!isValidAnyPeppolId(normalized)) throw new Error("Renseignez d'abord un identifiant valide (0208:0123456789)");
      const { data, error } = await supabase.functions.invoke("check-peppol-directory", {
        body: { peppol_id: normalized },
      });
      if (error) throw new Error(error.message);
      const mapped: PeppolDirectoryStatus = data?.ok !== true ? "error" : data?.registered === true ? "found" : "not_found";
      const { error: upErr } = await supabase.from("customers").update({
        peppol_directory_status: mapped,
        peppol_last_checked_at: new Date().toISOString(),
        peppol_verified_at: mapped === "found" ? new Date().toISOString() : null,
      } as any).eq("id", customerId);
      if (upErr) throw upErr;
      return { mapped, message: data?.message as string | undefined };
    },
    onSuccess: ({ mapped, message }) => {
      setLookupMessage(message || null);
      qc.invalidateQueries({ queryKey: ["customer-einvoicing", customerId] });
      if (mapped === "found") toast.success("Participant trouvé sur le réseau Peppol");
      else if (mapped === "not_found") toast.warning("Identifiant introuvable dans l'annuaire Peppol");
      else toast.error("Erreur lors du lookup Peppol");
    },
    onError: (e: any) => toast.error(e?.message || "Lookup impossible"),
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Facturation électronique</h3>
        <p className="text-xs text-slate-500">
          Réseau Peppol : vos factures arrivent directement dans votre logiciel comptable, au format structuré.
        </p>
      </div>

      {variant === "buyer" && !customer?.peppol_id && (
        <div className="text-xs rounded-lg p-3" style={{ backgroundColor: "#EFF6FF", color: "#1E40AF" }}>
          ℹ️ Vos factures vous sont envoyées par email. Si vous travaillez avec un logiciel comptable ou un service
          financier qui reçoit ses factures via Peppol, ajoutez votre identifiant : elles arriveront directement dans
          votre flux, au format structuré.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Identifiant Peppol</label>
          <input
            value={peppolId}
            onChange={(e) => setPeppolId(e.target.value)}
            onBlur={() => setPeppolId((v) => (v ? normalizeAnyPeppolId(v) : v))}
            placeholder="0208:0123456789"
            maxLength={60}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <p className="text-[11px] text-slate-500">
            Format belge : <code>0208:</code> suivi de votre numéro BCE (10 chiffres, sans point ni tiret).
          </p>
          {suggestion && (
            <button
              type="button"
              onClick={() => setPeppolId(suggestion)}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Utiliser {suggestion} (dérivé de votre n° TVA)
            </button>
          )}
          {peppolId && !isValidAnyPeppolId(peppolId) && (
            <p className="text-[11px] text-red-600">Format invalide — attendu <code>scheme:identifiant</code>, ex. 0208:0123456789.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Canal de facturation</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          >
            <option value="email">Email</option>
            <option value="peppol" disabled={!peppolReady} title={!peppolReady ? "Vérifiez d'abord l'identifiant sur le réseau Peppol" : undefined}>
              Peppol{!peppolReady ? " (identifiant à vérifier)" : ""}
            </option>
            <option value="both" disabled={!peppolReady} title={!peppolReady ? "Vérifiez d'abord l'identifiant sur le réseau Peppol" : undefined}>
              Peppol + email{!peppolReady ? " (identifiant à vérifier)" : ""}
            </option>
          </select>
          <div className="flex items-center gap-2 pt-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: style.bg, color: style.color }}
              title={lookupMessage || undefined}
            >
              <style.Icon size={10} /> {PEPPOL_DIRECTORY_LABEL[status]}
            </span>
            {customer?.peppol_last_checked_at && (
              <span className="text-[10px] text-slate-400">
                vérifié le {new Date(customer.peppol_last_checked_at).toLocaleDateString("fr-BE")}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Email de facturation (si différent du contact principal)</label>
          <input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            placeholder={customer?.email || "comptabilite@exemple.be"}
            maxLength={255}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => lookupMut.mutate()}
          disabled={lookupMut.isPending || !peppolId}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Search size={14} /> {lookupMut.isPending ? "Vérification…" : "Vérifier sur le réseau Peppol"}
        </button>
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Save size={14} /> {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

export default EinvoicingSettingsCard;
