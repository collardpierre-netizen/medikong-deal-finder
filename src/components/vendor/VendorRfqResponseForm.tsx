import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { Loader2, Send, X, Upload, Info } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rfqId: string;
  vendorId: string;
  trackingToken: string;
  existingResponse: any | null;
  targetPriceCents: number | null;
  requiredValidityDays: number | null;
  quantity: number;
  alreadyDeclined?: boolean;
  onAfter: () => void;
}

const Schema = z.object({
  unit_price_eur: z.number().positive({ message: "Prix unitaire requis" }).max(100000),
  moq: z.number().int().min(1).max(1_000_000),
  delivery_days: z.number().int().min(0).max(365),
  offer_validity_days: z.number().int().min(1).max(365).optional(),
  payment_terms: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(4000).optional(),
});

const DECLINE_REASONS = [
  { value: "out_of_stock", label: "Hors stock" },
  { value: "price_not_competitive", label: "Prix cible trop bas" },
  { value: "no_shipping_to_country", label: "Pas de livraison vers ce pays" },
  { value: "qty_too_low", label: "Quantité trop faible" },
  { value: "qty_too_high", label: "Quantité trop élevée" },
  { value: "deadline_too_short", label: "Délai trop court" },
  { value: "other", label: "Autre" },
];

export function VendorRfqResponseForm({
  rfqId, vendorId, trackingToken, existingResponse,
  targetPriceCents, requiredValidityDays, quantity,
  alreadyDeclined, onAfter,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("price_not_competitive");
  const [declineComment, setDeclineComment] = useState("");

  const [form, setForm] = useState({
    unit_price_eur: existingResponse ? (existingResponse.unit_price_excl_vat_cents / 100).toString() : "",
    moq: existingResponse?.moq?.toString() || "1",
    delivery_days: existingResponse?.delivery_days?.toString() || "7",
    offer_validity_days: existingResponse?.offer_validity_days?.toString() || (requiredValidityDays?.toString() ?? "30"),
    payment_terms: existingResponse?.payment_terms || "",
    comment: existingResponse?.comment || "",
  });

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = Schema.safeParse({
        unit_price_eur: Number(form.unit_price_eur),
        moq: Number(form.moq),
        delivery_days: Number(form.delivery_days),
        offer_validity_days: form.offer_validity_days ? Number(form.offer_validity_days) : undefined,
        payment_terms: form.payment_terms || undefined,
        comment: form.comment || undefined,
      });
      if (!parsed.success) {
        throw new Error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] || "Formulaire invalide");
      }
      const v = parsed.data;
      const payload = {
        rfq_id: rfqId,
        vendor_id: vendorId,
        unit_price_excl_vat_cents: Math.round(v.unit_price_eur * 100),
        moq: v.moq,
        delivery_days: v.delivery_days,
        offer_validity_days: v.offer_validity_days ?? null,
        payment_terms: v.payment_terms ?? null,
        comment: v.comment ?? null,
      };

      let responseId: string;
      if (existingResponse) {
        const { data, error } = await supabase
          .from("rfq_responses")
          .update(payload)
          .eq("rfq_id", rfqId)
          .eq("vendor_id", vendorId)
          .select("id")
          .single();
        if (error) throw error;
        responseId = data.id;
      } else {
        const { data, error } = await supabase
          .from("rfq_responses")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        responseId = data.id;
      }

      // Upload attachments (vendor-side)
      const { data: { user } } = await supabase.auth.getUser();
      for (const f of files) {
        const path = `rfq/${rfqId}/responses/${responseId}/${crypto.randomUUID()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("rfq-attachments")
          .upload(path, f, { contentType: f.type });
        if (upErr) {
          toast.warning(`Pièce jointe '${f.name}' non envoyée : ${upErr.message}`);
          continue;
        }
        await supabase.from("rfq_attachments").insert({
          rfq_id: rfqId,
          rfq_response_id: responseId,
          uploaded_by_user_id: user!.id,
          uploader_role: "vendor",
          storage_path: path,
          file_name: f.name,
          mime_type: f.type || "application/octet-stream",
          size_bytes: f.size,
        });
      }

      // Mark dispatch row as responded via tracking RPC
      await supabase.functions.invoke("rfq-track", {
        body: { token: trackingToken, event: "respond" },
      }).catch(() => {/* silent */});
    },
    onSuccess: () => {
      toast.success(existingResponse ? "Offre mise à jour" : "Offre envoyée à l'acheteur");
      setFiles([]);
      onAfter();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'envoi"),
  });

  const decline = useMutation({
    mutationFn: async () => {
      await supabase.functions.invoke("rfq-track", {
        body: {
          token: trackingToken,
          event: "decline",
          decline_reason: [DECLINE_REASONS.find((r) => r.value === declineReason)?.label, declineComment.trim()]
            .filter(Boolean).join(" — ").slice(0, 500) || "Décliné",
        },
      });
    },
    onSuccess: () => {
      toast.success("Demande déclinée");
      setShowDecline(false);
      onAfter();
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const targetPriceEur = targetPriceCents != null ? targetPriceCents / 100 : null;
  const enteredPrice = Number(form.unit_price_eur || 0);
  const beatsTarget = targetPriceEur != null && enteredPrice > 0 && enteredPrice <= targetPriceEur;

  return (
    <VCard>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-bold text-[#1D2530]">
          {existingResponse ? "Modifier votre offre" : "Répondre à la demande"}
        </h3>
        {!alreadyDeclined && !existingResponse && (
          <button
            onClick={() => setShowDecline((s) => !s)}
            className="text-[12px] text-[#8B95A5] hover:text-[#EF4343] hover:underline"
          >
            Décliner
          </button>
        )}
      </div>

      {showDecline && (
        <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
          <p className="text-[12px] font-semibold text-[#1D2530] mb-2">Pourquoi déclinez-vous cette demande ?</p>
          <select
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] mb-2"
          >
            {DECLINE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <textarea
            placeholder="Précisions (optionnel)"
            maxLength={500}
            rows={2}
            value={declineComment}
            onChange={(e) => setDeclineComment(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] mb-2"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDecline(false)}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#616B7C]"
            >
              Annuler
            </button>
            <button
              onClick={() => decline.mutate()}
              disabled={decline.isPending}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-[#EF4343] text-white font-medium disabled:opacity-50"
            >
              {decline.isPending && <Loader2 className="inline animate-spin h-3 w-3 mr-1" />}
              Confirmer le déclin
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">Prix unitaire HTVA (€) *</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.unit_price_eur}
            onChange={(e) => setForm((f) => ({ ...f, unit_price_eur: e.target.value }))}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#1C58D9]"
          />
          {targetPriceEur != null && (
            <p className={`text-[10px] mt-1 ${beatsTarget ? "text-emerald-700" : "text-[#8B95A5]"}`}>
              <Info className="inline h-2.5 w-2.5 mr-0.5" />
              Prix cible acheteur : {targetPriceEur.toFixed(2)} € {beatsTarget && "✓ vous êtes ≤ cible"}
            </p>
          )}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">MOQ (quantité min) *</label>
          <input
            type="number"
            min={1}
            value={form.moq}
            onChange={(e) => setForm((f) => ({ ...f, moq: e.target.value }))}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#1C58D9]"
          />
          {Number(form.moq) > quantity && (
            <p className="text-[10px] text-amber-700 mt-1">⚠ MOQ supérieur à la qté demandée ({quantity.toLocaleString("fr-BE")})</p>
          )}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">Délai de livraison (jours) *</label>
          <input
            type="number"
            min={0}
            max={365}
            value={form.delivery_days}
            onChange={(e) => setForm((f) => ({ ...f, delivery_days: e.target.value }))}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#1C58D9]"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">Validité de l'offre (jours)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.offer_validity_days}
            onChange={(e) => setForm((f) => ({ ...f, offer_validity_days: e.target.value }))}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#1C58D9]"
          />
          {requiredValidityDays && Number(form.offer_validity_days) < requiredValidityDays && (
            <p className="text-[10px] text-amber-700 mt-1">⚠ Acheteur demande au moins {requiredValidityDays} jours</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">Conditions de paiement</label>
          <input
            type="text"
            maxLength={500}
            placeholder="Ex : 30 jours net"
            value={form.payment_terms}
            onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#1C58D9]"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">Commentaire / précisions</label>
          <textarea
            rows={3}
            maxLength={4000}
            placeholder="Détails sur l'offre, conditions logistiques, alternatives proposées…"
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] focus:outline-none focus:border-[#1C58D9]"
          />
        </div>

        <div className="col-span-2">
          <label className="text-[11px] font-semibold text-[#8B95A5] block mb-1">Pièces jointes (devis PDF, fiche technique…)</label>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-[12px] text-[#1C58D9] hover:underline"
          >
            <Upload size={12} /> Ajouter un fichier
          </button>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-[11px] bg-[#F8FAFC] px-2 py-1 rounded">
                  <span className="truncate">{f.name} ({Math.round(f.size / 1024)} ko)</span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[#8B95A5] hover:text-[#EF4343]"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <VBtn primary onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1" /> : <Send size={13} className="mr-1" />}
          {existingResponse ? "Mettre à jour mon offre" : "Envoyer mon offre"}
        </VBtn>
      </div>
    </VCard>
  );
}
