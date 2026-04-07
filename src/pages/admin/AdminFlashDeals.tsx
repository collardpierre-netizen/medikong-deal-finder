import { useState } from "react";
import { useFlashDeals, usePromotionCampaigns } from "@/hooks/usePromotions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap, Calendar, Megaphone } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

function FlashDealForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [discountPrice, setDiscountPrice] = useState("");
  const [label, setLabel] = useState("Flash");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  const searchProducts = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("products")
      .select("id, name, brand_name, best_price_incl_vat, reference_price, image_url")
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const handleSave = async () => {
    if (!selectedProduct || !discountPrice || !endsAt) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("flash_deals").insert({
      product_id: selectedProduct.id,
      discount_price_incl_vat: parseFloat(discountPrice),
      original_price_incl_vat: selectedProduct.best_price_incl_vat || selectedProduct.reference_price || 0,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      label,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Flash deal créé !");
    qc.invalidateQueries({ queryKey: ["flash-deals-admin"] });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Rechercher un produit</Label>
        <Input
          value={productSearch}
          onChange={e => { setProductSearch(e.target.value); searchProducts(e.target.value); }}
          placeholder="Nom du produit..."
        />
        {searchResults.length > 0 && !selectedProduct && (
          <div className="border border-border rounded-md mt-1 max-h-40 overflow-y-auto">
            {searchResults.map(p => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between"
                onClick={() => { setSelectedProduct(p); setSearchResults([]); setProductSearch(p.name); }}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground ml-2">{p.best_price_incl_vat?.toFixed(2)} €</span>
              </button>
            ))}
          </div>
        )}
        {selectedProduct && (
          <p className="text-xs text-muted-foreground mt-1">
            Prix actuel : {selectedProduct.best_price_incl_vat?.toFixed(2)} € TTC
            {selectedProduct.reference_price && ` | Réf : ${selectedProduct.reference_price.toFixed(2)} €`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Prix promo TTC (€)</Label>
          <Input type="number" step="0.01" value={discountPrice} onChange={e => setDiscountPrice(e.target.value)} />
        </div>
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Flash -50%" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Début</Label>
          <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
        </div>
        <div>
          <Label>Fin</Label>
          <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Création..." : "Créer le flash deal"}
        </Button>
      </div>
    </div>
  );
}

function CampaignForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !startsAt || !endsAt) { toast.error("Remplissez les champs obligatoires"); return; }
    setSaving(true);
    const { error } = await supabase.from("promotion_campaigns").insert({
      name,
      description: description || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campagne créée !");
    qc.invalidateQueries({ queryKey: ["promotion-campaigns"] });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Nom de la campagne</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Black Friday Medical 2026" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Début</Label>
          <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
        </div>
        <div>
          <Label>Fin</Label>
          <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Création..." : "Créer"}</Button>
      </div>
    </div>
  );
}

export default function AdminFlashDeals() {
  const { data: flashDeals = [], isLoading } = useFlashDeals();
  const { data: campaigns = [] } = usePromotionCampaigns();
  const qc = useQueryClient();
  const [showFlashForm, setShowFlashForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);

  const now = new Date();

  const toggleFlashDeal = async (id: string, isActive: boolean) => {
    await supabase.from("flash_deals").update({ is_active: !isActive }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["flash-deals-admin"] });
    toast.success(isActive ? "Flash deal désactivé" : "Flash deal activé");
  };

  const deleteFlashDeal = async (id: string) => {
    await supabase.from("flash_deals").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["flash-deals-admin"] });
    toast.success("Flash deal supprimé");
  };

  const toggleCampaign = async (id: string, isActive: boolean) => {
    await supabase.from("promotion_campaigns").update({ is_active: !isActive }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["promotion-campaigns"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flash Deals & Campagnes</h1>
          <p className="text-sm text-muted-foreground">Gérez les promotions flash et les campagnes promotionnelles</p>
        </div>
      </div>

      <Tabs defaultValue="flash">
        <TabsList>
          <TabsTrigger value="flash" className="gap-1"><Zap size={14} /> Flash Deals</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1"><Megaphone size={14} /> Campagnes</TabsTrigger>
        </TabsList>

        <TabsContent value="flash" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showFlashForm} onOpenChange={setShowFlashForm}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus size={14} className="mr-1" /> Nouveau flash deal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Créer un Flash Deal</DialogTitle></DialogHeader>
                <FlashDealForm onClose={() => setShowFlashForm(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Prix original</TableHead>
                  <TableHead>Prix promo</TableHead>
                  <TableHead>Réduction</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flashDeals.map((fd: any) => {
                  const discount = Math.round((1 - fd.discount_price_incl_vat / fd.original_price_incl_vat) * 100);
                  const isLive = fd.is_active && new Date(fd.starts_at) <= now && new Date(fd.ends_at) >= now;
                  const isExpired = new Date(fd.ends_at) < now;

                  return (
                    <TableRow key={fd.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{fd.product?.name || "—"}</TableCell>
                      <TableCell>{fd.original_price_incl_vat?.toFixed(2)} €</TableCell>
                      <TableCell className="font-bold text-destructive">{fd.discount_price_incl_vat?.toFixed(2)} €</TableCell>
                      <TableCell><Badge variant="destructive">-{discount}%</Badge></TableCell>
                      <TableCell className="text-xs">
                        {new Date(fd.starts_at).toLocaleDateString("fr-FR")} → {new Date(fd.ends_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="secondary">Expiré</Badge>
                        ) : isLive ? (
                          <Badge className="bg-emerald-500 text-white">En cours</Badge>
                        ) : (
                          <Badge variant="outline">Programmé</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={fd.is_active} onCheckedChange={() => toggleFlashDeal(fd.id, fd.is_active)} />
                          <Button variant="ghost" size="icon" onClick={() => deleteFlashDeal(fd.id)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {flashDeals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun flash deal. Créez-en un !
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showCampaignForm} onOpenChange={setShowCampaignForm}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus size={14} className="mr-1" /> Nouvelle campagne</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Créer une campagne promo</DialogTitle></DialogHeader>
                <CampaignForm onClose={() => setShowCampaignForm(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campagne</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map(c => {
                  const isLive = c.is_active && new Date(c.starts_at) <= now && new Date(c.ends_at) >= now;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.description || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(c.starts_at).toLocaleDateString("fr-FR")} → {new Date(c.ends_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        {isLive ? <Badge className="bg-emerald-500 text-white">En cours</Badge> : <Badge variant="outline">Planifiée</Badge>}
                      </TableCell>
                      <TableCell>
                        <Switch checked={c.is_active} onCheckedChange={() => toggleCampaign(c.id, c.is_active)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucune campagne.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
