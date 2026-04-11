import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VCard } from "@/components/vendor/ui/VCard";
import { VBtn } from "@/components/vendor/ui/VBtn";
import { VBadge } from "@/components/vendor/ui/VBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Package, Truck, Check, Inbox } from "lucide-react";
import { toast } from "sonner";

interface Props {
  vendorId: string;
}

export default function NoShippingDashboard({ vendorId }: Props) {
  const queryClient = useQueryClient();
  const [shipDialog, setShipDialog] = useState<{ id: string; ref: string } | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");

  const { data: pendingShipments = [], isLoading } = useQuery({
    queryKey: ["vendor-pending-shipments", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("vendor_id", vendorId)
        .in("status", ["pending", "created"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markShipped = useMutation({
    mutationFn: async ({ id, tracking }: { id: string; tracking: string }) => {
      const { error } = await supabase
        .from("shipments")
        .update({
          status: "in_transit",
          tracking_number: tracking || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commande marquée comme expédiée");
      queryClient.invalidateQueries({ queryKey: ["vendor-pending-shipments", vendorId] });
      setShipDialog(null);
      setTrackingNumber("");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <div className="space-y-5">
      <VCard>
        <div className="flex items-center gap-3 mb-4">
          <Package size={20} className="text-[#7C3AED]" />
          <h2 className="text-[15px] font-bold text-[#1D2530]">Commandes en attente d'expédition</h2>
          <VBadge color="purple">{pendingShipments.length}</VBadge>
        </div>

        {isLoading ? (
          <p className="text-[13px] text-[#8B95A5] py-8 text-center">Chargement…</p>
        ) : pendingShipments.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Inbox size={40} className="text-[#CBD5E1] mb-3" />
            <p className="text-[13px] text-[#8B95A5]">Aucune commande en attente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-[11px] uppercase text-[#616B7C] tracking-wide">
                  <th className="pb-2 pr-4">Référence</th>
                  <th className="pb-2 pr-4">Destinataire</th>
                  <th className="pb-2 pr-4">Statut</th>
                  <th className="pb-2 pr-4">Suivi</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingShipments.map((s) => (
                  <tr key={s.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="py-3 pr-4 font-medium text-[#1D2530]">{s.order_reference}</td>
                    <td className="py-3 pr-4 text-[#616B7C]">{s.recipient_name}</td>
                    <td className="py-3 pr-4">
                      <VBadge color="amber">En attente</VBadge>
                    </td>
                    <td className="py-3 pr-4 text-[#8B95A5]">
                      {s.tracking_number || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <VBtn
                        small
                        onClick={() => setShipDialog({ id: s.id, ref: s.order_reference })}
                      >
                        <Truck size={14} className="mr-1" />
                        Expédier
                      </VBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </VCard>

      {/* Ship dialog */}
      <Dialog open={!!shipDialog} onOpenChange={() => { setShipDialog(null); setTrackingNumber(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marquer comme expédié</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[#616B7C] mb-3">
            Commande <span className="font-semibold">{shipDialog?.ref}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="tracking">Numéro de suivi (optionnel)</Label>
            <Input
              id="tracking"
              placeholder="Ex: 3S1234567890"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-4">
            <VBtn onClick={() => setShipDialog(null)}>Annuler</VBtn>
            <VBtn
              onClick={() => shipDialog && markShipped.mutate({ id: shipDialog.id, tracking: trackingNumber })}
              disabled={markShipped.isPending}
            >
              <Check size={14} className="mr-1" />
              Confirmer l'expédition
            </VBtn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
