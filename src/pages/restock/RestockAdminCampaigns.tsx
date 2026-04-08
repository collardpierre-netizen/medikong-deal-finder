import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Eye, MousePointerClick, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

export default function RestockAdminCampaigns() {
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["restock-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const handleNewCampaign = () => {
    toast.info("Workflow de création de campagne (sélection offres → acheteurs → preview → envoi)");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E252F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Campagnes email
        </h1>
        <Button onClick={handleNewCampaign} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2">
          <Plus size={16} /> Nouvelle campagne
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-[#D0D5DC] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-[#D0D5DC]">
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Campagne</th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Date d'envoi</th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">
                  <div className="flex items-center justify-center gap-1"><Mail size={14} /> Destinataires</div>
                </th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">Offres</th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">
                  <div className="flex items-center justify-center gap-1"><Eye size={14} /> Ouvertures</div>
                </th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">
                  <div className="flex items-center justify-center gap-1"><ShoppingCart size={14} /> "Je prends"</div>
                </th>
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#8B929C]">Chargement…</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#8B929C]">Aucune campagne</td></tr>
              ) : (
                campaigns.map((c: any) => {
                  const buyerCount = (c.buyer_ids || []).length;
                  const offerCount = (c.offer_ids || []).length;
                  return (
                    <tr key={c.id} className="border-b border-[#D0D5DC] last:border-0 hover:bg-[#F7F8FA]">
                      <td className="px-4 py-3 font-medium text-[#1E252F]">{c.subject || "Sans titre"}</td>
                      <td className="px-4 py-3 text-[#5C6470] text-xs">{formatDate(c.sent_at)}</td>
                      <td className="px-4 py-3 text-center font-medium text-[#1E252F]">{buyerCount}</td>
                      <td className="px-4 py-3 text-center font-medium text-[#1E252F]">{offerCount}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[#1C58D9] font-medium">{c.open_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[#00B85C] font-medium">{c.take_count ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          c.sent_at ? "bg-[#EEFBF4] text-[#00B85C]" : "bg-[#FEF3C7] text-[#F59E0B]"
                        }`}>
                          {c.sent_at ? "Envoyée" : "Brouillon"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
