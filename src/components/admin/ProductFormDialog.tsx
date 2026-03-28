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

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  brands: any[];
  manufacturers: any[];
}

export function ProductFormDialog({ open, onOpenChange, product, brands, manufacturers }: ProductFormDialogProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_name: "", gtin: "", brand: "", mpn: "",
    category_l1: "", category_l2: "", category_l3: "",
    weight_g: "", rrp_eur: "", description_short: "",
    brand_id: "", manufacturer_id: "", status: "active",
  });

  useEffect(() => {
    if (product) {
      setForm({
        product_name: product.product_name || "", gtin: product.gtin || "",
        brand: product.brand || "", mpn: product.mpn || "",
        category_l1: product.category_l1 || "", category_l2: product.category_l2 || "",
        category_l3: product.category_l3 || "", weight_g: String(product.weight_g || ""),
        rrp_eur: String(product.rrp_eur || ""), description_short: product.description_short || "",
        brand_id: product.brand_id || "", manufacturer_id: product.manufacturer_id || "",
        status: product.status || "active",
      });
    } else {
      setForm({ product_name: "", gtin: "", brand: "", mpn: "", category_l1: "", category_l2: "", category_l3: "", weight_g: "", rrp_eur: "", description_short: "", brand_id: "", manufacturer_id: "", status: "active" });
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!form.product_name.trim() || !form.gtin.trim() || !form.brand.trim()) {
      toast.error("Nom, GTIN et marque sont obligatoires");
      return;
    }
    if (!form.weight_g || isNaN(Number(form.weight_g))) {
      toast.error("Poids (g) est obligatoire et doit être un nombre");
      return;
    }
    setSaving(true);
    const payload: any = {
      product_name: form.product_name.trim(),
      gtin: form.gtin.trim(),
      brand: form.brand.trim(),
      mpn: form.mpn || null,
      category_l1: form.category_l1 || "Non classé",
      category_l2: form.category_l2 || "Non classé",
      category_l3: form.category_l3 || "Non classé",
      weight_g: Number(form.weight_g),
      rrp_eur: form.rrp_eur ? Number(form.rrp_eur) : null,
      description_short: form.description_short || null,
      brand_id: form.brand_id || null,
      manufacturer_id: form.manufacturer_id || null,
      status: form.status as any,
    };
    try {
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        toast.success("Produit mis à jour");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Produit créé");
      }
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label className="text-xs">Nom du produit *</Label><Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">GTIN (EAN) *</Label><Input value={form.gtin} onChange={e => setForm({ ...form, gtin: e.target.value })} /></div>
            <div><Label className="text-xs">Marque *</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
            <div><Label className="text-xs">MPN / CNK</Label><Input value={form.mpn} onChange={e => setForm({ ...form, mpn: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Catégorie L1</Label><Input value={form.category_l1} onChange={e => setForm({ ...form, category_l1: e.target.value })} /></div>
            <div><Label className="text-xs">Catégorie L2</Label><Input value={form.category_l2} onChange={e => setForm({ ...form, category_l2: e.target.value })} /></div>
            <div><Label className="text-xs">Catégorie L3</Label><Input value={form.category_l3} onChange={e => setForm({ ...form, category_l3: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Poids (g) *</Label><Input type="number" value={form.weight_g} onChange={e => setForm({ ...form, weight_g: e.target.value })} /></div>
            <div><Label className="text-xs">Prix public (€)</Label><Input type="number" step="0.01" value={form.rrp_eur} onChange={e => setForm({ ...form, rrp_eur: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Statut</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Marque (lien)</Label>
              <Select value={form.brand_id} onValueChange={v => setForm({ ...form, brand_id: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fabricant (lien)</Label>
              <Select value={form.manufacturer_id} onValueChange={v => setForm({ ...form, manufacturer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Description courte</Label><Textarea rows={3} value={form.description_short} onChange={e => setForm({ ...form, description_short: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1E293B] hover:bg-[#1E293B]/90">{saving ? "..." : product ? "Enregistrer" : "Créer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
