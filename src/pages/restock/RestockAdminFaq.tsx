import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Eye, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const CATEGORIES = [
  { value: "legal", label: "Cadre légal" },
  { value: "product", label: "Produits" },
  { value: "transaction", label: "Transaction" },
  { value: "logistics", label: "Logistique" },
  { value: "tax", label: "Fiscalité" },
  { value: "confidentiality", label: "Confidentialité" },
];

interface FaqForm {
  id?: string;
  category: string;
  question: string;
  answer_html: string;
  display_order: number;
  is_published: boolean;
}

const emptyForm: FaqForm = { category: "legal", question: "", answer_html: "", display_order: 0, is_published: true };

export default function RestockAdminFaq() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FaqForm>(emptyForm);
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-faq-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faq_items").select("*").order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (f: FaqForm) => {
      if (f.id) {
        const { error } = await supabase.from("faq_items").update({
          category: f.category, question: f.question, answer_html: f.answer_html,
          display_order: f.display_order, is_published: f.is_published,
        }).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("faq_items").insert({
          category: f.category, question: f.question, answer_html: f.answer_html,
          display_order: f.display_order, is_published: f.is_published,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-faq-items"] });
      toast.success("FAQ sauvegardée");
      setOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error("Erreur"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faq_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-faq-items"] });
      toast.success("Supprimé");
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-[#1C58D9]" />
          <h1 className="text-2xl font-bold text-[#1E252F]">FAQ Réglementaire</h1>
          <Badge variant="outline">{items.length} items</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyForm)} className="bg-[#1C58D9] hover:bg-[#1549B8] text-white gap-2">
              <Plus size={16} /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{form.id ? "Modifier" : "Nouvelle"} question FAQ</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Catégorie</label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Ordre</label>
                  <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Question</label>
                <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Réponse (HTML)</label>
                <Textarea rows={6} value={form.answer_html} onChange={(e) => setForm({ ...form, answer_html: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                <label className="text-sm">Publié</label>
              </div>
              <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} className="w-full bg-[#1C58D9] hover:bg-[#1549B8] text-white">
                {saveMut.isPending ? <Loader2 className="animate-spin" size={16} /> : "Sauvegarder"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[#8B929C]">Chargement…</div>
      ) : (
        <div className="bg-white border border-[#D0D5DC] rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F8FA] text-[#5C6470]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Catégorie</th>
                <th className="text-left px-4 py-3 font-medium">Question</th>
                <th className="text-center px-4 py-3 font-medium">Vues</th>
                <th className="text-center px-4 py-3 font-medium">Statut</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-t border-[#D0D5DC]/50 hover:bg-[#F7F8FA]/50">
                  <td className="px-4 py-3 text-[#8B929C]">{item.display_order}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[#1E252F] max-w-md truncate">{item.question}</td>
                  <td className="px-4 py-3 text-center text-[#8B929C]">
                    <span className="flex items-center justify-center gap-1"><Eye size={12} />{item.view_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.is_published ? (
                      <Badge className="bg-[#EEFBF4] text-[#00B85C] text-[10px]">Publié</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-[#8B929C]">Brouillon</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setForm({ ...item }); setOpen(true); }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="text-[#E54545]"
                      onClick={() => { if (confirm("Supprimer ?")) deleteMut.mutate(item.id); }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
