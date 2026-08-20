import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRestockMoqMin, isBelowRestockMoq, RESTOCK_MOQ_ERROR_CODE } from "@/hooks/useRestockMoq";

interface EditRestockOfferDialogProps {
  offer: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const STATES = [
  { value: "intact", label: "Intact" },
  { value: "damaged_packaging", label: "Emballage abîmé" },
  { value: "near_expiry", label: "Proche péremption" },
];
const DELIVERIES = [
  { value: "pickup", label: "Enlèvement sur place" },
  { value: "shipping", label: "Expédition uniquement" },
  { value: "both", label: "Les deux" },
];
const STATUSES = [
  { value: "published", label: "Publiée" },
  { value: "draft", label: "Brouillon (dépubliée)" },
  { value: "expired", label: "Expirée" },
];

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function EditRestockOfferDialog({ offer, open, onOpenChange, onSaved }: EditRestockOfferDialogProps) {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data: moqCfg } = useRestockMoqMin(offer?.seller_id ?? null);
  const moqMin = moqCfg?.moqMin ?? 0;

  useEffect(() => {
    if (!offer) {
      setForm(null);
      return;
    }
    setForm({
      quantity: offer.quantity ?? 0,
      price_ht: offer.price_ht ?? 0,
      dlu: offer.dlu ?? "",
      product_state: offer.product_state ?? "intact",
      delivery_condition: offer.delivery_condition ?? "both",
      allow_partial: !!offer.allow_partial,
      moq: offer.moq ?? 1,
      lot_size: offer.lot_size ?? 1,
      publish_start: toDatetimeLocal(offer.publish_start),
      publish_end: toDatetimeLocal(offer.publish_end),
      status: offer.status ?? "published",
      photos: Array.isArray(offer.photos) ? [...offer.photos] : [],
    });
  }, [offer]);

  if (!offer || !form) return null;

  const update = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const remaining = 5 - form.photos.length;
    const toUpload = files.slice(0, remaining);
    if (toUpload.length === 0) {
      toast.error("Maximum 5 photos");
      return;
    }
    setUploading(true);
    const newUrls: string[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `${offer.id}/${Date.now()}-${i}.${ext}`;
      const { error } = await supabase.storage.from("restock-photos").upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) {
        console.error(error);
        toast.error(`Upload échoué : ${file.name}`);
        continue;
      }
      const { data: pub } = supabase.storage.from("restock-photos").getPublicUrl(filePath);
      if (pub?.publicUrl) newUrls.push(pub.publicUrl);
    }
    setUploading(false);
    if (newUrls.length > 0) update({ photos: [...form.photos, ...newUrls] });
  };

  const removePhoto = (idx: number) => {
    update({ photos: form.photos.filter((_: string, i: number) => i !== idx) });
  };

  const handleSave = async () => {
    if (form.allow_partial && isBelowRestockMoq(Number(form.moq) || 1, moqMin)) {
      toast.error(`Quantité minimum (MOQ) imposée : ${moqMin} unités`);
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      quantity: Number(form.quantity),
      price_ht: Number(form.price_ht),
      dlu: form.dlu || null,
      product_state: form.product_state,
      delivery_condition: form.delivery_condition,
      allow_partial: form.allow_partial,
      moq: Number(form.moq) || 1,
      lot_size: Number(form.lot_size) || 1,
      publish_start: form.publish_start ? new Date(form.publish_start).toISOString() : null,
      publish_end: form.publish_end ? new Date(form.publish_end).toISOString() : null,
      status: form.status,
      photos: form.photos,
    };
    const { error } = await supabase.from("restock_offers").update(payload as any).eq("id", offer.id);
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Erreur lors de la sauvegarde");
      return;
    }
    toast.success("Offre mise à jour");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1E252F]">Éditer l'offre</DialogTitle>
          <p className="text-xs text-[#8B929C] mt-1">{offer.designation} · {offer.ean || offer.cnk || "—"}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <Label className="text-xs">Quantité</Label>
            <Input type="number" min={1} value={form.quantity} onChange={(e) => update({ quantity: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Prix HT (€)</Label>
            <Input type="number" min={0} step="0.01" value={form.price_ht} onChange={(e) => update({ price_ht: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">DLU</Label>
            <Input type="date" value={form.dlu || ""} onChange={(e) => update({ dlu: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">État</Label>
            <Select value={form.product_state} onValueChange={(v) => update({ product_state: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Livraison</Label>
            <Select value={form.delivery_condition} onValueChange={(v) => update({ delivery_condition: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DELIVERIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={form.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-2">
            <Switch checked={form.allow_partial} onCheckedChange={(v) => update({ allow_partial: v })} />
            <Label className="text-xs">Autoriser vente partielle</Label>
          </div>

          {form.allow_partial && (
            <>
              <div>
                <Label className="text-xs">MOQ (min)</Label>
                <Input type="number" min={Math.max(1, moqMin)} value={form.moq} aria-invalid={isBelowRestockMoq(Number(form.moq) || 1, moqMin)} onChange={(e) => update({ moq: e.target.value })} className={isBelowRestockMoq(Number(form.moq) || 1, moqMin) ? "border-destructive" : undefined} />
                {moqMin > 0 && (
                  <p className={`text-[10px] mt-1 ${isBelowRestockMoq(Number(form.moq) || 1, moqMin) ? "text-destructive" : "text-[#8B929C]"}`}>
                    MOQ minimum imposé : {moqMin} unités
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Par multiple de</Label>
                <Input type="number" min={1} value={form.lot_size} onChange={(e) => update({ lot_size: e.target.value })} />
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Début de diffusion (optionnel)</Label>
            <Input type="datetime-local" value={form.publish_start} onChange={(e) => update({ publish_start: e.target.value })} />
            <p className="text-[10px] text-[#8B929C] mt-1">Vide = diffusion immédiate</p>
          </div>
          <div>
            <Label className="text-xs">Fin de diffusion (optionnel)</Label>
            <Input type="datetime-local" value={form.publish_end} onChange={(e) => update({ publish_end: e.target.value })} />
            <p className="text-[10px] text-[#8B929C] mt-1">Vide = pas de date de fin</p>
          </div>

          <div className="col-span-2">
            <Label className="text-xs">Photos ({form.photos.length}/5)</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {form.photos.map((url: string, i: number) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-[#D0D5DC] bg-[#F7F8FA]">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow"
                    aria-label="Supprimer la photo"
                  >
                    <X size={12} className="text-red-500" />
                  </button>
                </div>
              ))}
              {form.photos.length < 5 && (
                <label className="aspect-square rounded-md border-2 border-dashed border-[#D0D5DC] flex items-center justify-center cursor-pointer hover:bg-[#F7F8FA]">
                  {uploading ? <Loader2 className="animate-spin text-[#8B929C]" size={16} /> : <Plus size={16} className="text-[#8B929C]" />}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || uploading} className="bg-[#1C58D9] hover:bg-[#1549B8]">
            {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
