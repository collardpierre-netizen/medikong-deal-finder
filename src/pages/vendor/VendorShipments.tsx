import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Search, Download, Eye, XCircle, CalendarIcon, Package, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "created", label: "Créé" },
  { value: "announced", label: "Annoncé" },
  { value: "in_transit", label: "En transit" },
  { value: "delivered", label: "Livré" },
  { value: "exception", label: "Exception" },
  { value: "cancelled", label: "Annulé" },
];

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  pending: { color: "#8B95A5", label: "En attente" },
  created: { color: "#1B5BDA", label: "Créé" },
  announced: { color: "#1B5BDA", label: "Annoncé" },
  in_transit: { color: "#F59E0B", label: "En transit" },
  delivered: { color: "#059669", label: "Livré" },
  exception: { color: "#EF4343", label: "Exception" },
  cancelled: { color: "#616B7C", label: "Annulé" },
};

type Shipment = {
  id: string;
  order_reference: string;
  recipient_name: string;
  carrier: string | null;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  label_url: string | null;
  shipping_mode_used: string;
  cost_base_cents: number | null;
  cost_margin_cents: number | null;
  cost_total_cents: number | null;
  weight_grams: number | null;
  created_at: string;
};

export default function VendorShipments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: vendor } = useCurrentVendor();
  const shippingMode = (vendor as any)?.vendor_shipping_mode ?? "no_shipping";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["vendor-all-shipments", vendor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("id, order_reference, recipient_name, carrier, status, tracking_number, tracking_url, label_url, shipping_mode_used, cost_base_cents, cost_margin_cents, cost_total_cents, weight_grams, created_at")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Shipment[];
    },
    enabled: !!vendor?.id,
  });

  const filtered = useMemo(() => {
    let list = shipments;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.order_reference?.toLowerCase().includes(q) ||
        s.tracking_number?.toLowerCase().includes(q) ||
        s.recipient_name?.toLowerCase().includes(q) ||
        s.carrier?.toLowerCase().includes(q)
      );
    }
    if (dateFrom) list = list.filter((s) => new Date(s.created_at) >= dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      list = list.filter((s) => new Date(s.created_at) <= end);
    }
    return list;
  }, [shipments, statusFilter, search, dateFrom, dateTo]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipments")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expédition annulée");
      queryClient.invalidateQueries({ queryKey: ["vendor-all-shipments"] });
      setCancelId(null);
    },
    onError: () => toast.error("Erreur lors de l'annulation"),
  });

  const showCost = shippingMode !== "no_shipping";
  const showMargin = shippingMode === "medikong_whitelabel";

  if (!vendor) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1D2530]">Mes expéditions</h1>
          <p className="text-[13px] text-[#616B7C] mt-0.5">{filtered.length} expédition(s)</p>
        </div>
        <VBtn primary onClick={() => navigate("/vendor/shipments/new")}>
          <Plus size={14} className="mr-1" />
          Nouvelle expédition
        </VBtn>
      </div>

      {/* Filters */}
      <VCard className="flex flex-wrap items-end gap-3 py-3 px-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
            <Input
              placeholder="Rechercher réf., suivi, destinataire…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-[13px]"
            />
          </div>
        </div>
        <div className="w-[180px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DatePickerBtn label="Du" date={dateFrom} onSelect={setDateFrom} />
        <DatePickerBtn label="Au" date={dateTo} onSelect={setDateTo} />
        {(search || statusFilter !== "all" || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[12px] text-[#8B95A5]"
            onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); }}
          >
            Réinitialiser
          </Button>
        )}
      </VCard>

      {/* Table */}
      <VCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#8B95A5]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Package size={40} className="text-[#CBD5E1] mb-3" />
            <p className="text-[13px] text-[#8B95A5]">Aucune expédition trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-[11px] uppercase text-[#616B7C] tracking-wide bg-[#F8FAFC]">
                  <th className="py-2.5 px-4">Réf.</th>
                  <th className="py-2.5 px-3">Destinataire</th>
                  <th className="py-2.5 px-3">Transporteur</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3">Suivi</th>
                  {showCost && <th className="py-2.5 px-3 text-right">Coût</th>}
                  {showMargin && <th className="py-2.5 px-3 text-right">Marge</th>}
                  <th className="py-2.5 px-3 text-right">Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const st = STATUS_COLORS[s.status] ?? { color: "#616B7C", label: s.status };
                  const canCancel = ["pending", "created"].includes(s.status);
                  return (
                    <tr key={s.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC]">
                      <td className="py-2.5 px-4 font-medium text-[#1D2530]">{s.order_reference}</td>
                      <td className="py-2.5 px-3 text-[#616B7C]">{s.recipient_name}</td>
                      <td className="py-2.5 px-3 text-[#616B7C]">{s.carrier ?? "—"}</td>
                      <td className="py-2.5 px-3">
                        <VBadge color={st.color}>{st.label}</VBadge>
                      </td>
                      <td className="py-2.5 px-3">
                        {s.tracking_number ? (
                          s.tracking_url ? (
                            <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" className="text-[#1B5BDA] hover:underline font-mono text-[11px]">
                              {s.tracking_number}
                            </a>
                          ) : (
                            <span className="font-mono text-[11px] text-[#8B95A5]">{s.tracking_number}</span>
                          )
                        ) : (
                          <span className="text-[#CBD5E1]">—</span>
                        )}
                      </td>
                      {showCost && (
                        <td className="py-2.5 px-3 text-right text-[#1D2530]">
                          {s.cost_total_cents ? `${(s.cost_total_cents / 100).toFixed(2)} €` : "—"}
                        </td>
                      )}
                      {showMargin && (
                        <td className="py-2.5 px-3 text-right text-[#8B95A5]">
                          {s.cost_margin_cents ? `${(s.cost_margin_cents / 100).toFixed(2)} €` : "—"}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right text-[#8B95A5]">
                        {format(new Date(s.created_at), "d MMM yy", { locale: fr })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailShipment(s)}
                            className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#616B7C]"
                            title="Détails"
                          >
                            <Eye size={14} />
                          </button>
                          {s.label_url && (
                            <a
                              href={s.label_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#1B5BDA]"
                              title="Télécharger l'étiquette"
                            >
                              <Download size={14} />
                            </a>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => setCancelId(s.id)}
                              className="p-1.5 rounded hover:bg-[#FEE2E2] text-[#EF4343]"
                              title="Annuler"
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </VCard>

      {/* Detail dialog */}
      <Dialog open={!!detailShipment} onOpenChange={() => setDetailShipment(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails expédition</DialogTitle>
          </DialogHeader>
          {detailShipment && (
            <div className="space-y-3 text-[13px]">
              <Row label="Référence" value={detailShipment.order_reference} />
              <Row label="Destinataire" value={detailShipment.recipient_name} />
              <Row label="Transporteur" value={detailShipment.carrier ?? "—"} />
              <Row label="Statut" value={STATUS_COLORS[detailShipment.status]?.label ?? detailShipment.status} />
              <Row label="Suivi" value={detailShipment.tracking_number ?? "—"} />
              <Row label="Poids" value={detailShipment.weight_grams ? `${detailShipment.weight_grams} g` : "—"} />
              <Row label="Mode" value={detailShipment.shipping_mode_used} />
              {showCost && <Row label="Coût total" value={detailShipment.cost_total_cents ? `${(detailShipment.cost_total_cents / 100).toFixed(2)} €` : "—"} />}
              {showMargin && <Row label="Marge" value={detailShipment.cost_margin_cents ? `${(detailShipment.cost_margin_cents / 100).toFixed(2)} €` : "—"} />}
              <Row label="Créé le" value={format(new Date(detailShipment.created_at), "d MMMM yyyy HH:mm", { locale: fr })} />
              {detailShipment.label_url && (
                <div className="pt-2">
                  <a href={detailShipment.label_url} target="_blank" rel="noopener noreferrer">
                    <VBtn primary>
                      <Download size={14} className="mr-1" />
                      Télécharger l'étiquette
                    </VBtn>
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Annuler l'expédition ?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[#616B7C]">
            Cette action est irréversible. L'expédition sera marquée comme annulée.
          </p>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setCancelId(null)}>Non, garder</Button>
            <Button
              variant="destructive"
              onClick={() => cancelId && cancelMutation.mutate(cancelId)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Annulation…" : "Oui, annuler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#616B7C]">{label}</span>
      <span className="text-[#1D2530] font-medium">{value}</span>
    </div>
  );
}

function DatePickerBtn({ label, date, onSelect }: { label: string; date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 text-[13px] w-[140px] justify-start", !date && "text-[#8B95A5]")}>
          <CalendarIcon size={14} className="mr-1.5" />
          {date ? format(date, "d MMM yy", { locale: fr }) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
