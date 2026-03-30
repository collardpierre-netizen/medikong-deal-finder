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
import { useEntityItemTranslations, useBatchSaveTranslations } from "@/hooks/useTranslations";
import { toast } from "sonner";
import { Languages, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: any;
  manufacturers: any[];
}

const COUNTRIES = ["BE", "FR", "NL", "DE", "LU", "CH", "US", "CN", "JP"];
const LOCALES = ["fr", "nl", "de"] as const;

export function BrandFormDialog({ open, onOpenChange, brand, manufacturers }: BrandFormDialogProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data: brandTranslations = [] } = useEntityItemTranslations("brand", brand?.id || null);
  const batchSave = useBatchSaveTranslations();

  const [form, setForm] = useState({
    name: "", slug: "", country: "BE", website: "", description: "",
    manufacturer_id: "", is_featured: false, logo_url: "",
    name_fr: "", name_nl: "", name_de: "",
    desc_fr: "", desc_nl: "", desc_de: "",
  });
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (brand) {
      const getTr = (locale: string, field: string) =>
        brandTranslations.find(t => t.locale === locale && t.field === field)?.value || "";
      setForm({
        name: brand.name || "", slug: brand.slug || "",
        country: brand.country_of_origin || "BE", website: brand.website_url || "",
        description: brand.description || "", logo_url: brand.logo_url || "",
        manufacturer_id: brand.manufacturer_id || "",
        is_featured: brand.is_featured || false,
        name_fr: getTr("fr", "name"), name_nl: getTr("nl", "name"), name_de: getTr("de", "name"),
        desc_fr: getTr("fr", "description"), desc_nl: getTr("nl", "description"), desc_de: getTr("de", "description"),
      });
    } else {
      setForm({ name: "", slug: "", country: "BE", website: "", description: "", manufacturer_id: "", is_featured: false, logo_url: "", name_fr: "", name_nl: "", name_de: "", desc_fr: "", desc_nl: "", desc_de: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brand?.id]);

  const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      country_of_origin: form.country || null,
      website_url: form.website || null,
      description: form.description || null,
      manufacturer_id: form.manufacturer_id && form.manufacturer_id !== "none" ? form.manufacturer_id : null,
      is_featured: form.is_featured,
    };
    try {
      let brandId = brand?.id;
      if (brand) {
        const { error } = await supabase.from("brands").update(payload).eq("id", brand.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("brands").insert(payload).select("id").single();
        if (error) throw error;
        brandId = data.id;
      }

      // Save translations
      const items: any[] = [];
      for (const l of LOCALES) {
        const nameVal = form[`name_${l}` as keyof typeof form]?.toString().trim();
        const descVal = form[`desc_${l}` as keyof typeof form]?.toString().trim();
        if (nameVal) items.push({ entity_type: "brand", entity_id: brandId, locale: l, field: "name", value: nameVal });
        if (descVal) items.push({ entity_type: "brand", entity_id: brandId, locale: l, field: "description", value: descVal });
      }
      if (items.length > 0) await batchSave.mutateAsync(items);

      toast.success(brand ? "Marque mise à jour" : "Marque créée");
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label className="text-xs">Fabricant</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-[13px] font-normal h-9">
                    {form.manufacturer_id && form.manufacturer_id !== "none"
                      ? manufacturers.find(m => m.id === form.manufacturer_id)?.name || "Aucun"
                      : "Aucun"}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un fabricant…" className="text-[12px]" />
                    <CommandList>
                      <CommandEmpty className="text-[12px] py-3 text-center text-muted-foreground">Aucun résultat</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="none" onSelect={() => setForm({ ...form, manufacturer_id: "none" })} className="text-[12px]">
                          <Check className={cn("mr-2 h-3.5 w-3.5", (!form.manufacturer_id || form.manufacturer_id === "none") ? "opacity-100" : "opacity-0")} />
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
          <div><Label className="text-xs">Site web</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" /></div>
          <div><Label className="text-xs">Description (originale)</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

          {/* Translation fields */}
          <div className="border-t pt-3 mt-1">
            <Label className="text-xs font-semibold flex items-center gap-1 mb-2">
              <Languages size={14} /> Traductions du nom
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {LOCALES.map(l => (
                <div key={l}>
                  <span className="text-[9px] font-bold text-muted-foreground">{l.toUpperCase()}</span>
                  <Input value={(form as any)[`name_${l}`] || ""} onChange={e => setForm({ ...form, [`name_${l}`]: e.target.value })} className="text-[11px] h-8 mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold flex items-center gap-1 mb-2">
              <Languages size={14} /> Traductions de la description
            </Label>
            <div className="space-y-2">
              {LOCALES.map(l => (
                <div key={l}>
                  <span className="text-[9px] font-bold text-muted-foreground">{l.toUpperCase()}</span>
                  <Textarea rows={2} value={(form as any)[`desc_${l}`] || ""} onChange={e => setForm({ ...form, [`desc_${l}`]: e.target.value })} className="text-[11px] mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1E293B] hover:bg-[#1E293B]/90">{saving ? "..." : brand ? "Enregistrer" : "Créer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
