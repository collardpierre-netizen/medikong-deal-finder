// Admin — Liens & QR tracés (Module A)
// Liste, création, détail avec QR code + funnel de conversion.
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, Download, QrCode, Plus, ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from "recharts";

type Campaign = {
  id: string;
  slug: string;
  name: string;
  owner_type: "vendor" | "brand" | "manufacturer" | "medikong" | "partner";
  owner_id: string | null;
  partner_label: string | null;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string;
  utm_campaign: string | null;
  utm_content: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "draft" | "active" | "paused" | "ended";
  created_at: string;
};

function publicTrackedUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.medikong.be";
  return `${origin}/go/${encodeURIComponent(slug)}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function AdminTrackingCampaignsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["admin-tracking-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Campaign[]) ?? [];
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
        <CampaignDetail campaign={selected} onUpdated={() => qc.invalidateQueries({ queryKey: ["admin-tracking-campaigns"] })} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liens & QR tracés</h1>
          <p className="text-sm text-muted-foreground">
            Créez une campagne, imprimez son QR sur vos flyers, et suivez la conversion réelle scan → inscription → activation.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouvelle campagne</Button>
          </DialogTrigger>
          <CreateCampaignDialog onCreated={(id) => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-tracking-campaigns"] });
            setSelectedId(id);
          }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3">Nom</th>
                <th className="p-3">Slug (/go/…)</th>
                <th className="p-3">Émetteur</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Créée le</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!isLoading && campaigns.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune campagne pour l'instant. Créez-en une pour générer votre premier QR.</td></tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedId(c.id)}>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 font-mono text-xs">{c.slug}</td>
                  <td className="p-3 text-xs">{c.owner_type}{c.partner_label ? ` · ${c.partner_label}` : ""}</td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-BE")}</td>
                  <td className="p-3 text-right"><Button variant="ghost" size="sm">Ouvrir →</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const map: Record<Campaign["status"], { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-100 text-emerald-800" },
    draft: { label: "Brouillon", className: "bg-muted text-foreground" },
    paused: { label: "En pause", className: "bg-amber-100 text-amber-800" },
    ended: { label: "Terminée", className: "bg-muted text-muted-foreground" },
  };
  const m = map[status];
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${m.className}`}>{m.label}</span>;
}

function CreateCampaignDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerType, setOwnerType] = useState<Campaign["owner_type"]>("medikong");
  const [partnerLabel, setPartnerLabel] = useState("");
  const [landingPath, setLandingPath] = useState("/inscription");
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const s = (slug || slugify(name)).trim();
      if (!s) throw new Error("Slug requis");
      const { data, error } = await supabase
        .from("tracking_campaigns")
        .insert({
          name,
          slug: s,
          owner_type: ownerType,
          partner_label: ownerType === "partner" ? partnerLabel || null : null,
          landing_path: landingPath || "/inscription",
          utm_source: utmSource || null,
          utm_medium: "qr",
          utm_campaign: utmCampaign || null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Campagne créée");
      onCreated(id);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Nouvelle campagne tracée</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Nom interne *</Label>
          <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Ex : Flyer Salon Pharma 2026" />
        </div>
        <div>
          <Label>Slug (URL du QR : /go/…) *</Label>
          <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="flyer-salon-pharma-2026" />
          <p className="text-xs text-muted-foreground mt-1">Encodé dans le QR — court, sans espace ni accent.</p>
        </div>
        <div>
          <Label>Émetteur</Label>
          <Select value={ownerType} onValueChange={(v) => setOwnerType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="medikong">MediKong (interne)</SelectItem>
              <SelectItem value="partner">Partenaire externe</SelectItem>
              <SelectItem value="vendor">Vendeur</SelectItem>
              <SelectItem value="brand">Marque</SelectItem>
              <SelectItem value="manufacturer">Fabricant</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {ownerType === "partner" && (
          <div>
            <Label>Nom du partenaire</Label>
            <Input value={partnerLabel} onChange={(e) => setPartnerLabel(e.target.value)} placeholder="Nom libre" />
          </div>
        )}
        <div>
          <Label>Destination</Label>
          <Input value={landingPath} onChange={(e) => setLandingPath(e.target.value)} placeholder="/inscription" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>utm_source</Label>
            <Input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="flyer" />
          </div>
          <div>
            <Label>utm_campaign</Label>
            <Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} placeholder="salon-2026" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => mut.mutate()} disabled={!name || !slug || mut.isPending}>
          {mut.isPending ? "Création…" : "Créer la campagne"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CampaignDetail({ campaign, onUpdated }: { campaign: Campaign; onUpdated: () => void }) {
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
    mutationFn: async (status: Campaign["status"]) => {
      const { error } = await supabase.from("tracking_campaigns").update({ status }).eq("id", campaign.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Statut mis à jour"); onUpdated(); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copié`); }
    catch { toast.error("Copie impossible"); }
  };

  const downloadPng = () => {
    if (!qrPng) return;
    const a = document.createElement("a");
    a.href = qrPng;
    a.download = `qr-${campaign.slug}.png`;
    a.click();
  };
  const downloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${campaign.slug}.svg`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{campaign.name}</h2>
          <div className="text-sm text-muted-foreground font-mono">/go/{campaign.slug}</div>
          <div className="mt-1"><StatusBadge status={campaign.status} /></div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "active" ? (
            <Button variant="outline" onClick={() => setStatus.mutate("paused")}>Mettre en pause</Button>
          ) : (
            <Button variant="outline" onClick={() => setStatus.mutate("active")}>Activer</Button>
          )}
          <Button variant="outline" onClick={() => setStatus.mutate("ended")}>Terminer</Button>
        </div>
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
                Collez ce QR sur vos flyers. Chaque scan est journalisé, puis redirigé vers <code>{campaign.landing_path}</code>
                {campaign.utm_source ? ` avec utm_source=${campaign.utm_source}` : ""}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Funnel de conversion</CardTitle></CardHeader>
          <CardContent>
            <FunnelStats funnel={funnel} />
          </CardContent>
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
