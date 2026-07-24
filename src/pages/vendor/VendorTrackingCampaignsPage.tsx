// Vendor — Liens & QR tracés (lecture + suivi conversion sur ses propres campagnes).
// RLS filtre déjà les campagnes du vendeur connecté (user_owns_tracking_campaign).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, QrCode } from "lucide-react";
import { CampaignDetailView, StatusBadge, type CampaignLite } from "@/components/tracking/CampaignDetailView";

type Row = CampaignLite & { created_at: string };

export default function VendorTrackingCampaignsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Row[]>({
    queryKey: ["vendor-tracking-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_campaigns")
        .select("id, slug, name, landing_path, utm_source, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
  });

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) ?? null : null;

  if (selected) {
    return (
      <div className="p-6 space-y-6">
        <button
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </button>
        <CampaignDetailView
          campaign={selected}
          canEdit
          onUpdated={() => qc.invalidateQueries({ queryKey: ["vendor-tracking-campaigns"] })}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><QrCode className="h-6 w-6" />Liens & QR tracés</h1>
        <p className="text-sm text-muted-foreground">
          Retrouvez vos campagnes (QR flyers, liens partagés, salons…) et suivez la conversion réelle scan → inscription → activation.
          Pour créer une nouvelle campagne, contactez votre référent MediKong.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3">Nom</th>
                <th className="p-3">Slug (/go/…)</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Créée le</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && campaigns.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Aucune campagne pour l'instant. Contactez votre référent MediKong pour en créer une.
                </td></tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 font-mono text-xs">{c.slug}</td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-BE")}</td>
                  <td className="p-3 text-right text-xs text-muted-foreground">Ouvrir →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
