import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Package, Download } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const recipientSchema = z.object({
  order_reference: z.string().min(1, "Référence requise").max(100),
  recipient_name: z.string().min(1, "Nom requis").max(200),
  recipient_email: z.string().email("Email invalide").max(255),
  recipient_phone: z.string().max(30).optional(),
  address_line_1: z.string().min(1, "Adresse requise").max(300),
  house_number: z.string().max(20).optional(),
  postal_code: z.string().min(1, "Code postal requis").max(20),
  city: z.string().min(1, "Ville requise").max(100),
  country: z.string().length(2, "Code pays ISO 2 lettres").default("BE"),
});

type RecipientData = z.infer<typeof recipientSchema>;

export default function VendorNewShipment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vendor } = useCurrentVendor();
  const shippingMode = (vendor as any)?.vendor_shipping_mode ?? "no_shipping";
  const marginPct = (vendor as any)?.shipping_margin_percentage ?? 15;

  const [form, setForm] = useState<Partial<RecipientData>>({ country: "BE" });
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [weightGrams, setWeightGrams] = useState("1000");
  const [dimLength, setDimLength] = useState("");
  const [dimWidth, setDimWidth] = useState("");
  const [dimHeight, setDimHeight] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [labelUrl, setLabelUrl] = useState<string | null>(null);

  const isSendcloud = shippingMode === "own_sendcloud" || shippingMode === "medikong_whitelabel";

  // Fetch shipping methods for sendcloud modes
  const { data: shippingMethods = [], isLoading: loadingMethods } = useQuery({
    queryKey: ["shipping-methods", vendor?.id, form.country],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sendcloud-api", {
        body: {
          operation: "getShippingMethods",
          payload: {
            from_country: "BE",
            to_country: form.country || "BE",
            weight_kg: Number(weightGrams) / 1000 || 1,
          },
          vendor_id: vendor?.id,
          use_vendor_keys: shippingMode === "own_sendcloud",
        },
      });
      if (error) throw error;
      if (!data?.success) return [];
      const methods = data.data?.shipping_methods ?? [];
      return methods as Array<{ id: number; name: string; carrier: string; min_weight: number; max_weight: number; price?: number }>;
    },
    enabled: isSendcloud && !!vendor?.id,
  });

  const update = (key: keyof RecipientData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Create shipment mutation
  const createShipment = useMutation({
    mutationFn: async () => {
      const parsed = recipientSchema.safeParse(form);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
        setErrors(fieldErrors);
        throw new Error("Validation failed");
      }
      const d = parsed.data;

      if (shippingMode === "no_shipping") {
        // Simple local insert
        const { data, error } = await supabase.from("shipments").insert({
          vendor_id: vendor!.id,
          order_reference: d.order_reference,
          shipping_mode_used: "no_shipping",
          tracking_number: trackingNumber || null,
          carrier: carrier || null,
          status: trackingNumber ? "in_transit" : "pending",
          recipient_name: d.recipient_name,
          recipient_email: d.recipient_email,
          recipient_phone: d.recipient_phone || null,
          recipient_address: {
            address_line_1: d.address_line_1,
            house_number: d.house_number,
            postal_code: d.postal_code,
            city: d.city,
            country: d.country,
          },
          weight_grams: Number(weightGrams) || null,
        }).select().single();
        if (error) throw error;
        return { shipment: data, label_url: null };
      }

      // Sendcloud modes — call edge function
      if (!shippingMethodId) throw new Error("Sélectionnez un transporteur");

      const { data: scResult, error: scError } = await supabase.functions.invoke("sendcloud-api", {
        body: {
          operation: "createParcel",
          payload: {
            to_name: d.recipient_name,
            to_email: d.recipient_email,
            to_phone: d.recipient_phone,
            to_address: `${d.address_line_1}${d.house_number ? " " + d.house_number : ""}`,
            to_city: d.city,
            to_postal_code: d.postal_code,
            to_country: d.country,
            order_reference: d.order_reference,
            weight_kg: Number(weightGrams) / 1000,
            shipping_method_id: Number(shippingMethodId),
            sender_address_id: shippingMode === "medikong_whitelabel" ? undefined : undefined,
          },
          vendor_id: vendor!.id,
          use_vendor_keys: shippingMode === "own_sendcloud",
        },
      });
      if (scError) throw scError;
      if (!scResult?.success) throw new Error(scResult?.error || "Erreur Sendcloud");

      const parcel = scResult.data?.parcel;
      const costBaseCents = parcel?.shipment?.price ? Math.round(Number(parcel.shipment.price) * 100) : null;
      const costMarginCents = shippingMode === "medikong_whitelabel" && costBaseCents
        ? Math.round(costBaseCents * marginPct / 100)
        : null;

      // Store shipment
      const { data: shipment, error: insertErr } = await supabase.from("shipments").insert({
        vendor_id: vendor!.id,
        order_reference: d.order_reference,
        shipping_mode_used: shippingMode,
        parcel_id: parcel?.id || null,
        tracking_number: parcel?.tracking_number || null,
        tracking_url: parcel?.tracking_url || null,
        carrier: parcel?.carrier?.code || null,
        status: "created",
        recipient_name: d.recipient_name,
        recipient_email: d.recipient_email,
        recipient_phone: d.recipient_phone || null,
        recipient_address: {
          address_line_1: d.address_line_1,
          house_number: d.house_number,
          postal_code: d.postal_code,
          city: d.city,
          country: d.country,
        },
        weight_grams: Number(weightGrams) || null,
        dimensions_cm: dimLength ? { length: Number(dimLength), width: Number(dimWidth), height: Number(dimHeight) } : null,
        cost_base_cents: costBaseCents,
        cost_margin_cents: costMarginCents,
        cost_total_cents: costBaseCents && costMarginCents ? costBaseCents + costMarginCents : costBaseCents,
        label_url: parcel?.label?.normal_printer?.[0] || parcel?.label?.label_printer || null,
      }).select().single();
      if (insertErr) throw insertErr;

      return {
        shipment,
        label_url: parcel?.label?.normal_printer?.[0] || parcel?.label?.label_printer || null,
      };
    },
    onSuccess: (result) => {
      toast.success("Expédition créée avec succès");
      if (result.label_url) setLabelUrl(result.label_url);
      queryClient.invalidateQueries({ queryKey: ["vendor-shipments-30d"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-pending-shipments"] });
      if (!result.label_url) navigate("/vendor");
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") toast.error(err.message);
    },
  });

  if (!vendor) return null;

  const selectedMethod = shippingMethods.find((m) => String(m.id) === shippingMethodId);
  const estimatedCost = selectedMethod?.price ? Number(selectedMethod.price) : null;
  const estimatedMargin = estimatedCost && shippingMode === "medikong_whitelabel" ? estimatedCost * marginPct / 100 : 0;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/vendor")} className="text-[#616B7C] hover:text-[#1D2530]">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">Nouvelle expédition</h1>
          <p className="text-[12px] text-[#8B95A5]">
            {shippingMode === "no_shipping" && "Mode manuel — saisie libre"}
            {shippingMode === "own_sendcloud" && "Via votre compte Sendcloud"}
            {shippingMode === "medikong_whitelabel" && "Via Medikong Shipping"}
          </p>
        </div>
      </div>

      {/* Success state with label */}
      {labelUrl && (
        <VCard className="border-[#059669] bg-[#ECFDF5]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-[#059669]">✓ Expédition créée</h3>
              <p className="text-[13px] text-[#616B7C] mt-1">L'étiquette est prête à télécharger.</p>
            </div>
            <a href={labelUrl} target="_blank" rel="noopener noreferrer">
              <VBtn primary>
                <Download size={14} className="mr-1" />
                Télécharger l'étiquette
              </VBtn>
            </a>
          </div>
          <VBtn className="mt-3" onClick={() => navigate("/vendor")}>
            Retour au tableau de bord
          </VBtn>
        </VCard>
      )}

      {!labelUrl && (
        <>
          {/* Order reference */}
          <VCard>
            <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Référence commande</h2>
            <div>
              <Label htmlFor="order_reference">N° de commande *</Label>
              <Input
                id="order_reference"
                placeholder="MK-2026-00123"
                value={form.order_reference || ""}
                onChange={(e) => update("order_reference", e.target.value)}
                className={errors.order_reference ? "border-red-500" : ""}
              />
              {errors.order_reference && <p className="text-[11px] text-red-500 mt-1">{errors.order_reference}</p>}
            </div>
          </VCard>

          {/* Recipient */}
          <VCard>
            <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Destinataire</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nom *" id="recipient_name" value={form.recipient_name} onChange={(v) => update("recipient_name", v)} error={errors.recipient_name} />
              <Field label="Email *" id="recipient_email" value={form.recipient_email} onChange={(v) => update("recipient_email", v)} error={errors.recipient_email} />
              <Field label="Téléphone" id="recipient_phone" value={form.recipient_phone} onChange={(v) => update("recipient_phone", v)} />
              <Field label="Adresse *" id="address_line_1" value={form.address_line_1} onChange={(v) => update("address_line_1", v)} error={errors.address_line_1} />
              <Field label="N° maison" id="house_number" value={form.house_number} onChange={(v) => update("house_number", v)} />
              <Field label="Code postal *" id="postal_code" value={form.postal_code} onChange={(v) => update("postal_code", v)} error={errors.postal_code} />
              <Field label="Ville *" id="city" value={form.city} onChange={(v) => update("city", v)} error={errors.city} />
              <Field label="Pays (ISO)" id="country" value={form.country} onChange={(v) => update("country", v)} error={errors.country} />
            </div>
          </VCard>

          {/* Package details */}
          <VCard>
            <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Colis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="weight">Poids (grammes)</Label>
                <Input id="weight" type="number" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} />
              </div>
              {isSendcloud && (
                <>
                  <div>
                    <Label htmlFor="dimL">Longueur (cm)</Label>
                    <Input id="dimL" type="number" value={dimLength} onChange={(e) => setDimLength(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="dimW">Largeur (cm)</Label>
                    <Input id="dimW" type="number" value={dimWidth} onChange={(e) => setDimWidth(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="dimH">Hauteur (cm)</Label>
                    <Input id="dimH" type="number" value={dimHeight} onChange={(e) => setDimHeight(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </VCard>

          {/* Mode-specific: carrier/tracking */}
          {shippingMode === "no_shipping" && (
            <VCard>
              <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Suivi (optionnel)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="carrier">Transporteur</Label>
                  <Input id="carrier" placeholder="Ex: bpost, DHL" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tracking">Numéro de suivi</Label>
                  <Input id="tracking" placeholder="3S1234567890" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                </div>
              </div>
            </VCard>
          )}

          {isSendcloud && (
            <VCard>
              <h2 className="text-[14px] font-bold text-[#1D2530] mb-3">Transporteur</h2>
              {loadingMethods ? (
                <div className="flex items-center gap-2 text-[13px] text-[#8B95A5] py-4">
                  <Loader2 size={16} className="animate-spin" />
                  Chargement des méthodes…
                </div>
              ) : shippingMethods.length === 0 ? (
                <p className="text-[13px] text-[#8B95A5] py-4">Aucune méthode disponible pour cette destination.</p>
              ) : (
                <>
                  <Select value={shippingMethodId} onValueChange={setShippingMethodId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un transporteur" />
                    </SelectTrigger>
                    <SelectContent>
                      {shippingMethods.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.carrier} — {m.name}
                          {m.price ? ` (${Number(m.price).toFixed(2)} €)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Cost estimate for whitelabel */}
                  {shippingMode === "medikong_whitelabel" && estimatedCost !== null && (
                    <div className="mt-3 p-3 bg-[#F8FAFC] rounded-lg text-[13px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#616B7C]">Coût transporteur</span>
                        <span className="text-[#1D2530]">{estimatedCost.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#616B7C]">Commission Medikong ({marginPct}%)</span>
                        <span className="text-[#1D2530]">{estimatedMargin.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-[#E2E8F0] pt-1">
                        <span className="text-[#1D2530]">Total estimé</span>
                        <span className="text-[#1B5BDA]">{(estimatedCost + estimatedMargin).toFixed(2)} €</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </VCard>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <VBtn onClick={() => navigate("/vendor")}>Annuler</VBtn>
            <VBtn primary onClick={() => createShipment.mutate()} disabled={createShipment.isPending}>
              {createShipment.isPending ? (
                <><Loader2 size={14} className="animate-spin mr-1" /> Création…</>
              ) : (
                <><Package size={14} className="mr-1" /> Créer l'expédition</>
              )}
            </VBtn>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, id, value, onChange, error, placeholder }: {
  label: string; id: string; value?: string; onChange: (v: string) => void; error?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={error ? "border-red-500" : ""}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
