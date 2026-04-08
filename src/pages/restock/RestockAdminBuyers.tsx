import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Send, Upload } from "lucide-react";
import { toast } from "sonner";

const INTEREST_OPTIONS = ["OTC", "Vitamines", "Génériques", "Dispositifs médicaux", "Tout"];

export default function RestockAdminBuyers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    pharmacy_name: "",
    email: "",
    phone: "",
    city: "",
    interests: [] as string[],
    reception_mode: "email_portal" as string,
  });

  const { data: buyers = [], isLoading } = useQuery({
    queryKey: ["restock-buyers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("restock_buyers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addBuyer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("restock_buyers").insert({
        pharmacy_name: form.pharmacy_name,
        email: form.email,
        phone: form.phone || null,
        city: form.city || null,
        interests: form.interests,
        reception_mode: form.reception_mode,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restock-buyers"] });
      toast.success("Acheteur ajouté");
      setDialogOpen(false);
      setForm({ pharmacy_name: "", email: "", phone: "", city: "", interests: [], reception_mode: "email_portal" });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const filtered = buyers.filter((b: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.pharmacy_name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.city?.toLowerCase().includes(q)
    );
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((b: any) => b.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSend = (mode: "all" | "selected") => {
    const count = mode === "all" ? buyers.length : selected.size;
    toast.success(`Opportunités envoyées à ${count} acheteur(s)`);
  };

  const toggleInterest = (v: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(v) ? f.interests.filter((i) => i !== v) : [...f.interests, v],
    }));
  };

  const modeLabels: Record<string, string> = {
    email_portal: "Email + Portail",
    email_only: "Email uniquement",
    portal_only: "Portail uniquement",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E252F]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Gestion acheteurs
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-lg border-[#D0D5DC]">
            <Upload size={16} /> Importer CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg gap-2">
            <Plus size={16} /> Ajouter
          </Button>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B929C]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-lg border-[#D0D5DC]" />
        </div>
        <Button variant="outline" onClick={() => handleSend("all")} className="gap-2 rounded-lg text-[#1C58D9] border-[#1C58D9] hover:bg-[#EBF0FB]">
          <Send size={14} /> Envoyer à tous
        </Button>
        {selected.size > 0 && (
          <Button onClick={() => handleSend("selected")} className="gap-2 rounded-lg bg-[#00B85C] hover:bg-[#00A050] text-white">
            <Send size={14} /> Envoyer aux sélectionnés ({selected.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#D0D5DC] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F8FA] border-b border-[#D0D5DC]">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Pharmacie</th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Email</th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Ville</th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Intérêts</th>
                <th className="text-left px-4 py-3 font-medium text-[#5C6470]">Mode</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-[#8B929C]">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-[#8B929C]">Aucun acheteur</td></tr>
              ) : (
                filtered.map((b: any) => (
                  <tr key={b.id} className="border-b border-[#D0D5DC] last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-4 py-3"><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleOne(b.id)} /></td>
                    <td className="px-4 py-3 font-medium text-[#1E252F]">{b.pharmacy_name}</td>
                    <td className="px-4 py-3 text-[#5C6470]">{b.email}</td>
                    <td className="px-4 py-3 text-[#5C6470]">{b.city || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(b.interests || []).map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-[#EBF0FB] text-[#1C58D9] text-[11px] font-medium">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5C6470]">{modeLabels[b.reception_mode] || b.reception_mode}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un acheteur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom pharmacie *</Label>
              <Input value={form.pharmacy_name} onChange={(e) => setForm((f) => ({ ...f, pharmacy_name: e.target.value }))} className="rounded-lg" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-lg" />
              </div>
              <div>
                <Label>Ville</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="rounded-lg" />
              </div>
            </div>
            <div>
              <Label>Catégories d'intérêt</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {INTEREST_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleInterest(opt)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.interests.includes(opt)
                        ? "bg-[#1C58D9] text-white border-[#1C58D9]"
                        : "bg-white text-[#5C6470] border-[#D0D5DC] hover:border-[#1C58D9]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Mode de réception</Label>
              <Select value={form.reception_mode} onValueChange={(v) => setForm((f) => ({ ...f, reception_mode: v }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_portal">Email + Portail</SelectItem>
                  <SelectItem value="email_only">Email uniquement</SelectItem>
                  <SelectItem value="portal_only">Portail uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">Annuler</Button>
            <Button
              onClick={() => addBuyer.mutate()}
              disabled={!form.pharmacy_name || !form.email || addBuyer.isPending}
              className="bg-[#1C58D9] hover:bg-[#1549B8] text-white rounded-lg"
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
