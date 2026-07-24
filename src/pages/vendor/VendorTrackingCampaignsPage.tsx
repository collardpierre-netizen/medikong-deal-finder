// Vendor — Liens & QR tracés. Le vendeur peut créer, éditer et supprimer ses propres campagnes.
// RLS : policies tracking_campaigns_owner_(read|insert|update|delete) restreignent au vendeur propriétaire.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, QrCode, Plus, Trash2 } from "lucide-react";
import { CampaignDetailView, StatusBadge, type CampaignLite } from "@/components/tracking/CampaignDetailView";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";

type Row = CampaignLite & { created_at: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function VendorTrackingCampaignsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const qc = useQueryClient();
  const { data: vendor, isLoading: vendorLoading } = useCurrentVendor();
  const vendorId = vendor?.id;

  const { data: campaigns = [], isLoading } = useQuery<Row[]>({
    queryKey: ["vendor-tracking-campaigns", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_campaigns")
        .select("id, slug, name, landing_path, utm_source, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tracking_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campagne supprimée");
      setToDelete(null);
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["vendor-tracking-campaigns"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Suppression impossible"),
  });

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) ?? null : null;

  if (selected) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à la liste
          </button>
          <Button variant="destructive" size="sm" onClick={() => setToDelete(selected)}>
            <Trash2 className="h-4 w-4 mr-1" /> Supprimer la campagne
          </Button>
        </div>
        <CampaignDetailView
          campaign={selected}
          canEdit
          onUpdated={() => qc.invalidateQueries({ queryKey: ["vendor-tracking-campaigns"] })}
        />
        <DeleteDialog target={toDelete} onCancel={() => setToDelete(null)} onConfirm={(id) => deleteMut.mutate(id)} pending={deleteMut.isPending} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><QrCode className="h-6 w-6" />Liens & QR tracés</h1>
          <p className="text-sm text-muted-foreground">
            Créez vos campagnes (QR flyers, liens partagés, salons…) et suivez la conversion scan → inscription → activation.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!vendorId}><Plus className="h-4 w-4 mr-2" />Nouvelle campagne</Button>
          </DialogTrigger>
          {vendorId && (
            <CreateCampaignDialog
              vendorId={vendorId}
              onCreated={(id) => {
                setCreateOpen(false);
                qc.invalidateQueries({ queryKey: ["vendor-tracking-campaigns"] });
                setSelectedId(id);
              }}
            />
          )}
        </Dialog>
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
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(vendorLoading || isLoading) && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>}
              {!isLoading && !vendorLoading && campaigns.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Aucune campagne pour l'instant. Créez-en une pour générer votre premier QR.
                </td></tr>
              )}
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium cursor-pointer" onClick={() => setSelectedId(c.id)}>{c.name}</td>
                  <td className="p-3 font-mono text-xs cursor-pointer" onClick={() => setSelectedId(c.id)}>{c.slug}</td>
                  <td className="p-3 cursor-pointer" onClick={() => setSelectedId(c.id)}><StatusBadge status={c.status} /></td>
                  <td className="p-3 text-xs text-muted-foreground cursor-pointer" onClick={() => setSelectedId(c.id)}>{new Date(c.created_at).toLocaleDateString("fr-BE")}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(c.id)}>Ouvrir →</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setToDelete(c); }}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <DeleteDialog target={toDelete} onCancel={() => setToDelete(null)} onConfirm={(id) => deleteMut.mutate(id)} pending={deleteMut.isPending} />
    </div>
  );
}

function DeleteDialog({
  target, onCancel, onConfirm, pending,
}: { target: Row | null; onCancel: () => void; onConfirm: (id: string) => void; pending: boolean }) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette campagne ?</AlertDialogTitle>
          <AlertDialogDescription>
            « {target?.name} » (slug <code className="font-mono">{target?.slug}</code>) sera supprimée définitivement.
            Le QR déjà imprimé cessera de rediriger. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() => target && onConfirm(target.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateCampaignDialog({ vendorId, onCreated }: { vendorId: string; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
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
          owner_type: "vendor",
          owner_id: vendorId,
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
    onSuccess: (id) => { toast.success("Campagne créée"); onCreated(id); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const canSubmit = !!name && !!(slug || slugify(name)) && !mut.isPending;

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
          <Label>Destination</Label>
          <Input value={landingPath} onChange={(e) => setLandingPath(e.target.value)} placeholder="/inscription" />
          <p className="text-xs text-muted-foreground mt-1">
            Ex : <code>/boutique/mon-shop</code>, <code>/marques/nuxe</code>, <code>/produit/doliprane-500mg</code>, ou une URL complète.
          </p>
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
        <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
          {mut.isPending ? "Création…" : "Créer la campagne"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
