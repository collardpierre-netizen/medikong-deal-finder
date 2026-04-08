import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Zap, Clock, Package } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const statusColors: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "#8B929C", bg: "#F7F8FA" },
  scheduled: { label: "Programmé", color: "#F59E0B", bg: "#FEF3C7" },
  active: { label: "Actif", color: "#00B85C", bg: "#EEFBF4" },
  ended: { label: "Terminé", color: "#5C6470", bg: "#F7F8FA" },
};

export default function RestockDrops() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", theme: "", starts_at: "", ends_at: "" });

  const { data: drops = [], isLoading } = useQuery({
    queryKey: ["restock-drops"],
    queryFn: async () => {
      const { data } = await supabase.from("restock_drops").select("*").order("starts_at", { ascending: false });
      return data || [];
    },
  });

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

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "Terminé";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}min restantes`;
  };

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
                  <Button variant="outline" size="sm" className="text-xs border-[#D0D5DC] text-[#1C58D9]">
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
