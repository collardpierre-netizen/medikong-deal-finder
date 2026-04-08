import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Mail, Eye, ShoppingCart, ExternalLink, FileSearch } from "lucide-react";
import { toast } from "sonner";

function formatEur(n: number) {
  return n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const GRADE_LABELS: Record<string, string> = {
  A: "Neuf / Parfait",
  B: "Bon état",
  C: "Emballage abîmé",
  D: "Proche DLU",
};

function CampaignPreview({ campaign, onClose }: { campaign: any; onClose: () => void }) {
  const offerIds: string[] = campaign.offer_ids || [];

  const { data: offers = [] } = useQuery({
    queryKey: ["restock-preview-offers", offerIds],
    queryFn: async () => {
      if (offerIds.length === 0) return [];
      const { data } = await supabase
        .from("restock_offers" as any)
        .select("id, designation, ean, cnk, quantity, price_ht, dlu, grade, seller_city, moq, allow_partial, lot_size")
        .in("id", offerIds);
      return (data || []) as any[];
    },
    enabled: offerIds.length > 0,
  });

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Prévisualisation de la campagne</DialogTitle>
        </DialogHeader>

        {/* Email preview */}
        <div className="border border-[#D0D5DC] rounded-xl overflow-hidden bg-white">
          {/* Email header */}
          <div className="bg-[#1C58D9] px-6 py-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium opacity-80">MediKong ReStock</span>
            </div>
            <h2 className="text-lg font-bold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {campaign.subject}
            </h2>
          </div>

          {/* Intro */}
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <p className="text-sm text-[#5C6470]">
              Bonjour,<br />
              Voici les nouvelles opportunités de déstockage sélectionnées pour vous.
              Agissez vite, les quantités sont limitées !
            </p>
          </div>

          {/* Offers */}
          <div className="divide-y divide-[#E5E7EB]">
            {offers.map((o: any) => {
              const dlu = o.dlu ? daysUntil(o.dlu) : null;
              return (
                <div key={o.id} className="px-6 py-4 flex items-start gap-4">
                  <div className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold ${
                    o.grade === "A" ? "bg-green-50 border-green-200 text-green-700" :
                    o.grade === "C" ? "bg-amber-50 border-amber-200 text-amber-700" :
                    o.grade === "D" ? "bg-red-50 border-red-200 text-red-700" :
                    "bg-blue-50 border-blue-200 text-blue-700"
                  }`}>
                    {o.grade || "B"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1E252F] truncate">{o.designation}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#5C6470]">
                      <span className="font-mono">{o.ean || o.cnk}</span>
                      <span>{o.quantity} unités</span>
                      {o.allow_partial && o.moq && <span>min. {o.moq}</span>}
                      {dlu !== null && (
                        <span className={dlu < 90 ? "text-red-600 font-medium" : dlu < 180 ? "text-amber-600" : ""}>
                          DLU {dlu}j
                        </span>
                      )}
                      {o.seller_city && <span>📍 {o.seller_city}</span>}
                    </div>
                    <p className="text-[10px] text-[#8B929C] mt-0.5">{GRADE_LABELS[o.grade] || "Bon état"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-[#1E252F]">{formatEur(o.price_ht)} €</p>
                    <p className="text-[10px] text-[#8B929C]">HTVA/unité</p>
                  </div>
                </div>
              );
            })}
            {offers.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-[#8B929C]">Chargement des offres…</div>
            )}
          </div>

          {/* CTA */}
          <div className="px-6 py-5 text-center bg-[#F7F8FA] border-t border-[#E5E7EB]">
            <div className="inline-flex items-center gap-2 bg-[#1C58D9] text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
              Voir toutes les opportunités <ExternalLink size={14} />
            </div>
            <p className="text-[10px] text-[#8B929C] mt-3">
              Vous recevez cet email car vous êtes inscrit sur MediKong ReStock.
            </p>
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center justify-between text-xs text-[#8B929C] pt-2">
          <span>{(campaign.buyer_ids || []).length} destinataires • {offerIds.length} offres</span>
          <span>{campaign.sent_at ? "Envoyée le " + new Date(campaign.sent_at).toLocaleDateString("fr-BE") : "Brouillon"}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RestockAdminCampaigns() {
  const [previewCampaign, setPreviewCampaign] = useState<any>(null);

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
                <th className="text-center px-4 py-3 font-medium text-[#5C6470]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#8B929C]">Chargement…</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#8B929C]">Aucune campagne</td></tr>
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
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewCampaign(c)}
                          className="text-xs gap-1 border-[#1C58D9] text-[#1C58D9] hover:bg-[#EBF0FB] rounded-lg"
                        >
                          <FileSearch size={13} /> Prévisualiser
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewCampaign && (
        <CampaignPreview campaign={previewCampaign} onClose={() => setPreviewCampaign(null)} />
      )}
    </div>
  );
}
