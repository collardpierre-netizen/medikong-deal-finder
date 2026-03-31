import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VendorFormDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    phone: "",
    vat_number: "",
    address_line1: "",
    city: "",
    postal_code: "",
    country_code: "BE",
    commission_rate: "15",
    description: "",
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setSaving(true);
    try {
      const slug = slugify(form.company_name);
      const { error } = await supabase.from("vendors").insert({
        name: form.company_name.trim(),
        slug,
        company_name: form.company_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        vat_number: form.vat_number.trim() || null,
        address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country_code: form.country_code || "BE",
        commission_rate: parseFloat(form.commission_rate) || 0,
        description: form.description.trim() || null,
        type: "real" as any,
        is_active: true,
        can_manage_offers: true,
      });
      if (error) throw error;
      toast.success("Vendeur créé avec succès !");
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      onOpenChange(false);
      setForm({ company_name: "", email: "", phone: "", vat_number: "", address_line1: "", city: "", postal_code: "", country_code: "BE", commission_rate: "15", description: "" });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un vendeur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Nom de l'entreprise *</Label>
            <Input value={form.company_name} onChange={e => set("company_name", e.target.value)} placeholder="Ex: Pharma Distribution SA" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@exemple.be" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+32 2 123 45 67" />
            </div>
          </div>
          <div>
            <Label>Numéro de TVA</Label>
            <Input value={form.vat_number} onChange={e => set("vat_number", e.target.value)} placeholder="BE0123456789" />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={form.address_line1} onChange={e => set("address_line1", e.target.value)} placeholder="Rue de la Loi 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Bruxelles" />
            </div>
            <div>
              <Label>Code postal</Label>
              <Input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="1000" />
            </div>
            <div>
              <Label>Pays</Label>
              <Input value={form.country_code} onChange={e => set("country_code", e.target.value)} placeholder="BE" />
            </div>
          </div>
          <div>
            <Label>Commission (%)</Label>
            <Input type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={e => set("commission_rate", e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-y"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Description du vendeur..."
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: "#1E293B" }}
          >
            {saving ? "Création en cours..." : "Créer le vendeur"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
