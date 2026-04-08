import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function RestockSellerCounterOffers() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: counterOffers = [], isLoading } = useQuery({
    queryKey: ["restock-counter-offers-seller", user?.id],
    queryFn: async () => {
      // Get seller's offer IDs first
      const { data: offers } = await supabase
        .from("restock_offers")
        .select("id")
        .eq("seller_id", user!.id);
      if (!offers?.length) return [];
      const offerIds = offers.map((o: any) => o.id);

      const { data } = await supabase
        .from("restock_counter_offers")
        .select("*, restock_offers(designation, price_ht, ean, cnk), restock_buyers(pharmacy_name)")
        .in("offer_id", offerIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "refused" }) => {
      const { error } = await supabase
        .from("restock_counter_offers")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      // If accepted, mark the offer as sold
      if (status === "accepted") {
        const co = counterOffers.find((c: any) => c.id === id);
        if (co) {
          await supabase
            .from("restock_offers")
            .update({ status: "sold" })
            .eq("id", co.offer_id);
        }
      }
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "accepted" ? "Contre-offre acceptée !" : "Contre-offre refusée");
      qc.invalidateQueries({ queryKey: ["restock-counter-offers-seller"] });
      qc.invalidateQueries({ queryKey: ["restock-seller-offers"] });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h1 className="text-2xl font-bold text-[#1E252F] mb-6">Contre-offres reçues</h1>

      {isLoading ? (
        <div className="text-center text-[#8B929C] py-10">Chargement...</div>
      ) : counterOffers.length === 0 ? (
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-10 text-center shadow-sm">
          <MessageSquare className="mx-auto mb-3 text-[#D0D5DC]" size={40} />
          <p className="text-[#5C6470] text-sm">Aucune contre-offre en attente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {counterOffers.map((co: any) => {
            const offer = co.restock_offers;
            const buyer = co.restock_buyers;
            const diff = offer ? ((co.proposed_price - offer.price_ht) / offer.price_ht * 100).toFixed(1) : "0";
            return (
              <div key={co.id} className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-[#1E252F] text-sm">{offer?.designation}</p>
                    <p className="text-xs text-[#8B929C] mt-0.5">EAN: {offer?.ean || "—"} • CNK: {offer?.cnk || "—"}</p>
                    <p className="text-xs text-[#5C6470] mt-2">
                      Acheteur : <span className="font-medium text-[#1E252F]">{buyer?.pharmacy_name || "—"}</span>
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <div>
                        <span className="text-[10px] text-[#8B929C] block">Votre prix</span>
                        <span className="text-sm font-bold text-[#1E252F]">{Number(offer?.price_ht).toFixed(2)} €</span>
                      </div>
                      <div className="text-[#8B929C]">→</div>
                      <div>
                        <span className="text-[10px] text-[#8B929C] block">Prix proposé</span>
                        <span className="text-sm font-bold text-[#1C58D9]">{Number(co.proposed_price).toFixed(2)} €</span>
                      </div>
                      <Badge className={`text-[10px] ${Number(diff) < 0 ? "bg-red-50 text-[#E54545]" : "bg-[#EEFBF4] text-[#00B85C]"}`}>
                        {Number(diff) > 0 ? "+" : ""}{diff}%
                      </Badge>
                    </div>
                    <p className="text-xs text-[#5C6470] mt-1">Quantité demandée : {co.proposed_quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => respondMutation.mutate({ id: co.id, status: "accepted" })}
                      className="bg-[#00B85C] hover:bg-[#009E4F] text-white rounded-lg gap-1 text-xs"
                      size="sm"
                      disabled={respondMutation.isPending}
                    >
                      <Check size={14} /> Accepter
                    </Button>
                    <Button
                      onClick={() => respondMutation.mutate({ id: co.id, status: "refused" })}
                      variant="outline"
                      className="border-[#E54545] text-[#E54545] hover:bg-red-50 rounded-lg gap-1 text-xs"
                      size="sm"
                      disabled={respondMutation.isPending}
                    >
                      <X size={14} /> Refuser
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
