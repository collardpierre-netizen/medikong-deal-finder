// Admin — Liens & QR tracés (Module A). Liste, création, suppression, détail QR + funnel.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, ArrowLeft, Trash2 } from "lucide-react";
import { CampaignDetailView, StatusBadge, type CampaignLite } from "@/components/tracking/CampaignDetailView";

type Campaign = CampaignLite & {
  owner_type: "vendor" | "brand" | "manufacturer" | "medikong" | "partner";
  owner_id: string | null;
  partner_label: string | null;
  utm_medium: string;
  utm_campaign: string | null;
  utm_content: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

type VendorOption = { id: string; name: string | null; company_name: string | null };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function vendorLabel(v: VendorOption): string {
  return v.company_name || v.name || v.id.slice(0, 8);
}

export default function AdminTrackingCampaignsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Campaign | null>(null);
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

  const { data: vendors = [] } = useQuery<VendorOption[]>({
    queryKey: ["admin-tracking-vendors-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name")
        .order("company_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as VendorOption[]) ?? [];
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
      qc.invalidateQueries({ queryKey: ["admin-tracking-campaigns"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Suppression impossible"),
  });

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) ?? null : null;

  if (selected) {
    const ownerLabel =
      selected.owner_type === "vendor" && selected.owner_id
        ? `Vendeur · ${vendors.find((v) => v.id === selected.owner_id) ? vendorLabel(vendors.find((v) => v.id === selected.owner_id)!) : selected.owner_id.slice(0, 8)}`
        : selected.owner_type + (selected.partner_label ? ` · ${selected.partner_label}` : "");
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
        <div className="text-xs text-muted-foreground">Émetteur : <span className="font-medium">{ownerLabel}</span></div>
        <CampaignDetailView
          campaign={selected}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["admin-tracking-campaigns"] })}
        />
        <DeleteDialog target={toDelete} onCancel={() => setToDelete(null)} onConfirm={(id) => deleteMut.mutate(id)} pending={deleteMut.isPending} />
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
          <CreateCampaignDialog
            vendors={vendors}
            onCreated={(id) => {
              setCreateOpen(false);
              qc.invalidateQueries({ queryKey: ["admin-tracking-campaigns"] });
              setSelectedId(id);
            }}
          />
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
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chargement…</td></tr>
              )}
              {!isLoading && campaigns.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune campagne pour l'instant. Créez-en une pour générer votre premier QR.</td></tr>
              )}
              {campaigns.map((c) => {
                const owner =
                  c.owner_type === "vendor" && c.owner_id
                    ? `vendor · ${vendors.find((v) => v.id === c.owner_id) ? vendorLabel(vendors.find((v) => v.id === c.owner_id)!) : c.owner_id.slice(0, 8)}`
                    : c.owner_type + (c.partner_label ? ` · ${c.partner_label}` : "");
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium cursor-pointer" onClick={() => setSelectedId(c.id)}>{c.name}</td>
                    <td className="p-3 font-mono text-xs cursor-pointer" onClick={() => setSelectedId(c.id)}>{c.slug}</td>
                    <td className="p-3 text-xs cursor-pointer" onClick={() => setSelectedId(c.id)}>{owner}</td>
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
                );
              })}
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
}: { target: Campaign | null; onCancel: () => void; onConfirm: (id: string) => void; pending: boolean }) {
  return (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette campagne ?</AlertDialogTitle>
          <AlertDialogDescription>
            « {target?.name} » (slug <code className="font-mono">{target?.slug}</code>) sera supprimée définitivement.
            Le QR déjà imprimé cessera de rediriger et les événements de tracking rattachés perdront leur campagne.
            Cette action est irréversible.
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

function CreateCampaignDialog({ vendors, onCreated }: { vendors: VendorOption[]; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerType, setOwnerType] = useState<Campaign["owner_type"]>("medikong");
  const [ownerId, setOwnerId] = useState<string>("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [partnerLabel, setPartnerLabel] = useState("");
  const [landingPath, setLandingPath] = useState("/inscription");
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  const filteredVendors = vendorSearch.trim()
    ? vendors.filter((v) => vendorLabel(v).toLowerCase().includes(vendorSearch.trim().toLowerCase()))
    : vendors;

  const mut = useMutation({
    mutationFn: async () => {
      const s = (slug || slugify(name)).trim();
      if (!s) throw new Error("Slug requis");
      if (ownerType === "vendor" && !ownerId) throw new Error("Sélectionnez un vendeur");
      const { data, error } = await supabase
        .from("tracking_campaigns")
        .insert({
          name,
          slug: s,
          owner_type: ownerType,
          owner_id: ownerType === "vendor" ? ownerId : null,
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
    onSuccess: (id) => { toast.success("Campagne créée"); onCreated(id); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const canSubmit = !!name && !!(slug || slugify(name)) && (ownerType !== "vendor" || !!ownerId) && !mut.isPending;

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
          <Select value={ownerType} onValueChange={(v) => { setOwnerType(v as any); setOwnerId(""); }}>
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
        {ownerType === "vendor" && (
          <div className="space-y-2 rounded-md border p-3 bg-muted/30">
            <Label>Vendeur attribué *</Label>
            <Input
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              placeholder="Rechercher un vendeur…"
              className="h-8"
            />
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder={`Choisir parmi ${filteredVendors.length} vendeur(s)…`} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredVendors.slice(0, 200).map((v) => (
                  <SelectItem key={v.id} value={v.id}>{vendorLabel(v)}</SelectItem>
                ))}
                {filteredVendors.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun résultat</div>}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le vendeur sélectionné verra automatiquement cette campagne dans son espace vendeur (Intelligence → Liens & QR tracés).
            </p>
          </div>
        )}
        {ownerType === "partner" && (
          <div>
            <Label>Nom du partenaire</Label>
            <Input value={partnerLabel} onChange={(e) => setPartnerLabel(e.target.value)} placeholder="Nom libre" />
          </div>
        )}
        <div>
          <Label>Destination</Label>
          <Input value={landingPath} onChange={(e) => setLandingPath(e.target.value)} placeholder="/inscription" />
          <p className="text-xs text-muted-foreground mt-1">
            Ex : <code>/boutique/pacheco</code>, <code>/marques/nuxe</code>, <code>/produit/doliprane-500mg</code>, ou une URL complète.
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
