import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Zap, Clock, Package, ArrowLeft, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const statusColors: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "#8B929C", bg: "#F7F8FA" },
  scheduled: { label: "Programmé", color: "#F59E0B", bg: "#FEF3C7" },
  active: { label: "Actif", color: "#00B85C", bg: "#EEFBF4" },
  ended: { label: "Terminé", color: "#5C6470", bg: "#F7F8FA" },
};

const statusOptions = ["draft", "scheduled", "active", "ended"];

export default function RestockDrops() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", theme: "", starts_at: "", ends_at: "" });
  const [selectedDropId, setSelectedDropId] = useState<string | null>(null);
  const [offerSearch, setOfferSearch] = useState("");

  // Fetch drops
  const { data: drops = [], isLoading } = useQuery({
    queryKey: ["restock-drops"],
    queryFn: async () => {
      const { data } = await supabase.from("restock_drops").select("*").order("starts_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch all published restock offers for linking
  const { data: allOffers = [] } = useQuery({
    queryKey: ["restock-offers-for-drops"],
    queryFn: async () => {
      const { data } = await supabase
        .from("restock_offers")
        .select("id, product_name, ean, status, unit_price, quantity")
        .in("status", ["published", "approved"])
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: !!selectedDropId,
  });

  const selectedDrop = useMemo(() => drops.find((d: any) => d.id === selectedDropId), [drops, selectedDropId]);
  const dropOfferIds: string[] = useMemo(() => selectedDrop?.offer_ids || [], [selectedDrop]);

  const filteredOffers = useMemo(() => {
    if (!offerSearch.trim()) return allOffers.filter((o: any) => !dropOfferIds.includes(o.id)).slice(0, 20);
    const q = offerSearch.toLowerCase();
    return allOffers
      .filter((o: any) => !dropOfferIds.includes(o.id))
      .filter((o: any) => o.product_name?.toLowerCase().includes(q) || o.ean?.includes(q))
      .slice(0, 20);
  }, [allOffers, offerSearch, dropOfferIds]);

  const linkedOffers = useMemo(() => allOffers.filter((o: any) => dropOfferIds.includes(o.id)), [allOffers, dropOfferIds]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("restock_drops").insert({
        name: form.name,
        theme: form.theme || null,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-drops"] });
      toast.success("Drop créé");
      setShowCreate(false);
      setForm({ name: "", theme: "", starts_at: "", ends_at: "" });
    },
    onError: () => toast.error("Erreur"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restock_drops").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-drops"] });
      toast.success("Statut mis à jour");
    },
  });

  const updateOffersMutation = useMutation({
    mutationFn: async ({ id, offer_ids }: { id: string; offer_ids: string[] }) => {
      const { error } = await supabase.from("restock_drops").update({ offer_ids }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-drops"] });
      toast.success("Offres mises à jour");
    },
  });

  const addOffer = (offerId: string) => {
    if (!selectedDropId) return;
    const newIds = [...dropOfferIds, offerId];
    updateOffersMutation.mutate({ id: selectedDropId, offer_ids: newIds });
  };

  const removeOffer = (offerId: string) => {
    if (!selectedDropId) return;
    const newIds = dropOfferIds.filter((id) => id !== offerId);
    updateOffersMutation.mutate({ id: selectedDropId, offer_ids: newIds });
  };

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "Terminé";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}min restantes`;
  };

  // ── Detail view ──
  if (selectedDrop) {
    const st = statusColors[selectedDrop.status] || statusColors.draft;
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <button onClick={() => setSelectedDropId(null)} className="flex items-center gap-1.5 text-sm text-[#1C58D9] hover:underline mb-4">
          <ArrowLeft size={14} /> Retour aux drops
        </button>

        <div className="bg-white border border-[#D0D5DC] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#1E252F]">{selectedDrop.name}</h2>
              {selectedDrop.theme && <p className="text-sm text-[#5C6470]">{selectedDrop.theme}</p>}
            </div>
            <Badge className="text-xs" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#8B929C] mb-4">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(selectedDrop.starts_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>→</span>
            <span>{new Date(selectedDrop.ends_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="flex items-center gap-1"><Clock size={12} />{getTimeRemaining(selectedDrop.ends_at)}</span>
          </div>

          {/* Status changer */}
          <div className="flex items-center gap-3">
            <Label className="text-xs text-[#5C6470]">Statut :</Label>
            <Select value={selectedDrop.status} onValueChange={(v) => updateStatusMutation.mutate({ id: selectedDrop.id, status: v })}>
              <SelectTrigger className="w-40 h-8 text-xs border-[#D0D5DC]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{statusColors[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linked offers */}
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-6 mb-6">
          <h3 className="font-bold text-[#1E252F] mb-3 flex items-center gap-2">
            <Package size={16} /> Offres liées ({dropOfferIds.length})
          </h3>
          {linkedOffers.length === 0 ? (
            <p className="text-sm text-[#8B929C] py-4 text-center">Aucune offre liée à ce drop</p>
          ) : (
            <div className="space-y-2">
              {linkedOffers.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between bg-[#F7F8FA] rounded-lg px-4 py-2.5">
                  <div className="text-sm">
                    <span className="font-medium text-[#1E252F]">{o.product_name}</span>
                    {o.ean && <span className="ml-2 text-[#8B929C] text-xs">EAN {o.ean}</span>}
                    <span className="ml-3 text-xs text-[#5C6470]">{o.quantity} u. — {o.unit_price?.toFixed(2)} €</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 w-7 p-0" onClick={() => removeOffer(o.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add offers */}
        <div className="bg-white border border-[#D0D5DC] rounded-xl p-6">
          <h3 className="font-bold text-[#1E252F] mb-3">Ajouter des offres</h3>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
            <Input
              value={offerSearch}
              onChange={(e) => setOfferSearch(e.target.value)}
              placeholder="Rechercher par nom ou EAN…"
              className="pl-9 border-[#D0D5DC] rounded-lg h-9 text-sm"
            />
          </div>
          {filteredOffers.length === 0 ? (
            <p className="text-sm text-[#8B929C] text-center py-4">Aucune offre disponible</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {filteredOffers.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-[#F7F8FA] transition-colors">
                  <div className="text-sm">
                    <span className="font-medium text-[#1E252F]">{o.product_name}</span>
                    {o.ean && <span className="ml-2 text-[#8B929C] text-xs">EAN {o.ean}</span>}
                    <span className="ml-3 text-xs text-[#5C6470]">{o.quantity} u. — {o.unit_price?.toFixed(2)} €</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-[#1C58D9] text-[#1C58D9]" onClick={() => addOffer(o.id)}>
                    <Plus size={12} className="mr-1" /> Ajouter
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap size={24} className="text-[#F59E0B]" />
          <h1 className="text-2xl font-bold text-[#1E252F]">Drops hebdomadaires</h1>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2">
          <Plus size={16} /> Nouveau drop
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : drops.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#D0D5DC] rounded-xl">
          <Zap size={40} className="mx-auto mb-3 text-[#D0D5DC]" />
          <p className="text-[#5C6470]">Aucun drop créé</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {drops.map((drop: any) => {
            const st = statusColors[drop.status] || statusColors.draft;
            return (
              <div key={drop.id} className="bg-white border border-[#D0D5DC] rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#1E252F]">{drop.name}</h3>
                      <Badge className="text-[10px]" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</Badge>
                    </div>
                    {drop.theme && <p className="text-sm text-[#5C6470] mb-2">{drop.theme}</p>}
                    <div className="flex items-center gap-4 text-xs text-[#8B929C]">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(drop.starts_at).toLocaleDateString("fr-BE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {getTimeRemaining(drop.ends_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        {(drop.offer_ids || []).length} offres
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-[#D0D5DC] text-[#1C58D9]"
                    onClick={() => setSelectedDropId(drop.id)}
                  >
                    Gérer
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau drop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du drop *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Drop du mardi — Vitamines"
                className="border-[#D0D5DC] rounded-lg"
              />
            </div>
            <div>
              <Label>Thème</Label>
              <Input
                value={form.theme}
                onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                placeholder="Vitamines & Compléments"
                className="border-[#D0D5DC] rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Début *</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
              <div>
                <Label>Fin *</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  className="border-[#D0D5DC] rounded-lg"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-lg">Annuler</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.starts_at || !form.ends_at || createMutation.isPending}
              className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg"
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
