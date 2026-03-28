import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: any;
  manufacturers: any[];
}

const TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Strategic"];
const COUNTRIES = ["BE", "FR", "NL", "DE", "LU", "CH", "US", "CN", "JP"];

export function BrandFormDialog({ open, onOpenChange, brand, manufacturers }: BrandFormDialogProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", country: "BE", website: "", description_fr: "",
    manufacturer_id: "", tier: "Bronze", certifications: "",
  });

  useEffect(() => {
    if (brand) {
      setForm({
        name: brand.name || "", slug: brand.slug || "",
        country: brand.country || "BE", website: brand.website || "",
        description_fr: brand.description_fr || "",
        manufacturer_id: brand.manufacturer_id || "",
        tier: brand.tier || "Bronze",
        certifications: (brand.certifications || []).join(", "),
      });
    } else {
      setForm({ name: "", slug: "", country: "BE", website: "", description_fr: "", manufacturer_id: "", tier: "Bronze", certifications: "" });
    }
  }, [brand, open]);

  const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      country: form.country || null,
      website: form.website || null,
      description_fr: form.description_fr || null,
      manufacturer_id: form.manufacturer_id || null,
      tier: form.tier,
      certifications: form.certifications ? form.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    try {
      if (brand) {
        const { error } = await supabase.from("brands").update(payload).eq("id", brand.id);
        if (error) throw error;
        toast.success("Marque mise à jour");
      } else {
        const { error } = await supabase.from("brands").insert(payload);
        if (error) throw error;
        toast.success("Marque créée");
      }
      qc.invalidateQueries({ queryKey: ["admin-brands"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{brand ? "Modifier la marque" : "Nouvelle marque"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nom *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
            <div><Label className="text-xs">Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pays</Label>
              <Select value={form.country} onValueChange={v => setForm({ ...form, country: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tier</Label>
              <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Fabricant</Label>
            <Select value={form.manufacturer_id} onValueChange={v => setForm({ ...form, manufacturer_id: v })}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Site web</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={3} value={form.description_fr} onChange={e => setForm({ ...form, description_fr: e.target.value })} /></div>
          <div><Label className="text-xs">Certifications (séparées par des virgules)</Label><Input value={form.certifications} onChange={e => setForm({ ...form, certifications: e.target.value })} placeholder="CE, ISO 13485, MDR" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1E293B] hover:bg-[#1E293B]/90">{saving ? "..." : brand ? "Enregistrer" : "Créer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
