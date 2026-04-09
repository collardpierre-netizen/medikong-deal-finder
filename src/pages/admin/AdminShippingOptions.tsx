import { useState } from "react";
import AdminTopBar from "@/components/admin/AdminTopBar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck, Package } from "lucide-react";

interface ShippingOption {
  id: string;
  name: string;
  name_fr: string | null;
  description: string | null;
  delivery_min_days: number;
  delivery_max_days: number;
  price_adjustment: number;
  currency: string;
  is_free: boolean;
  country_code: string;
  sort_order: number;
  is_active: boolean;
  sendcloud_method_id: number | null;
  sendcloud_carrier: string | null;
}

const emptyOpt: Partial<ShippingOption> = {
  name: "", name_fr: "", description: "", delivery_min_days: 5, delivery_max_days: 7,
  price_adjustment: 0, currency: "EUR", is_free: false, country_code: "BE", sort_order: 0, is_active: true,
  sendcloud_method_id: null, sendcloud_carrier: null,
};

export default function AdminShippingOptions() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ShippingOption> | null>(null);

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["admin-shipping-options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shipping_options")
        .select("*")
        .order("country_code")
        .order("sort_order");
      return (data || []) as ShippingOption[];
    },
  });

  const save = useMutation({
    mutationFn: async (opt: Partial<ShippingOption>) => {
      if (opt.id) {
        const { error } = await supabase.from("shipping_options").update(opt as any).eq("id", opt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shipping_options").insert(opt as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-shipping-options"] }); toast.success("Option sauvegardée"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-shipping-options"] }); toast.success("Supprimée"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (opt?: ShippingOption) => {
    setEditing(opt ? { ...opt } : { ...emptyOpt });
    setOpen(true);
  };

  return (
    <div>
      <AdminTopBar title="Options de livraison" subtitle="Gérer les méthodes d'expédition et l'intégration Sendcloud" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-primary" />
          <span className="text-sm text-muted-foreground">{options.length} option{options.length !== 1 ? "s" : ""}</span>
        </div>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-10 text-center">Chargement…</p>
      ) : options.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune option de livraison configurée</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2.5 font-semibold">Nom</th>
                <th className="px-4 py-2.5 font-semibold">Pays</th>
                <th className="px-4 py-2.5 font-semibold">Délai</th>
                <th className="px-4 py-2.5 font-semibold">Prix</th>
                <th className="px-4 py-2.5 font-semibold">Sendcloud</th>
                <th className="px-4 py-2.5 font-semibold">Actif</th>
                <th className="px-4 py-2.5 font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {options.map(o => (
                <tr key={o.id} className="border-t" style={{ borderColor: "#E2E8F0" }}>
                  <td className="px-4 py-3 font-medium">{o.name}</td>
                  <td className="px-4 py-3">{o.country_code}</td>
                  <td className="px-4 py-3">{o.delivery_min_days}–{o.delivery_max_days} jours</td>
                  <td className="px-4 py-3">{o.is_free ? "Gratuit" : `${o.price_adjustment > 0 ? "+" : ""}${o.price_adjustment} €`}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{o.sendcloud_carrier || "—"} {o.sendcloud_method_id ? `#${o.sendcloud_method_id}` : ""}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${o.is_active ? "bg-green-500" : "bg-red-400"}`} />
                  </td>
                  <td className="px-4 py-3 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Supprimer ?")) remove.mutate(o.id); }}><Trash2 size={13} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier" : "Ajouter"} une option de livraison</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nom *</Label>
                  <Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Nom FR</Label>
                  <Input value={editing.name_fr || ""} onChange={e => setEditing({ ...editing, name_fr: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Délai min (j)</Label>
                  <Input type="number" value={editing.delivery_min_days ?? 5} onChange={e => setEditing({ ...editing, delivery_min_days: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Délai max (j)</Label>
                  <Input type="number" value={editing.delivery_max_days ?? 7} onChange={e => setEditing({ ...editing, delivery_max_days: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Pays</Label>
                  <select className="w-full border border-input rounded-md px-2 py-2 text-sm" value={editing.country_code || "BE"} onChange={e => setEditing({ ...editing, country_code: e.target.value })}>
                    <option value="BE">BE</option><option value="FR">FR</option><option value="LU">LU</option><option value="NL">NL</option><option value="DE">DE</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Ajustement prix (€)</Label>
                  <Input type="number" step="0.01" value={editing.price_adjustment ?? 0} onChange={e => setEditing({ ...editing, price_adjustment: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Ordre affichage</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing({ ...editing, sort_order: +e.target.value })} />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editing.is_free ?? false} onCheckedChange={v => setEditing({ ...editing, is_free: v })} />
                  <Label className="text-xs">Gratuit</Label>
                </div>
              </div>

              <div className="border-t pt-3 mt-1">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Sendcloud (optionnel)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Transporteur</Label>
                    <Input value={editing.sendcloud_carrier || ""} onChange={e => setEditing({ ...editing, sendcloud_carrier: e.target.value })} placeholder="bpost, colissimo…" />
                  </div>
                  <div>
                    <Label className="text-xs">Method ID</Label>
                    <Input type="number" value={editing.sendcloud_method_id ?? ""} onChange={e => setEditing({ ...editing, sendcloud_method_id: e.target.value ? +e.target.value : null })} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
                <Label className="text-xs">Actif</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={!editing?.name?.trim()}>
              {save.isPending ? "…" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
