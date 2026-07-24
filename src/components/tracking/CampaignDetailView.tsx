// Shared read/act view for a tracking campaign (used by admin + vendor).
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, Download, QrCode, Maximize2, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export type CampaignLite = {
  id: string;
  slug: string;
  name: string;
  landing_path: string;
  utm_source: string | null;
  status: "draft" | "active" | "paused" | "ended";
};

function publicTrackedUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://medikong.pro";
  return `${origin}/go/${encodeURIComponent(slug)}`;
}

export function StatusBadge({ status }: { status: CampaignLite["status"] }) {
  const map: Record<CampaignLite["status"], { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
    draft: { label: "Brouillon", className: "bg-muted text-foreground" },
    paused: { label: "En pause", className: "bg-amber-100 text-amber-800" },
    ended: { label: "Terminée", className: "bg-muted text-muted-foreground" },
  };
  const m = map[status];
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${m.className}`}>{m.label}</span>;
}

export function CampaignDetailView({
  campaign,
  onUpdated,
  canEdit = true,
}: {
  campaign: CampaignLite;
  onUpdated?: () => void;
  canEdit?: boolean;
}) {
  const url = publicTrackedUrl(campaign.slug);

  const { data: qrPng } = useQuery({
    queryKey: ["qr-png", url],
    queryFn: () => QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "H" }),
  });
  const { data: qrSvg } = useQuery({
    queryKey: ["qr-svg", url],
    queryFn: () => QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 2 }),
  });
  const { data: funnel } = useQuery({
    queryKey: ["campaign-funnel", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campaign_funnel_stats", { p_campaign_id: campaign.id });
      if (error) throw error;
      return data as Record<string, number | null>;
    },
    refetchInterval: 30000,
  });
  const { data: ts = [] } = useQuery({
    queryKey: ["campaign-ts", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campaign_funnel_timeseries", { p_campaign_id: campaign.id, p_days: 30 });
      if (error) throw error;
      return (data as Array<{ day: string; scans: number; signups: number; activations: number }>) ?? [];
    },
    refetchInterval: 60000,
  });

  const setStatus = useMutation({
    mutationFn: async (status: CampaignLite["status"]) => {
      const { error } = await supabase.from("tracking_campaigns").update({ status }).eq("id", campaign.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Statut mis à jour"); onUpdated?.(); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copié`); }
    catch { toast.error("Copie impossible"); }
  };
  const downloadPng = () => {
    if (!qrPng) return;
    const a = document.createElement("a");
    a.href = qrPng; a.download = `qr-${campaign.slug}.png`; a.click();
  };
  const downloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `qr-${campaign.slug}.svg`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{campaign.name}</h2>
          <div className="text-sm text-muted-foreground font-mono">/go/{campaign.slug}</div>
          <div className="mt-1"><StatusBadge status={campaign.status} /></div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {campaign.status === "active" ? (
              <Button variant="outline" onClick={() => setStatus.mutate("paused")}>Mettre en pause</Button>
            ) : (
              <Button variant="outline" onClick={() => setStatus.mutate("active")}>Activer</Button>
            )}
            <Button variant="outline" onClick={() => setStatus.mutate("ended")}>Terminer</Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" />QR & lien</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center bg-white rounded-lg p-4 border">
              {qrPng ? <img src={qrPng} alt="QR" className="w-48 h-48" /> : <div className="w-48 h-48 animate-pulse bg-muted" />}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{url}</code>
                <Button size="sm" variant="outline" onClick={() => copy(url, "Lien")}><Copy className="h-3 w-3" /></Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadPng} disabled={!qrPng}><Download className="h-3 w-3 mr-1" />PNG</Button>
                <Button size="sm" variant="outline" onClick={downloadSvg} disabled={!qrSvg}><Download className="h-3 w-3 mr-1" />SVG</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Collez ce QR sur vos flyers. Chaque scan est journalisé puis redirigé vers <code>{campaign.landing_path}</code>
                {campaign.utm_source ? ` avec utm_source=${campaign.utm_source}` : ""}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Funnel de conversion</CardTitle></CardHeader>
          <CardContent><FunnelStats funnel={funnel} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Activité (30 derniers jours)</CardTitle></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ts}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" fontSize={11} tickFormatter={(d) => new Date(d).toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" })} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="scans" name="Scans" fill="hsl(var(--primary))" />
              <Bar dataKey="signups" name="Inscriptions" fill="hsl(var(--chart-2, 217 91% 60%))" />
              <Bar dataKey="activations" name="Activations" fill="hsl(var(--chart-3, 142 71% 45%))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelStats({ funnel }: { funnel: Record<string, number | null> | undefined }) {
  if (!funnel) return <div className="text-sm text-muted-foreground">Chargement…</div>;
  const rows = [
    { k: "scans", label: "Scans" },
    { k: "unique_visitors", label: "Visiteurs uniques" },
    { k: "signups", label: "Inscriptions complétées" },
    { k: "activations", label: "Comptes activés" },
    { k: "first_purchases", label: "Premiers achats" },
  ];
  const rates = [
    { k: "cr_scan_to_signup", label: "Scan → inscription" },
    { k: "cr_signup_to_active", label: "Inscription → activé" },
    { k: "cr_scan_to_active", label: "Scan → activé" },
    { k: "cr_active_to_buyer", label: "Activé → 1er achat" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.k} className="rounded bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">{r.label}</div>
            <div className="text-xl font-bold">{funnel[r.k] ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="border-t pt-3 space-y-1.5">
        {rates.map((r) => (
          <div key={r.k} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium">{funnel[r.k] != null ? `${funnel[r.k]} %` : "—"}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Bots exclus. Visiteurs uniques = cookie first-party.</p>
    </div>
  );
}
