import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import {
  ArrowLeft, Download, ExternalLink, Package, MapPin, User, Clock,
  Loader2, Euro, Truck,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: "#8B95A5", label: "En attente" },
  created: { color: "#1B5BDA", label: "Créé" },
  announced: { color: "#1B5BDA", label: "Annoncé" },
  in_transit: { color: "#F59E0B", label: "En transit" },
  delivered: { color: "#059669", label: "Livré" },
  exception: { color: "#EF4343", label: "Exception" },
  cancelled: { color: "#616B7C", label: "Annulé" },
};

const CARRIER_TRACKING_URLS: Record<string, string> = {
  bpost: "https://track.bpost.cloud/btr/web/#/search?itemCode=",
  postnl: "https://postnl.be/fr/nos-outils/suivi-et-localisation/?B=",
  dhl: "https://www.dhl.com/be-fr/home/suivi.html?tracking-id=",
  dpd: "https://tracking.dpd.de/status/fr_BE/parcel/",
  gls: "https://gls-group.com/BE/fr/suivi-colis?match=",
  ups: "https://www.ups.com/track?tracknum=",
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  colissimo: "https://www.laposte.fr/outils/suivre-vos-envois?code=",
};

export default function VendorShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vendor } = useCurrentVendor();
  const shippingMode = (vendor as any)?.vendor_shipping_mode ?? "no_shipping";

  const { data: shipment, isLoading } = useQuery({
    queryKey: ["shipment-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["shipment-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipment_events")
        .select("*")
        .eq("shipment_id", id!)
        .order("event_timestamp", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-[#8B95A5]" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-24">
        <Package size={48} className="text-[#CBD5E1] mx-auto mb-4" />
        <p className="text-[#8B95A5] text-[14px]">Expédition introuvable</p>
        <VBtn className="mt-4" onClick={() => navigate("/vendor/shipments")}>Retour</VBtn>
      </div>
    );
  }

  const st = STATUS_MAP[shipment.status] ?? { color: "#616B7C", label: shipment.status };
  const addr = shipment.recipient_address as Record<string, string> | null;
  const dims = shipment.dimensions_cm as { length?: number; width?: number; height?: number } | null;
  const modeUsed = shipment.shipping_mode_used;
  const isWhitelabel = modeUsed === "medikong_whitelabel";
  const isOwnSC = modeUsed === "own_sendcloud";
  const isManual = modeUsed === "no_shipping";

  // Build tracking URL for manual mode
  const manualTrackingUrl = (() => {
    if (shipment.tracking_url) return shipment.tracking_url;
    if (!shipment.tracking_number || !shipment.carrier) return null;
    const carrierKey = shipment.carrier.toLowerCase().replace(/[^a-z]/g, "");
    for (const [key, base] of Object.entries(CARRIER_TRACKING_URLS)) {
      if (carrierKey.includes(key)) return base + shipment.tracking_number;
    }
    return null;
  })();

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/vendor/shipments")} className="text-[#616B7C] hover:text-[#1D2530]">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1D2530]">{shipment.order_reference}</h1>
            <VBadge color={st.color}>{st.label}</VBadge>
          </div>
          <p className="text-[12px] text-[#8B95A5] mt-0.5">
            Créé le {format(new Date(shipment.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
          </p>
        </div>
        <div className="flex gap-2">
          {shipment.label_url && (
            <a href={shipment.label_url} target="_blank" rel="noopener noreferrer">
              <VBtn primary>
                <Download size={14} className="mr-1" />
                Étiquette
              </VBtn>
            </a>
          )}
          {(shipment.tracking_url || manualTrackingUrl) && (
            <a href={shipment.tracking_url || manualTrackingUrl!} target="_blank" rel="noopener noreferrer">
              <VBtn>
                <ExternalLink size={14} className="mr-1" />
                Suivi
              </VBtn>
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recipient */}
        <VCard>
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-[#1B5BDA]" />
            <h2 className="text-[14px] font-bold text-[#1D2530]">Destinataire</h2>
          </div>
          <div className="space-y-1.5 text-[13px]">
            <p className="font-medium text-[#1D2530]">{shipment.recipient_name}</p>
            <p className="text-[#616B7C]">{shipment.recipient_email}</p>
            {shipment.recipient_phone && <p className="text-[#616B7C]">{shipment.recipient_phone}</p>}
            {addr && (
              <div className="pt-1 text-[#616B7C]">
                <p>{addr.address_line_1}{addr.house_number ? ` ${addr.house_number}` : ""}</p>
                <p>{addr.postal_code} {addr.city}, {addr.country}</p>
              </div>
            )}
          </div>
        </VCard>

        {/* Shipment info */}
        <VCard>
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-[#7C3AED]" />
            <h2 className="text-[14px] font-bold text-[#1D2530]">Informations colis</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <InfoRow label="Transporteur" value={shipment.carrier ?? "—"} />
            <InfoRow label="N° suivi" value={shipment.tracking_number ?? "—"} mono />
            <InfoRow label="Poids" value={shipment.weight_grams ? `${shipment.weight_grams} g` : "—"} />
            {dims && (
              <InfoRow
                label="Dimensions"
                value={`${dims.length ?? 0} × ${dims.width ?? 0} × ${dims.height ?? 0} cm`}
              />
            )}
            <InfoRow label="Mode" value={
              isManual ? "Manuel" : isOwnSC ? "Sendcloud (propre)" : "Medikong Shipping"
            } />
            {shipment.parcel_id && <InfoRow label="Parcel ID" value={String(shipment.parcel_id)} mono />}
          </div>
        </VCard>
      </div>

      {/* Cost breakdown — Sendcloud modes */}
      {(isWhitelabel || isOwnSC) && (shipment.cost_base_cents || shipment.cost_total_cents) && (
        <VCard>
          <div className="flex items-center gap-2 mb-3">
            <Euro size={16} className="text-[#059669]" />
            <h2 className="text-[14px] font-bold text-[#1D2530]">Détail des coûts</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            {isWhitelabel ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#616B7C]">Coût transporteur</span>
                  <span className="text-[#1D2530]">{centsToEur(shipment.cost_base_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#616B7C]">Commission Medikong</span>
                  <span className="text-[#1D2530]">{centsToEur(shipment.cost_margin_cents)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-[#E2E8F0] pt-2">
                  <span className="text-[#1D2530]">Total facturé</span>
                  <span className="text-[#1B5BDA]">{centsToEur(shipment.cost_total_cents)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-[#616B7C]">Coût Sendcloud</span>
                <span className="text-[#1D2530] font-medium">{centsToEur(shipment.cost_total_cents)}</span>
              </div>
            )}
          </div>
        </VCard>
      )}

      {/* Timeline */}
      <VCard>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[#F59E0B]" />
          <h2 className="text-[14px] font-bold text-[#1D2530]">Historique de suivi</h2>
        </div>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} className="text-[#CBD5E1] mx-auto mb-2" />
            <p className="text-[13px] text-[#8B95A5]">Aucun événement de suivi disponible</p>
            {isManual && shipment.tracking_number && (
              <p className="text-[12px] text-[#8B95A5] mt-1">
                Le suivi manuel n'enregistre pas d'événements automatiques.
              </p>
            )}
          </div>
        ) : (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-[#E2E8F0]" />
            <div className="space-y-4">
              {events.map((evt, i) => (
                <div key={evt.id} className="relative flex gap-3">
                  {/* Dot */}
                  <div
                    className="absolute -left-6 top-1 w-[14px] h-[14px] rounded-full border-2 border-white"
                    style={{
                      backgroundColor: i === 0 ? "#1B5BDA" : "#CBD5E1",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#1D2530]">
                        {evt.event_type}
                      </span>
                      <span className="text-[11px] text-[#8B95A5]">
                        {format(new Date(evt.event_timestamp), "d MMM yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#616B7C] mt-0.5">{evt.event_message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </VCard>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#616B7C]">{label}</span>
      <span className={`text-[#1D2530] font-medium ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}

function centsToEur(cents: number | null): string {
  if (!cents) return "—";
  return `${(cents / 100).toFixed(2)} €`;
}
