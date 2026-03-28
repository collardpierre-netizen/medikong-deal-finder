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

interface ManufacturerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manufacturer?: any;
}

const COUNTRIES = ["BE", "FR", "NL", "DE", "LU", "CH", "US", "CN", "JP"];

export function ManufacturerFormDialog({ open, onOpenChange, manufacturer }: ManufacturerFormDialogProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", country: "BE", city: "", website: "", description_fr: "",
    employees: "", revenue: "", certifications: "", brands: "",
  });

  useEffect(() => {
    if (manufacturer) {
      setForm({
        name: manufacturer.name || "", slug: manufacturer.slug || "",
        country: manufacturer.country || "BE", city: manufacturer.city || "",
        website: manufacturer.website || "", description_fr: manufacturer.description_fr || "",
        employees: manufacturer.employees || "", revenue: manufacturer.revenue || "",
        certifications: (manufacturer.certifications || []).join(", "),
        brands: (manufacturer.brands || []).join(", "),
      });
    } else {
      setForm({ name: "", slug: "", country: "BE", city: "", website: "", description_fr: "", employees: "", revenue: "", certifications: "", brands: "" });
    }
  }, [manufacturer, open]);

  const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      country: form.country || null,
      city: form.city || null,
      website: form.website || null,
      description_fr: form.description_fr || null,
      employees: form.employees || null,
      revenue: form.revenue || null,
      certifications: form.certifications ? form.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
      brands: form.brands ? form.brands.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    try {
      if (manufacturer) {
        const { error } = await supabase.from("manufacturers").update(payload).eq("id", manufacturer.id);
        if (error) throw error;
        toast.success("Fabricant mis à jour");
      } else {
        const { error } = await supabase.from("manufacturers").insert(payload);
        if (error) throw error;
        toast.success("Fabricant créé");
      }
      qc.invalidateQueries({ queryKey: ["admin-manufacturers"] });
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
          <DialogTitle>{manufacturer ? "Modifier le fabricant" : "Nouveau fabricant"}</DialogTitle>
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
            <div><Label className="text-xs">Ville</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Employés</Label><Input value={form.employees} onChange={e => setForm({ ...form, employees: e.target.value })} placeholder="50-200" /></div>
            <div><Label className="text-xs">CA</Label><Input value={form.revenue} onChange={e => setForm({ ...form, revenue: e.target.value })} placeholder="10-50M€" /></div>
          </div>
          <div><Label className="text-xs">Site web</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={3} value={form.description_fr} onChange={e => setForm({ ...form, description_fr: e.target.value })} /></div>
          <div><Label className="text-xs">Marques (séparées par des virgules)</Label><Input value={form.brands} onChange={e => setForm({ ...form, brands: e.target.value })} placeholder="TENA, Hartmann" /></div>
          <div><Label className="text-xs">Certifications (séparées par des virgules)</Label><Input value={form.certifications} onChange={e => setForm({ ...form, certifications: e.target.value })} placeholder="ISO 13485, CE" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1E293B] hover:bg-[#1E293B]/90">{saving ? "..." : manufacturer ? "Enregistrer" : "Créer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
