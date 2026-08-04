// Portail apporteur — Mes liens & campagnes.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, Download, Plus, Pause, Play } from "lucide-react";
import { useAffiliateAccount, affiliateArgs } from "@/hooks/useAffiliateAccount";
import { LANDING_PATHS } from "@/lib/affiliate-format";
import { StatusBadge } from "@/components/tracking/CampaignDetailView";

type Campaign = {
  id: string; slug: string; name: string; landing_path: string; utm_source: string | null;
  status: "draft" | "active" | "paused" | "ended"; is_default: boolean;
  scans: number; unique_visitors: number; signups: number; first_purchases: number;
};

const MAX_ACTIVE = 50;

function trackedUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://medikong.pro";
  return `${origin}/go/${encodeURIComponent(slug)}`;
}

async function download(url: string, slug: string, kind: "png" | "svg") {
  const a = document.createElement("a");
  if (kind === "png") {
    a.href = await QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "H" });
  } else {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "H" });
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }
  a.download = `qr-${slug}.${kind}`;
  a.click();
}

export default function AffiliateLinksPage() {
  const { account, asAffiliateId, impersonating } = useAffiliateAccount();
  const args = affiliateArgs(asAffiliateId);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [landing, setLanding] = useState("/catalogue");

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["affiliate-campaigns", asAffiliateId],
    enabled: Boolean(account),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("affiliate_my_campaigns", args);
      if (error) throw error;
      return (data as Campaign[]) ?? [];
    },
  });

  const permanent = campaigns.find((c) => c.is_default) ?? campaigns[0];
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const atCap = activeCount >= MAX_ACTIVE;

  const { data: qrPreview } = useQuery({
    queryKey: ["affiliate-qr", permanent?.slug],
    enabled: Boolean(permanent),
    queryFn: () => QRCode.toDataURL(trackedUrl(permanent!.slug), { width: 320, margin: 2, errorCorrectionLevel: "H" }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("affiliate_create_campaign", {
        ...args, _name: name, _landing_path: landing,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campagne créée");
      setOpen(false); setName("");
      qc.invalidateQueries({ queryKey: ["affiliate-campaigns"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const { error } = await (supabase as any).rpc("affiliate_set_campaign_status", {
        ...args, _campaign_id: id, _status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliate-campaigns"] }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Lien copié"); }
    catch { toast.error("Copie impossible"); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Mes liens & campagnes</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Lien permanent</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6 md:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-lg md:text-2xl font-mono break-all">
              {permanent ? trackedUrl(permanent.slug) : `${window.location.origin}/go/${(account?.affiliate_code ?? "").toLowerCase()}`}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={() => permanent && copy(trackedUrl(permanent.slug))} disabled={!permanent}>
                <Copy className="h-4 w-4 mr-1" /> Copier
              </Button>
              <Button size="sm" variant="outline" disabled={!permanent}
                onClick={() => permanent && download(trackedUrl(permanent.slug), permanent.slug, "png")}>
                <Download className="h-4 w-4 mr-1" /> QR PNG
              </Button>
              <Button size="sm" variant="outline" disabled={!permanent}
                onClick={() => permanent && download(trackedUrl(permanent.slug), permanent.slug, "svg")}>
                <Download className="h-4 w-4 mr-1" /> QR SVG
              </Button>
            </div>
          </div>
          {qrPreview && <img src={qrPreview} alt="QR code du lien permanent" className="w-40 h-40 rounded-md border bg-white" />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activeCount} campagne(s) active(s) sur {MAX_ACTIVE}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={atCap || impersonating}>
              <Plus className="h-4 w-4 mr-1" /> Créer une campagne
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouvelle campagne</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flyer congrès Namur" />
              </div>
              <div>
                <Label>Destination</Label>
                <Select value={landing} onValueChange={setLanding}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANDING_PATHS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                La source de suivi est automatiquement votre code apporteur.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {atCap && (
        <p className="text-sm text-amber-700">
          Vous avez atteint le plafond de {MAX_ACTIVE} campagnes actives. Mettez une campagne en pause pour en créer une nouvelle.
        </p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Campagne</th>
                <th className="p-3">Lien</th>
                <th className="p-3 text-right">Scans</th>
                <th className="p-3 text-right">Inscriptions</th>
                <th className="p-3 text-right">Taux</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const rate = c.unique_visitors > 0 ? Math.round((c.signups / c.unique_visitors) * 1000) / 10 : 0;
                return (
                  <tr key={c.id} className="border-t">
                    <td className="p-3">
                      {c.name}
                      {c.is_default && <span className="ml-2 text-xs text-muted-foreground">(permanent)</span>}
                    </td>
                    <td className="p-3 font-mono text-xs">/go/{c.slug}</td>
                    <td className="p-3 text-right">{c.scans}</td>
                    <td className="p-3 text-right">{c.signups}</td>
                    <td className="p-3 text-right">{rate} %</td>
                    <td className="p-3"><StatusBadge status={c.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => copy(trackedUrl(c.slug))}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => download(trackedUrl(c.slug), c.slug, "png")}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {!c.is_default && !impersonating && (
                        <Button size="sm" variant="ghost"
                          onClick={() => setStatus.mutate({ id: c.id, status: c.status === "active" ? "paused" : "active" })}>
                          {c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucune campagne pour l'instant.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
