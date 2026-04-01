import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsUpDown, Check, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  brands: any[];
  manufacturers: any[];
}

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function ProductFormDialog({ open, onOpenChange, product, brands, manufacturers }: ProductFormDialogProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", gtin: "", cnk_code: "", sku: "",
    brand_name: "", brand_id: "", manufacturer_id: "",
    category_name: "", description: "", short_description: "",
    unit_quantity: "1", image_url: "", is_active: true,
  });

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name || "",
        slug: product.slug || "",
        gtin: product.gtin || "",
        cnk_code: product.cnk_code || "",
        sku: product.sku || "",
        brand_name: product.brand_name || "",
        brand_id: product.brand_id || "",
        manufacturer_id: product.manufacturer_id || "",
        category_name: product.category_name || "",
        description: product.description || "",
        short_description: product.short_description || "",
        unit_quantity: String(product.unit_quantity || 1),
        image_url: (product.image_urls as string[] | null)?.[0] || "",
        is_active: product.is_active !== false,
      });
    } else {
      setForm({
        name: "", slug: "", gtin: "", cnk_code: "", sku: "",
        brand_name: "", brand_id: "", manufacturer_id: "",
        category_name: "", description: "", short_description: "",
        unit_quantity: "1", image_url: "", is_active: true,
      });
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      gtin: form.gtin.trim() || null,
      cnk_code: form.cnk_code.trim() || null,
      sku: form.sku.trim() || null,
      brand_name: form.brand_name.trim() || null,
      brand_id: form.brand_id || null,
      manufacturer_id: form.manufacturer_id || null,
      category_name: form.category_name.trim() || null,
      description: form.description.trim() || null,
      short_description: form.short_description.trim() || null,
      unit_quantity: parseInt(form.unit_quantity) || 1,
      image_urls: form.image_url.trim() ? [form.image_url.trim()] : [],
      is_active: form.is_active,
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

  const selectedBrand = brands.find(b => b.id === form.brand_id);
  const selectedMfr = manufacturers.find(m => m.id === form.manufacturer_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <Label className="text-xs">Nom du produit *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="w-[180px]" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">GTIN (EAN)</Label><Input value={form.gtin} onChange={e => setForm({ ...form, gtin: e.target.value })} /></div>
            <div><Label className="text-xs">CNK</Label><Input value={form.cnk_code} onChange={e => setForm({ ...form, cnk_code: e.target.value })} /></div>
            <div><Label className="text-xs">SKU</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Marque</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-[13px] font-normal h-9">
                    {selectedBrand?.name || form.brand_name || "Aucune"}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher une marque…" className="text-[12px]" />
                    <CommandList>
                      <CommandEmpty className="text-[12px] py-3 text-center text-muted-foreground">Aucun résultat</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="none" onSelect={() => setForm({ ...form, brand_id: "", brand_name: "" })} className="text-[12px]">
                          <Check className={cn("mr-2 h-3.5 w-3.5", !form.brand_id ? "opacity-100" : "opacity-0")} />
                          Aucune
                        </CommandItem>
                        {brands.map(b => (
                          <CommandItem key={b.id} value={b.name} onSelect={() => setForm({ ...form, brand_id: b.id, brand_name: b.name })} className="text-[12px]">
                            <Check className={cn("mr-2 h-3.5 w-3.5", form.brand_id === b.id ? "opacity-100" : "opacity-0")} />
                            {b.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Fabricant</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-[13px] font-normal h-9">
                    {selectedMfr?.name || "Aucun"}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un fabricant…" className="text-[12px]" />
                    <CommandList>
                      <CommandEmpty className="text-[12px] py-3 text-center text-muted-foreground">Aucun résultat</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="none" onSelect={() => setForm({ ...form, manufacturer_id: "" })} className="text-[12px]">
                          <Check className={cn("mr-2 h-3.5 w-3.5", !form.manufacturer_id ? "opacity-100" : "opacity-0")} />
                          Aucun
                        </CommandItem>
                        {manufacturers.map(m => (
                          <CommandItem key={m.id} value={m.name} onSelect={() => setForm({ ...form, manufacturer_id: m.id })} className="text-[12px]">
                            <Check className={cn("mr-2 h-3.5 w-3.5", form.manufacturer_id === m.id ? "opacity-100" : "opacity-0")} />
                            {m.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Catégorie</Label><Input value={form.category_name} onChange={e => setForm({ ...form, category_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Unités</Label><Input type="number" value={form.unit_quantity} onChange={e => setForm({ ...form, unit_quantity: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Statut</Label>
                <Select value={form.is_active ? "active" : "inactive"} onValueChange={v => setForm({ ...form, is_active: v === "active" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Image URL</Label>
            <div className="flex gap-2 items-end">
              <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="flex-1" />
              {form.image_url && (
                <img src={form.image_url} alt="Preview" referrerPolicy="no-referrer" className="w-10 h-10 rounded object-contain border border-border"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
          </div>

          <div><Label className="text-xs">Description courte</Label><Textarea rows={2} value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1E293B] hover:bg-[#1E293B]/90">{saving ? "..." : product ? "Enregistrer" : "Créer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
